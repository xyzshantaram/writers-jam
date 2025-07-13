import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { errorHandler } from "./error.ts";
import * as index from "./routes/index.ts";
import * as posts from "./routes/posts.ts";
import { timeMs } from "./utils/time.ts";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { marked, Renderer } from "marked";
import sanitize from "sanitize-html";
import { markedSmartypants } from "marked-smartypants";

/*
GET /post/:ulid
    - show post details, link to edit page, post comments (!)
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

  app.use(errorHandler);
  return app;
};

createApp().listen(config.httpPort).on("listening", () => {
  console.info(`Listening at http://0.0.0.0:${config.httpPort}`);
});
