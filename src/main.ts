import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { createPostSchema } from "./schemas/mod.ts";
import { errorHandler, renderError } from "./error.ts";
import { createPost, getPosts } from "./db.ts";
import captchas from "../data/captchas.json" with { type: "json" };
import { timeMs } from "./utils/time.ts";
import { choose } from "./utils/mod.ts";

/*
POST /post
    - optional trigger warning
    - nsfw flag
    - password
GET /
    - sort by views, recent + filter by nsfw
    - show total post stats
    - link to create new post
GET /post/:ulid
    - show post details, link to edit page
GET /post/:ulid/edit
    - delete post
    - edit post contents
POST /post/:ulid/edit
POST /post/:ulid/comment
GET /post/random

GET /admin/reports
GET /admin/reports/:lid
POST /admin/posts/:ulid/delete
POST /admin/posts/:ulid/reset-reports
POST /admin/posts/:ulid/comment/:ulid/delete
POST /admin/post/:ulid/mark-safe
*/

const createApp = () => {
  const app = express();
  app.use(express.static("./public"));
  const liquid = new Liquid({ extname: ".liquid" });

  app.engine("liquid", liquid.express());
  app.set("view engine", "liquid");
  app.set("views", path.resolve("./templates"));
  app.use(express.static("./public"));
  app.use(express.urlencoded({ extended: true }));
  app.use(makeCors());

  app.get("/", (req, res) => {
    const { nsfw, sort } = req.query;
    const results = getPosts({
      nsfw: nsfw === "yes" || nsfw === "no" ? nsfw : undefined,
      sort: sort === "updated" || sort === "views" ? sort : undefined,
    });
    console.log(results);
    res.render("index", { results });
  });

  app.get("/post", (_, res) => {
    res.render("create-post", {
      captcha: choose(Object.values(captchas)),
    });
  });

  app.get("/post/:uuid", (_, res) => {
  });

  const isCaptchaId = (s: string): s is keyof typeof captchas => s in captchas;

  app.post("/post", makeLimiter(1, timeMs({ s: 15 })), (req, res) => {
    const parsed = createPostSchema.parse(req.body);
    if (
      !isCaptchaId(parsed.captcha) ||
      captchas[parsed.captcha].answer !== parsed.solution
    ) {
      return renderError(res, {
        details:
          "Your solution to the captcha was incorrect. Please try again.",
        title: "Incorrect captcha.",
        name: "Captcha",
      });
    }

    const { captcha: _, solution: __, ...createOpts } = parsed;

    const created = createPost(createOpts);
    return res.redirect(`/post/${created}`);
  });

  app.use(errorHandler);

  return app;
};

createApp().listen(config.httpPort).on("listening", () => {
  console.info(`Listening at http://0.0.0.0:${config.httpPort}`);
});
