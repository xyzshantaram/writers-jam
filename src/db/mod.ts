import { db } from "./db.ts";
import { getPostTagString, hashPostId, unhashPostId } from "../utils/mod.ts";
import { init } from "./init.ts";
import { createCommentSchema, Post } from "../schemas/mod.ts";
import { ulid } from "@std/ulid";
import { z } from "zod/v4";
import { hash } from "@bronti/argon2";
export { createPost, getCommentsForPost, getPostById, getPosts } from "./posts.ts";
export { getHomepageFeeds } from "./feeds.ts";
export { type Edition, getAllEditions } from "./editions.ts";
export * from "./admin.ts";

init(db);

const postCountQuery = db.prepare(
    "select distinct count(id) as count from post where deleted != 1",
);

export const getPostCount = () => {
    const res = postCountQuery.get();
    if (!res) {
        throw new Error(
            "Unable to retrieve post count. This should never happen, please report this on GitHub.",
        );
    }
    return res.count as number || 0;
};

export const aggViewCountQuery = db.prepare(
    "select sum(views) as count from post",
);

export const getViewCount = () => {
    const res = aggViewCountQuery.get();
    if (!res) {
        throw new Error(
            "Unable to retrieve aggregate view count. This should never happen, please report this on GitHub.",
        );
    }
    return res.count as number || 0;
};

const getEditionStmt = db.prepare(`
    SELECT MAX(id) as id FROM editions WHERE deleted = 0
`);

export const getCurrentEdition = () => {
    const editionRow = getEditionStmt.get();
    return (editionRow?.id || 0) as number;
};

const getMigratedPostIdQuery = db.prepare(`
    select new_id from post_id_map where ulid = ?
`);

export const getMigratedPostId = (ulid: string): string | null => {
    const result = getMigratedPostIdQuery.get(ulid);
    if (!result || !result.new_id) return null;
    return hashPostId(result.new_id as number);
};

const addPostViewStmt = db.prepare(
    "update post set views = views + 1 where id = ?",
);

export const addPostView = (id: string) => {
    addPostViewStmt.run(unhashPostId(id));
};

const createCommentStmt = db.prepare(`INSERT INTO comment (
    id, for, content, author, posted
) VALUES (
    :id, :for, :content, :author, :posted
)`);

export const createComment = (
    opts: Omit<z.infer<typeof createCommentSchema>, "captcha">,
) => {
    const posted = Date.now();
    const id = ulid();
    const params = { id, posted, ...opts, for: unhashPostId(opts.for) };
    createCommentStmt.run(params);

    return id;
};

const deletePostQuery = db.prepare(
    "update post set deleted = 1 where id = ?",
);

export const deletePost = (id: string) => {
    return deletePostQuery.run(unhashPostId(id));
};

const updatePostStmt = db.prepare(
    `UPDATE post
   SET title = :title, content = :content, triggers = :triggers, nsfw = :nsfw, updated = :updated, tags = :tags
   WHERE id = :id`,
);

const updatePostEditCodeStmt = db.prepare(
    `UPDATE post
   SET password = :password, updated = :updated
   WHERE id = :id`,
);

const getPostTagsStmt = db.prepare(`
  SELECT tags FROM post WHERE id = :id
`);

export const getPostTags = (id: number) => {
    const result = getPostTagsStmt.get({ id });
    if (!result) return null;
    return JSON.parse(String(result.tags || "{}"));
};

type UpdatePostArgs = Pick<Post, "title" | "content" | "triggers" | "nsfw"> & { edition: number };
const edJson = (ed: number) => ({ edition: { value: ed } });

export const updatePost = (
    hashedId: string,
    opts: UpdatePostArgs,
) => {
    const { title = "", content, triggers = "", nsfw, edition } = opts;
    const updated = Date.now();
    const id = unhashPostId(hashedId);
    const tags = getPostTagString(edJson(edition), getPostTags(id));

    return updatePostStmt.run({
        id,
        title,
        content,
        triggers,
        updated,
        tags,
        nsfw: nsfw ? 1 : 0,
    });
};

export const updatePostEditCode = (
    id: string,
    newPassword: string,
) => {
    const updated = Date.now();
    const password = newPassword.length ? hash(newPassword) : "";

    return updatePostEditCodeStmt.run({
        id: unhashPostId(id),
        password,
        updated,
    });
};

const randomPostQuery = db.prepare(
    "select id from post where deleted = 0 order by random() limit 1",
);

export const randomPost = () => {
    const res = randomPostQuery.get();
    if (!res) return null;
    return hashPostId(res.id as number);
};
