import { z } from "zod";
import {
    addPostView,
    createComment,
    createPost,
    deletePost,
    getCommentsForPost,
    getCurrentEdition,
    getMigratedPostId,
    getPostById,
    randomPost,
    updatePost,
    updatePostEditCode,
} from "../db/mod.ts";
import { errors } from "../error.ts";
import { createCommentSchema, createPostSchema, postIdSchema } from "../schemas/mod.ts";
import { getClientIP, getPostTagString, makeQueryLinkHelper } from "../utils/mod.ts";
import { Request, Response } from "express";
import { timeMs } from "../utils/time.ts";
import { cap } from "./captcha.ts";
import { config } from "../config.ts";
import { hash, verify } from "@bronti/argon2";
import { editionMap, editions, editionSchema } from "../utils/editions.ts";
import {
    CaptchaError,
    IncorrectPassword,
    InvalidLink,
    NoPostsAvailable,
    PostNotFound,
    SessionExpired,
} from "../errors/posts.ts";

export const index = (_: Request, res: Response) => {
    res.render("create-post", {
        heading: "Create a post",
        whatsappUrl: config.whatsappUrl,
        editions,
        latestEdition: editions[1].id,
    });
};

export const random = (req: Request, res: Response) => {
    let edition: number | undefined;
    const editionQuery = req.query.edition;

    if (editionQuery === "current") {
        edition = getCurrentEdition();
    } else if (typeof editionQuery === "string") {
        const parsed = parseInt(editionQuery, 10);
        if (!isNaN(parsed)) {
            edition = parsed;
        }
    }

    const query = makeQueryLinkHelper(req.query);

    const post = randomPost(edition);
    if (!post) {
        return errors.render(res, ...NoPostsAvailable);
    }
    return res.redirect(
        `/post/${post}${query()}`,
    );
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
        return getMigratedPostId(id);
    }
    return null;
};

export const view = (req: Request, res: Response) => {
    if (!req.params.id) {
        return errors.render(res, ...InvalidLink);
    }
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
        return errors.render(res, ...PostNotFound);
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

    const { triggers, criticism, captcha: _, password, edition, ...createOpts } = parsed;

    const tags = {
        edition: { value: edition },
        criticism: { value: !!criticism },
    };

    const created = createPost({
        ...createOpts,
        password: password.length ? hash(password) : "",
        triggers: triggers.trim(),
        tags: getPostTagString(tags),
    });

    return res.redirect(`/post/${created}`);
};

const captchaErr = (res: Response) => errors.render(res, ...CaptchaError);

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
    password: z.string().min(1, { error: "Password is required to manage this post" }),
});

const updatePostSchema = z.object({
    action: z.enum(["update", "delete", "update_edit_code"], {
        error: "Invalid action. Must be 'update', 'delete', or 'update_edit_code'",
    }),
    session: z.uuidv4().refine(
        (v) => Object.keys(editSessions).includes(v),
        { error: "Looks like your editing session expired. Try again" },
    ),
    captcha: z.string().nonempty().optional(),
});

const postEditCodeAction = z.object({
    new_edit_code: z.string()
        .min(1, { error: "New edit code is required" })
        .max(100, { error: "Edit code cannot be longer than 100 characters" }),
    action: z.literal("update_edit_code"),
    captcha: z.string({ error: "Captcha is required." }),
});

const postModificationAction = z.object({
    title: z.string()
        .max(80, { error: "Title cannot be longer than 80 characters" })
        .default("")
        .transform((s) => s.trim()),
    triggers: z.string()
        .max(100, { error: "Notes text is too long (max 100 characters)" })
        .default("")
        .transform((s) => s.trim()),
    content: z.string()
        .nonempty({ error: "Content cannot be empty. Please enter your story" }),
    action: z.literal("update"),
    nsfw: z.string().default("").transform((s) => s === "yes" ? 1 : 0),
    edition: editionSchema,
    captcha: z.string({ error: "Captcha is required." }),
    criticism: z.string()
        .default("")
        .transform((s) => s === "yes" ? 1 : 0),
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
        return errors.render(res, ...PostNotFound);
    }

    if (
        post.password && post.password.length &&
        !verify(parsed.password, post.password)
    ) {
        return errors.render(res, ...IncorrectPassword);
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

export const update = async (req: Request, res: Response) => {
    Object.values(editSessions).forEach((sess) => {
        if (Date.now() - sess.started > timeMs({ m: 30 })) {
            delete editSessions[sess.session];
        }
    });

    const id = postIdSchema.parse(req.params.id);
    const parsed = updatePostSchema.parse(req.body);
    if (editSessions[parsed.session].post !== id) {
        return errors.render(res, ...SessionExpired);
    }

    delete editSessions[parsed.session];

    if (parsed.action === "delete") {
        const { success } = await cap.validateToken(parsed.captcha || "");
        if (!success) return captchaErr(res);

        deletePost(id);
        return res.redirect("/");
    } else if (parsed.action === "update") {
        const updated = postModificationAction.parse(req.body);

        const { success } = await cap.validateToken(updated.captcha);
        if (!success) return captchaErr(res);

        updatePost(id, {
            title: updated.title,
            triggers: updated.triggers,
            content: updated.content,
            nsfw: !!updated.nsfw,
            edition: updated.edition,
            criticism: updated.criticism,
        });
        return res.redirect(`/post/${id}`);
    } else if (parsed.action === "update_edit_code") {
        const editCodeUpdate = postEditCodeAction.parse(req.body);

        const { success } = await cap.validateToken(editCodeUpdate.captcha);
        if (!success) return captchaErr(res);

        updatePostEditCode(id, editCodeUpdate.new_edit_code);
        return res.redirect(`/post/${id}`);
    } else {
        throw new Error(
            "Something unexpected happened while updating your post. Please try again or contact support if the issue persists.",
        );
    }
};
