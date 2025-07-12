import { string, uuid, z } from "zod";

export const createPostSchema = z.object({
  title: string().optional(),
  nickname: string().optional(),
  trigger_warnings: string().optional(),
  is_nsfw: string().optional().transform((s) => s === "yes"),
  content: string(),
  password: string().optional(),
});

export interface Post {
  content: boolean;
  nsfw: boolean;
  password?: string;
  triggers?: string;
  title?: string;
  nickname?: string;
  views: number;
  reports: number;
  id: string;
}
