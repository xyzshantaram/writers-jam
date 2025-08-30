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
    title: z.string()
        .min(1, { error: "Title cannot be empty" })
        .max(80, { error: "Title cannot be longer than 80 characters" })
        .default("")
        .transform((s) => s.trim()),
    author: z.string()
        .max(40, { error: "Author name cannot be longer than 40 characters" })
        .default("")
        .transform((s) => s.trim()),
    triggers: z.string()
        .max(200, { error: "Notes text is too long (max 200 characters)" })
        .default("")
        .transform((s) => s.trim()),
    nsfw: z.string()
        .default("")
        .transform((s) => s === "yes" ? 1 : 0),
    content: z.string()
        .nonempty({ error: "Content cannot be empty. Please enter your story" })
        .refine((v) => count(v, "words") >= 100, {
            error: "Your submission must have greater than or exactly 100 words",
        })
        .transform((s) => s.trim()),
    password: z.string().default(""),
    captcha: z.string()
        .nonempty({ error: "Captcha is required. Please solve the captcha" }),
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
    for: z.string()
        .min(1, { error: "Missing post reference: comment must have a parent post" })
        .transform((s) => s.trim()),
    content: z.string()
        .nonempty({ error: "Comment contents cannot be empty" })
        .transform((s) => s.trim()),
    author: z.string()
        .max(40, { message: "Author name cannot be longer than 40 characters" })
        .default("")
        .transform((s) => s.trim()),
    captcha: z.string()
        .nonempty({ message: "Captcha is required. Please solve the captcha" }),
});

export interface Comment {
    id: string;
    for: string;
    content: string;
    author?: string;
    posted: number;
}

export const postIdSchema = z.string().length(8, {
    message: "Invalid post ID. Post IDs must be 8 characters long.",
});

export * from "./admin.ts";
