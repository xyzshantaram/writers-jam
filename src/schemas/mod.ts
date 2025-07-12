import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().optional(),
  nickname: z.string().optional(),
  triggers: z.string().optional(),
  nsfw: z.string().optional().transform((s) => s === "yes" ? 1 : 0),
  content: z.string().nonempty(),
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
  on: z.ulid(),
  content: z.string().nonempty(),
  nickname: z.string().optional(),
});

export interface Comment {
  id: string;
  on: string;
  content: string;
  nickname?: string;
  created: number;
}
