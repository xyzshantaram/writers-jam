import captchas from "../../data/captchas.json" with { type: "json" };
import { createPost, randomPost } from "../db.ts";
import { renderError } from "../error.ts";
import { createPostSchema } from "../schemas/mod.ts";
import { choose } from "../utils/mod.ts";
import { Request, Response } from "express";

export const index = (_: Request, res: Response) => {
  res.render("create-post", {
    captcha: choose(Object.values(captchas)),
  });
};

export const random = (_: Request, res: Response) => {
  const post = randomPost();
  console.log("post id", post);
  if (!post) throw new Error("Found zero posts");
  return res.redirect(`/post/${post}`);
};

export const view = (req: Request, res: Response) => {
  res.send(req.params);
};

const isCaptchaId = (s: string): s is keyof typeof captchas => s in captchas;

export const create = (req: Request, res: Response) => {
  console.log(req.body);
  const parsed = createPostSchema.parse(req.body);
  console.log(parsed);
  if (
    !isCaptchaId(parsed.captcha) ||
    captchas[parsed.captcha].answer !== parsed.solution
  ) {
    return renderError(res, {
      details: "Your solution to the captcha was incorrect. Please try again.",
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
};
