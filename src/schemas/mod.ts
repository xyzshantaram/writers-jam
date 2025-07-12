import { z } from "zod/v4";
import { createErrorMap } from "zod-validation-error/v4";
import { count } from "@wordpress/wordcount";

z.config({
  customError: createErrorMap({
    includePath: true,
  }),
});

export const createPostSchema = z.object({
  title: z.string().optional(),
  nickname: z.string().optional(),
  triggers: z.string().optional(),
  nsfw: z.string().optional().transform((s) => s === "yes" ? 1 : 0),
  content: z.string().nonempty().refine((v) => count(v, "words") < 100, {
    error: "Your submission must have greater than or exactly 100 words!",
  }),
  password: z.string().optional(),
});

export interface Post {
  content: string;
  nsfw: boolean;
  password?: string;
  triggers?: string;
  title?: string;
  nickname?: string;
  views: number;
  reports: number;
  id: string;
  updated: number;
  deleted: boolean;
}

export const createCommentSchema = z.object({
  for: z.ulid(),
  content: z.string().nonempty(),
  nickname: z.string().optional(),
});

export interface Comment {
  id: string;
  for: string;
  content: string;
  nickname?: string;
  created: number;
}
