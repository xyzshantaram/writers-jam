import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { errorHandler, renderError } from "./error.ts";
import * as index from "./routes/index.ts";
import * as posts from "./routes/posts.ts";
import { timeMs } from "./utils/time.ts";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { marked, Renderer } from "marked";
import sanitize from "sanitize-html";
import { markedSmartypants } from "marked-smartypants";
import z from "zod/v4";
import { getPostById } from "./db.ts";

/*
GET /post/:ulid/edit
    - delete post
    - edit post contents
POST /post/:ulid/edit
POST /post/:ulid/comment

GET /admin/reports
GET /admin/reports/:lid
POST /admin/posts/:ulid/delete
POST /admin/posts/:ulid/reset-reports
POST /admin/posts/:ulid/comment/:ulid/delete
POST /admin/post/:ulid/mark-safe
*/

let markedSetup = false;
const setupMarked = () => {
  if (markedSetup) return;
  markedSetup = true;
  const renderer: Partial<Renderer> = {
    heading({ tokens, depth }) {
      const text = this.parser?.parseInline(tokens);
      return `<div class='heading-${depth}'>${text}</div>`;
    },
    image() {
      return "";
    },
  };
  marked.use({ renderer });
  marked.use(markedSmartypants());
};

const parseMd = (s: string) => {
  setupMarked();

  return sanitize(marked.parse(s), {
    allowedClasses: {
      "div": [
        "heading-1",
        "heading-2",
        "heading-3",
        "heading-4",
        "heading-5",
        "heading-6",
      ],
    },
  }) as string;
};

const setupLiquid = (app: express.Express, timeAgo: TimeAgo) => {
  const liquid = new Liquid({ extname: ".liquid", jsTruthy: true });

  liquid.registerFilter("time_ago", (stamp: number) => {
    return timeAgo.format(new Date(stamp));
  });
  liquid.registerFilter("parse_md", parseMd);

  app.engine("liquid", liquid.express());
  app.set("view engine", "liquid");
  app.set("views", path.resolve("./templates"));
};

const createApp = () => {
  const app = express();

  app.use(express.static("./public"));
  app.use(express.urlencoded({ extended: true }));
  app.use(makeCors());

  TimeAgo.addDefaultLocale(en);
  const timeAgo = new TimeAgo("en-US");
  setupLiquid(app, timeAgo);

  app.get("/", index.get);

  app.get("/post", posts.index);
  app.get("/post/random", posts.random);
  app.get("/post/:id", posts.view);
  app.post("/post", makeLimiter(1, timeMs({ s: 15 })), posts.create);
  app.post(
    "/post/:id/comment",
    makeLimiter(1, timeMs({ s: 15 })),
    posts.addComment,
  );

  const manageSchema = z.object({
    id: z.ulid(),
    password: z.string().nonempty(),
  });

  app.post("/post/:id/manage", (req, res) => {
    const parsed = manageSchema.parse(req.body);
    const post = getPostById(parsed.id);
    if (!post) {
      return renderError(res, {
        code: "NotFound",
        details:
          "The post with the given ID was not found. It may have been deleted or you may have followed a broken link.",
        name: "Not found",
        title: "Post not found",
      });
    }

    if (post.password !== parsed.password) {
      return renderError(res, {
        code: "BadRequest",
        details:
          "There was an error processing your request. Please try again later.",
      });
    }

    res.render("create-post", {
      mode: "edit",
      post,
    });
  });

  app.use(errorHandler);
  return app;
};

createApp().listen(config.httpPort).on("listening", () => {
  console.info(`Listening at http://0.0.0.0:${config.httpPort}`);
});
