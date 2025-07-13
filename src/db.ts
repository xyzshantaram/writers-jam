import { DatabaseSync } from "node:sqlite";
import { z } from "zod/v4";
import {
  Comment,
  createCommentSchema,
  createPostSchema,
  Post,
} from "./schemas/mod.ts";
import { ulid } from "@std/ulid";

const db = new DatabaseSync("./writing-jam.db", {
  enableForeignKeyConstraints: true,
  readOnly: false,
});

db.exec("PRAGMA journal_mode=WAL");

db.exec(`\
CREATE TABLE IF NOT EXISTS post (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  nsfw BOOLEAN NOT NULL,
  password TEXT,
  triggers TEXT,
  title TEXT,
  author TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT 0
)`);

db.exec(`CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  for TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT,
  posted INTEGER NOT NULL,
  FOREIGN KEY (for) REFERENCES post(id) ON DELETE CASCADE
)`);

const createPostStmt = db.prepare(`INSERT INTO post (
    id,
    content,
    nsfw,
    password,
    triggers,
    title,
    author,
    updated
  ) VALUES (
    :id,
    :content,
    :nsfw,
    :password,
    :triggers,
    :title,
    :author,
    :updated
  )`);

export const createPost = (
  opts: Omit<z.infer<typeof createPostSchema>, "captcha" | "solution">,
) => {
  const updated = Date.now();
  const id = ulid();

  createPostStmt.run({
    id,
    updated,
    ...opts,
  });
  return id;
};

interface GetPostOpts {
  sort?: "views" | "updated";
  nsfw?: "yes" | "no";
}

export const getPosts = (
  opts?: GetPostOpts,
): Omit<Post, "content" | "reports" | "deleted">[] => {
  const { sort, nsfw } = opts || {};
  let query =
    `SELECT id, title, nsfw, password, triggers, author, updated, views FROM post`;
  const conditions: string[] = [
    "deleted != 1",
  ];
  const params: Record<string, any> = {};

  if (nsfw !== "yes") {
    conditions.push("nsfw = 0");
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  if (sort === "views") {
    query += " ORDER BY views DESC";
  } else {
    query += " ORDER BY updated DESC";
  }

  const stmt = db.prepare(query);

  return stmt.all(params)
    .map((row) => ({
      id: row.id as string,
      title: row.title as string,
      nsfw: !!row.nsfw,
      password: row.password as string | undefined,
      triggers: row.triggers as string | undefined,
      author: row.author as string,
      updated: Number(row.updated),
      views: Number(row.views),
    }));
};

const createCommentStmt = db.prepare(`INSERT INTO comment (
    id,
    for,
    content,
    author,
    posted
) VALUES (
    :id,
    :for,
    :content,
    :author,
    :posted
)
`);

export const createComment = (
  opts: Omit<z.infer<typeof createCommentSchema>, "captcha" | "solution">,
) => {
  const posted = Date.now();
  const id = ulid();

  console.log(opts);

  createCommentStmt.run({
    id,
    posted,
    ...opts,
  });
  return id;
};

const randomPostQuery = db.prepare(
  "select id from post where deleted = 0 order by random() limit 1",
);

export const randomPost = () => {
  const res = randomPostQuery.get();
  if (!res) return null;
  return res.id as string;
};

const postCountQuery = db.prepare(
  "select distinct count(id) as count from post",
);

export const getPostCount = () => {
  const res = postCountQuery.get();
  if (!res) throw new Error("This should never happen");
  return res.count || 0 as number;
};

const aggViewCountQuery = db.prepare(
  "select sum(views) as count from post",
);

export const getViewCount = () => {
  const res = aggViewCountQuery.get();
  if (!res) throw new Error("This should never happen");
  return res.count || 0 as number;
};

const postByIdQuery = db.prepare(`select
  id,
  content,
  nsfw,
  password,
  triggers,
  title,
  author,
  updated,
  reports,
  views
from post where
  deleted = 0 and
  id = ?`);

export const getPostById = (id: string): Post | null => {
  const res = postByIdQuery.get(id);
  if (!res) return null;
  return {
    content: res.content as string,
    nsfw: !!res.nsfw,
    views: Number(res.views) || 0,
    reports: Number(res.reports) || 0,
    id,
    updated: Number(res.updated) || NaN,
    deleted: false,
    author: String(res.author || ""),
    password: String(res.password || ""),
    title: String(res.title || ""),
    triggers: String(res.triggers || ""),
  };
};

const getPostCommentsQuery = db.prepare(`select
  id,
  content,
  author,
  posted,
  for
from comment where
  for = ?
order by posted desc
`);

export const getCommentsForPost = (id: string): Comment[] => {
  return getPostCommentsQuery.all(id).map((itm) => (console.log(itm), {
    id: String(itm.id),
    content: String(itm.content),
    author: String(itm.author || "Anonymous"),
    posted: Number(itm.posted),
    for: id,
  }));
};

const addPostStmt = db.prepare(
  "update post set views = views + 1 where id = ?",
);

export const addPostView = (id: string) => {
  addPostStmt.run(id);
};
