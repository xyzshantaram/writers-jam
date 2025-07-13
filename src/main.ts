import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { createPostSchema } from "./schemas/mod.ts";
import { errorHandler, renderError } from "./error.ts";
import {
  createPost,
  getPostCount,
  getPosts,
  getViewCount,
  randomPost,
} from "./db.ts";
import captchas from "../data/captchas.json" with { type: "json" };
import { timeMs } from "./utils/time.ts";
import { choose } from "./utils/mod.ts";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";

TimeAgo.addDefaultLocale(en);

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

function makeQueryLinkHelper(query: Record<string, any>) {
  return function addQueryParamsObject(newParams?: Record<string, string>) {
    const merged = { ...query, ...newParams };

    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([_, v]) => v != null),
    );

    const searchParams = new URLSearchParams(cleaned);
    return `?${searchParams.toString()}`;
  };
}

const createApp = () => {
  const app = express();
  const timeAgo = new TimeAgo("en-US");
  app.use(express.static("./public"));
  const liquid = new Liquid({ extname: ".liquid", jsTruthy: true });
  liquid.registerFilter("time_ago", (stamp: number) => {
    return timeAgo.format(new Date(stamp));
  });

  app.engine("liquid", liquid.express());
  app.set("view engine", "liquid");
  app.set("views", path.resolve("./templates"));
  app.use(express.static("./public"));
  app.use(express.urlencoded({ extended: true }));
  app.use(makeCors());

  app.get("/", (req, res) => {
    const rawSort = req.query.sort;
    const rawNsfw = req.query.nsfw;

    const sort = rawSort === "updated" || rawSort === "views"
      ? rawSort
      : undefined;
    const nsfw = rawNsfw === "yes" || rawNsfw === "no" ? rawNsfw : undefined;

    const results = getPosts({ sort, nsfw });
    const addQuery = makeQueryLinkHelper(req.query);

    const postCount = getPostCount();
    const viewCount = getViewCount();

    res.render("index", {
      results,
      postCount,
      viewCount,
      currentSort: sort,
      currentNsfw: nsfw,
      queries: {
        sort_views: addQuery({ sort: "views" }),
        sort_updated: addQuery({ sort: "updated" }),
        nsfw_toggle: addQuery({ nsfw: nsfw === "yes" ? "no" : "yes" }),
      },
    });
  });

  app.get("/post", (_, res) => {
    res.render("create-post", {
      captcha: choose(Object.values(captchas)),
    });
  });

  app.get("/post/random", (_, res) => {
    const post = randomPost();
    console.log("post id", post);
    if (!post) throw new Error("Found zero posts");
    return res.redirect(`/post/${post}`);
  });

  app.get("/post/:uuid", (req, res) => {
    res.send(req.params);
  });

  const isCaptchaId = (s: string): s is keyof typeof captchas => s in captchas;

  app.post("/post", makeLimiter(1, timeMs({ s: 15 })), (req, res) => {
    console.log(req.body);
    const parsed = createPostSchema.parse(req.body);
    console.log(parsed);
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

    const { captcha: _, solution: __, triggers, ...createOpts } = parsed;

    const created = createPost({
      ...createOpts,
      triggers: triggers.trim(),
    });
    return res.redirect(`/post/${created}`);
  });

  app.use(errorHandler);

  return app;
};

createApp().listen(config.httpPort).on("listening", () => {
  console.info(`Listening at http://0.0.0.0:${config.httpPort}`);
});
