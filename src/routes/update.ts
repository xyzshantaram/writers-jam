import { Request, Response } from "@types/express";
import { deletePost, updatePost } from "../db.ts";
import { renderError } from "../error.ts";
import { postIdSchema } from "../schemas/mod.ts";
import { timeMs } from "../utils/time.ts";
import { editSessions, updatePostSchema } from "./posts.ts";


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
    });
    return res.redirect(`/post/${id}`);
  } else throw new Error("wtf");
};
