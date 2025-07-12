import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { createPostSchema } from "./schemas/mod.ts";
import { errorHandler } from "./error.ts";

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

  const limiter6pm = makeLimiter(6);
  const limiter2pm = makeLimiter(2);

  app.all("/", (req, res) => {
    res.render("index");
  });

  app.post("/post", (req, res) => {
    const parsed = createPostSchema.parse(req.body);
    console.log(parsed);
    res.send(req.body);
  });

  app.use(errorHandler);

  return app;
};

createApp().listen(config.httpPort).on("listening", () => {
  console.log(`Listening at http://0.0.0.0:${config.httpPort}`);
});
