import z from "zod/v4";
import { Comment, createPostSchema, Post } from "../schemas/mod.ts";
import { db } from "./db.ts";
import { hashPostId, unhashPostId } from "../utils/mod.ts";
import { GetPostOpts, PaginatedPosts, toPostShape } from "./utils.ts";

const createPostStmt = db.prepare(`INSERT INTO post (
    content, nsfw, password, triggers, title, author, updated, tags
  ) VALUES (
    :content, :nsfw, :password, :triggers, :title, :author, :updated, :tags
  )
  returning
    id
`);

export const createPost = (
    opts: Omit<z.infer<typeof createPostSchema>, "captcha" | "edition"> & {
        tags: string;
    },
) => {
    const updated = Date.now();

    const result = createPostStmt.get({
        updated,
        ...opts,
    });

    return hashPostId(result!.id as number);
};

function escapeFtsQuery(str?: string): string {
    if (!str) return "";
    // Match Unicode word characters using built-in JS regex
    const words = str.match(/\w+/gu) || [];
    return words.map((word) => word.toLowerCase()).join(" ");
}

export const getPosts = (
    opts?: GetPostOpts,
): PaginatedPosts => {
    // these are ensured to be safe by the caller
    const { sort = "updated", nsfw, page = 1, search, order = "desc", edition } = opts || {};
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const idMatch = (search || "").trim().match(
        /^(?:(?:https:\/\/)?writersjam.shantaram.xyz\/post\/)?([0-9a-fA-F]{8})$/,
    );
    if (idMatch) {
        const posts: Post[] = [];
        const post = getPostById(idMatch[1]);
        if (post) {
            posts.push(post);
            return {
                totalPages: 1,
                posts,
            };
        }
    }

    const conditions: string[] = ["p.deleted != 1"];
    if (nsfw !== "yes") {
        conditions.push("p.nsfw = 0");
    }

    const params: Record<string, string | number> = {};

    if (typeof edition === "number") {
        conditions.push("json_extract(p.tags, '$.edition.value') = :edition");
        params.edition = edition;
    }

    const fts = escapeFtsQuery(search?.trim());

    if (fts) {
        // 1. Add the MATCH condition to the conditions array instead of a separate clause.
        conditions.push("p.id IN (SELECT rowid FROM post_fts WHERE post_fts MATCH :fts)");
        params.fts = fts;
    }

    // 2. Build the WHERE clause once, after all conditions have been added.
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
        SELECT COUNT(p.id) as count
        FROM post p
        ${whereClause}`;

    const mainQuery = `
        SELECT p.id, p.title, p.nsfw, p.password, p.triggers, p.author, p.updated, p.views, p.tags
        FROM post p
        ${whereClause}
        ORDER BY p.${sort} ${order}
        LIMIT ${pageSize} OFFSET ${offset};
    `.trim();

    const countStmt = db.prepare(countQuery);
    const count = countStmt.get({ ...params }) as { count: number };

    const totalPages = Math.ceil(count.count / pageSize);
    const stmt = db.prepare(mainQuery);
    const rows = stmt.all({ ...params }) as any[];

    return { posts: rows.map(toPostShape), totalPages };
};

const postByIdQuery = db.prepare(`select
  id, content, nsfw, password, triggers, title, author, updated, reports, views, tags
from post where
  deleted = 0 and
  id = ?`);

export const getPostById = (id: string): Post | null => {
    const res = postByIdQuery.get(unhashPostId(id));
    if (!res) return null;

    return {
        ...toPostShape({ ...res, id }), // Pass in the original row + the hashed id
        content: String(res.content || ""),
        reports: Number(res.reports) || 0,
        deleted: res.deleted === 1,
    };
};

const getPostCommentsQuery = db.prepare(`select
  id, content, author, posted, for
from comment where
  for = ?
order by posted desc
`);

const getCommentByIdQuery = db.prepare(`select
  id, content, author, posted, for
from comment where
  id = ?
`);

export const getCommentsForPost = (id: string): Comment[] => {
    return getPostCommentsQuery.all(unhashPostId(id)).map((
        itm,
    ) => ({
        id: String(itm.id),
        content: String(itm.content),
        author: String(itm.author || "Anonymous"),
        posted: Number(itm.posted),
        for: id,
    }));
};

export const getCommentById = (id: string): Comment | null => {
    const res = getCommentByIdQuery.get(id);
    if (!res) return null;

    return {
        id: String(res.id),
        content: String(res.content),
        author: String(res.author || "Anonymous"),
        posted: Number(res.posted),
        for: hashPostId(res.for as number),
    };
};

const addPostViewStmt = db.prepare(
    "update post set views = views + 1 where id = ?",
);

export const addPostView = (id: string) => {
    addPostViewStmt.run(unhashPostId(id));
};
