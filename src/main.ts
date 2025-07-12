import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";

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
POST /admin/post/:ulid/mark-safe
*/

app.post("/posts", (req, res) => {
  res.send(req.body);
});

app.listen(config.httpPort).on("listening", () => {
  console.log(`Listening at http://0.0.0.0:${config.httpPort}`);
});
