import { z } from "zod/v4";
import { createErrorMap } from "zod-validation-error/v4";
import { count } from "@wordpress/wordcount";
import { editionSchema } from "../utils/editions.ts";

z.config({
    customError: createErrorMap({
        includePath: true,
    }),
});

export const createPostSchema = z.object({
    title: z.string().default("").transform((s) => s.trim()),
    author: z.string().default("").transform((s) => s.trim()),
    triggers: z.string().default("").transform((s) => s.trim()),
    nsfw: z.string().default("").transform((s) => s === "yes" ? 1 : 0),
    content: z.string().nonempty().refine((v) => count(v, "words") >= 100, {
        error: "Your submission must have greater than or exactly 100 words!",
    }).transform((s) => s.trim()),
    password: z.string().default(""),
    captcha: z.string().nonempty(),
    edition: editionSchema.nonoptional(),
});

export interface Post {
    content: string;
    nsfw: boolean;
    password?: string;
    triggers?: string;
    title?: string;
    author?: string;
    views: number;
    reports: number;
    id: string;
    updated: number;
    deleted: boolean;
    tags: Record<string, {
        value: any;
        type?: "kv" | "badge";
    }>;
}

export const createCommentSchema = z.object({
    for: z.string(),
    content: z.string().nonempty().transform((s) => s.trim()),
    author: z.string().default("").transform((s) => s.trim()),
    captcha: z.string().nonempty(),
});

export interface Comment {
    id: string;
    for: string;
    content: string;
    author?: string;
    posted: number;
}

export const postIdSchema = z.string().length(8);
