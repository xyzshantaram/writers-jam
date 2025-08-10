import express from "express";
import * as path from "@std/path";
import { makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { errorHandler } from "./error.ts";
import * as index from "./routes/index.ts";
import * as posts from "./routes/posts.ts";
import * as admin from "./routes/admin.ts";
import * as search from "./routes/search.ts";
import { timeMs } from "./utils/time.ts";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import * as captcha from "./routes/captcha.ts";
import { Post } from "./schemas/mod.ts";
import { editionMap } from "./utils/editions.ts";
import { parseMd } from "./utils/parse.ts";

const setupLiquid = (app: express.Express, timeAgo: TimeAgo) => {
    const liquid = new Liquid({ extname: ".liquid", jsTruthy: true });

    liquid.registerFilter("time_ago", (stamp: number) => {
        return timeAgo.format(new Date(stamp));
    });
    liquid.registerFilter("parse_md", parseMd);
    liquid.registerFilter("get_post_edition", (post: Post) => {
        return editionMap.get(post.tags.edition.value)?.name;
    });

    app.engine("liquid", liquid.express());
    app.set("view engine", "liquid");
    app.set("views", path.resolve("./templates"));
};

const createApp = () => {
    const app = express();

    app.use(express.static("./public"));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
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

    app.get("/posts", search.index);

    app.post(
        "/captcha/challenge",
        makeLimiter(1, timeMs({ s: 10 })),
        captcha.challenge,
    );

    app.post(
        "/captcha/redeem",
        makeLimiter(1, timeMs({ s: 10 })),
        captcha.redeem,
    );

    app.post("/post/:id/manage", posts.manage);
    app.post("/post/:id/update", posts.update);

    const withUrl = { whatsappUrl: config.whatsappUrl };

    app.get("/admin", admin.index);
    app.get("/terms", (_, res) => res.render("tos", withUrl));
    app.get("/privacy", (_, res) => res.render("privacy", withUrl));

    app.use(errorHandler);
    return app;
};

createApp().listen(config.httpPort).on("listening", () => {
    console.info(`Listening at http://0.0.0.0:${config.httpPort}`);
});
