import { z } from "zod/v4";
import {
  addPostView,
  createComment,
  createPost,
  getCommentsForPost,
  getPostById,
  randomPost,
} from "../db.ts";
import { renderError } from "../error.ts";
import { createCommentSchema, createPostSchema } from "../schemas/mod.ts";
import { getClientIP } from "../utils/mod.ts";
import { Request, Response } from "express";
import { timeMs } from "../utils/time.ts";
import { cap } from "./captcha.ts";

export const index = (_: Request, res: Response) => {
  res.render("create-post");
};

export const random = (_: Request, res: Response) => {
  const post = randomPost();
  console.log("post id", post);
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

export const view = (req: Request, res: Response) => {
  const id = z.ulid().parse(req.params.id);

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
    post,
    heading: post.title && post.title.length
      ? `View post "${post.title}"`
      : "View post",
    comments: getCommentsForPost(post.id),
  });
};

export const create = async (req: Request, res: Response) => {
  const parsed = createPostSchema.parse(req.body);
  const { success } = await cap.validateToken(parsed.captcha);
  if (!success) return captchaErr(res);

  const { triggers, captcha: _, ...createOpts } = parsed;

  const created = createPost({
    ...createOpts,
    triggers: triggers.trim(),
  });
  return res.redirect(`/post/${created}`);
};

const captchaErr = (res: Response) =>
  renderError(res, {
    details: "Your solution to the captcha was incorrect. Please try again.",
    title: "Incorrect captcha.",
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
