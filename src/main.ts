import express from "express";
import * as path from "@std/path";
import { isAdmin, makeCors, makeLimiter } from "./utils/middleware.ts";
import { Liquid } from "liquidjs";
import { config } from "./config.ts";
import { errorHandler, errors } from "./error.ts";
import * as index from "./routes/index.ts";
import * as posts from "./routes/posts.ts";
import * as admin from "./routes/admin.ts";
import * as search from "./routes/search.ts";
import { getPostById } from "./db/mod.ts";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import * as captcha from "./routes/captcha.ts";
import { Post } from "./schemas/mod.ts";
import { editionMap, editions } from "./utils/editions.ts";
import { parseMd } from "../public/js/parse.js";
import { InvalidLink, PostNotFound } from "./errors/posts.ts";

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
    app.post("/post", makeLimiter({ n: 1, period: { s: 15 } }), posts.create);
    app.post(
        "/post/:id/comment",
        makeLimiter({ n: 1, period: { s: 15 } }),
        posts.addComment,
    );

    app.get("/posts", search.index);

    app.post(
        "/captcha/challenge",
        makeLimiter({ json: true, n: 5, period: { s: 2 } }),
        captcha.challenge,
    );

    app.post(
        "/captcha/redeem",
        makeLimiter({ json: true, n: 5, period: { s: 2 } }),
        captcha.redeem,
    );

    app.post("/post/:id/manage", posts.manage);
    app.post("/post/:id/update", posts.update);

    app.get("/api/v1/editions", (_, res) => {
        res.json({
            success: true,
            data: editions.filter((itm) => !itm.deleted),
        });
    });

    // Post API routes
    app.get("/api/v1/post/:id", (req, res) => {
        const { id } = req.params;
        try {
            const post = getPostById(id);
            if (!post) {
                return errors.json(res, { ...PostNotFound }, 404);
            }
            res.json({
                success: true,
                data: {
                    ...post,
                    password: undefined,
                    edition: editionMap.get(post.tags.edition.value),
                },
            });
        } catch {
            return errors.json(res, ...InvalidLink);
        }
    });

    // Admin API routes
    app.post(
        "/api/v1/admin/signup",
        makeLimiter({ n: 1, period: { s: 15 } }),
        admin.signup,
    );
    app.post("/api/v1/admin/signin", makeLimiter({ n: 1, period: { s: 5 } }), admin.signin);
    app.get("/api/v1/admin/whoami", isAdmin, admin.whoami);
    app.post("/api/v1/admin/codes", isAdmin, admin.createSignupCode);
    app.delete("/api/v1/admin/posts/:id", isAdmin, admin.deletePost);
    app.patch("/api/v1/admin/posts/:id/nsfw", isAdmin, admin.setPostNsfw);
    app.delete("/api/v1/admin/comments/:id", isAdmin, admin.deleteComment);
    app.get("/api/v1/admin/comments/:id", isAdmin, admin.getComment);
    app.post("/api/v1/admin/editions", isAdmin, admin.createEdition);
    app.post("/api/admin/v1/post/:id/reset-edit-code", isAdmin, admin.resetPostEditCode);
    app.get(
        "/api/v1/admin/moderation-log",
        makeLimiter({ json: true, n: 10, period: { s: 5 } }),
        isAdmin,
        admin.getModerationLog,
    );

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
