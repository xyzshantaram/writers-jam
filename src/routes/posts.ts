import { z } from "zod/v4";
import {
    addPostView,
    createComment,
    createPost,
    deletePost,
    getCommentsForPost,
    getNewPostId,
    getPostById,
    randomPost,
    updatePost,
} from "../db.ts";
import { renderError } from "../error.ts";
import { createCommentSchema, createPostSchema, postIdSchema } from "../schemas/mod.ts";
import { getClientIP, getPostTagString } from "../utils/mod.ts";
import { Request, Response } from "express";
import { timeMs } from "../utils/time.ts";
import { cap } from "./captcha.ts";
import { config } from "../config.ts";
import { hash, verify } from "@bronti/argon2";
import { editionMap, editions, editionSchema } from "../utils/editions.ts";

export const index = (_: Request, res: Response) => {
    res.render("create-post", {
        heading: "Create a post",
        whatsappUrl: config.whatsappUrl,
        editions,
        latestEdition: editions[1].id,
    });
};

export const random = (_: Request, res: Response) => {
    const post = randomPost();
    if (!post) throw new Error("Found zero posts");
    return res.redirect(`/post/${post}`);
};

const postViewsByIp: Record<string, Record<string, number>> = {};

const shouldCountView = (now: number, post: string, ip: string) => {
    postViewsByIp[post] ||= {};

    const last = postViewsByIp[post][ip];
    if (last !== undefined && now - last < timeMs({ m: 15 })) {
        return false;
    }

    postViewsByIp[post][ip] = now;
    return true;
};

const normalizeId = (id: string): string | null => {
    const result = z.ulid().safeParse(id);
    if (result.success) {
        return getNewPostId(id);
    }
    return null;
};

export const view = (req: Request, res: Response) => {
    if (!req.params.id) throw new Error("Invalid id");
    const id = req.params.id;

    const replacedId = normalizeId(id);
    if (replacedId) {
        return res.redirect(`/post/${replacedId}`);
    }

    const ip = getClientIP(req);
    if (!ip || shouldCountView(Date.now(), id, ip)) {
        addPostView(id);
    }

    const post = getPostById(id);
    if (!post) {
        return renderError(res, {
            code: 400,
            details:
                "The post with the given ID was not found. It may have been deleted or you may have followed a broken link.",
            name: "NotFound",
            title: "Post not found",
        });
    }
    
    res.render("view-post", {
        post: { ...post, edition: editionMap.get(post.tags.edition.value) },
        title: post.title && post.title.length
            ? `View post “${post.title}” by ${post.author || "Anonymous"}`
            : "View post",
        heading: post.title,
        comments: getCommentsForPost(post.id),
        whatsappUrl: config.whatsappUrl,
    });
};

export const create = async (req: Request, res: Response) => {
    const parsed = createPostSchema.parse(req.body);
    const { success } = await cap.validateToken(parsed.captcha);
    if (!success) return captchaErr(res);

    const { triggers, captcha: _, password, edition, ...createOpts } = parsed;

    const created = createPost({
        ...createOpts,
        password: password.length ? hash(password) : "",
        triggers: triggers.trim(),
        tags: getPostTagString({ edition: { value: edition } }),
    });
    return res.redirect(`/post/${created}`);
};

const captchaErr = (res: Response) =>
    renderError(res, {
        details: "The captcha expired. Please try again.",
        title: "Invalid captcha.",
        name: "Captcha",
    });

export const addComment = async (req: Request, res: Response) => {
    const parsed = createCommentSchema.parse(req.body);
    const { success } = await cap.validateToken(parsed.captcha);
    if (!success) return captchaErr(res);

    const { captcha: _, ...opts } = parsed;
    createComment(opts);
    res.redirect(`/post/${parsed.for}`);
};

const editSessions: Record<string, {
    session: string;
    started: number;
    post: string;
}> = {};

const manageSchema = z.object({
    password: z.string().nonempty(),
});

const updatePostSchema = z.object({
    action: z.enum(["update", "delete"]),
    session: z.uuidv4().refine(
        (v) => Object.keys(editSessions).includes(v),
        "Looks like your editing session expired. Try again.",
    ),
});

const postModificationAction = z.object({
    title: z.string().default(""),
    triggers: z.string().default(""),
    content: z.string(),
    action: z.literal("update"),
    nsfw: z.string().default("").transform((s) => s === "yes" ? 1 : 0),
    edition: editionSchema,
});

export const manage = (req: Request, res: Response) => {
    Object.values(editSessions).forEach((sess) => {
        if (Date.now() - sess.started > timeMs({ m: 30 })) {
            delete editSessions[sess.session];
        }
    });

    const parsed = manageSchema.parse(req.body);
    const id = postIdSchema.parse(req.params.id);
    const post = getPostById(id);
    if (!post) {
        return renderError(res, {
            code: "NotFound",
            details:
                "The post with the given ID was not found. It may have been deleted or you may have followed a broken link.",
            name: "Not found",
            title: "Post not found",
        });
    }

    if (
        post.password && post.password.length &&
        !verify(parsed.password, post.password)
    ) {
        return renderError(res, {
            code: "BadRequest",
            details: "There was an error processing your request. Please try again later.",
        });
    }

    const session = crypto.randomUUID();
    editSessions[session] = {
        session,
        started: Date.now(),
        post: id,
    };

    res.render("create-post", {
        mode: "edit",
        heading: "Edit post",
        post,
        session,
        whatsappUrl: config.whatsappUrl,
        editions,
        currentEdition: post?.tags?.edition?.value,
    });
};

export const update = (req: Request, res: Response) => {
    Object.values(editSessions).forEach((sess) => {
        if (Date.now() - sess.started > timeMs({ m: 30 })) {
            delete editSessions[sess.session];
        }
    });

    const id = postIdSchema.parse(req.params.id);
    const parsed = updatePostSchema.parse(req.body);
    if (editSessions[parsed.session].post !== id) {
        return renderError(res, { code: "BadRequest" });
    }

    delete editSessions[parsed.session];

    if (parsed.action === "delete") {
        deletePost(id);
        return res.redirect("/");
    } else if (parsed.action === "update") {
        const updated = postModificationAction.parse(req.body);
        updatePost(id, {
            title: updated.title,
            triggers: updated.triggers,
            content: updated.content,
            nsfw: !!updated.nsfw,
            edition: updated.edition,
        });
        return res.redirect(`/post/${id}`);
    } else throw new Error("wtf");
};
