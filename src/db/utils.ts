import { Post } from "../schemas/mod.ts";
import { hashPostId } from "../utils/mod.ts";

export interface GetPostOpts {
    sort?: "views" | "updated";
    nsfw?: "yes" | "no";
    page?: number;
    order?: "asc" | "desc";
    search?: string;
    edition?: number;
}

export interface PaginatedPosts {
    posts: Omit<Post, "content" | "reports" | "deleted">[];
    totalPages: number;
}

export const toPostShape = (row: Record<string, any>) => ({
    id: hashPostId(row.id),
    title: row.title,
    nsfw: !!row.nsfw,
    password: String(row.password || ""),
    triggers: String(row.triggers || ""),
    author: row.author,
    updated: Number(row.updated),
    views: Number(row.views),
    tags: JSON.parse(String(row.tags || "{}")),
});
