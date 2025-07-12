import { DatabaseSync } from "node:sqlite";
import { z } from "zod/v4";
import { createCommentSchema, createPostSchema, Post } from "./schemas/mod.ts";
import { ulid } from "@std/ulid";

const db = new DatabaseSync("./writing-jam.db", {
  enableForeignKeyConstraints: true,
  readOnly: false,
});

db.exec(`\
CREATE TABLE IF NOT EXISTS post (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  nsfw BOOLEAN NOT NULL,
  password TEXT,
  triggers TEXT,
  title TEXT,
  nickname TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT 0
)`);

db.exec(`\
CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  for TEXT NOT NULL,
  content TEXT NOT NULL,
  nickname TEXT,
  created INTEGER NOT NULL,
  FOREIGN KEY (for) REFERENCES post(id) ON DELETE CASCADE
)`);

const createPostStmt = db.prepare(`INSERT INTO post (
    id,
    content,
    nsfw,
    password,
    triggers,
    title,
    nickname
  ) VALUES (
    :id,
    :content,
    :nsfw,
    :password,
    :triggers,
    :title,
    :nickname
  )`);

export const createPost = (opts: z.infer<typeof createPostSchema>) => {
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
    `SELECT id, title, nsfw, password, triggers, nickname, updated, views FROM post`;
  const conditions: string[] = [
    "deleted != 1",
  ];
  const params: Record<string, any> = {};

  if (nsfw === "yes") {
    conditions.push("nsfw = 1");
  } else if (nsfw === "no") {
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
      nickname: row.nickname as string,
      updated: Number(row.updated),
      views: Number(row.views),
    }));
};

const createCommentStmt = db.prepare(`\
INSERT INTO comment(
    id,
    for,
    content,
    nickname,
    created
) VALUES (
    :id,
    :for,
    :content,
    :nickname,
    :created
)
`);

export const createComment = (opts: z.infer<typeof createCommentSchema>) => {
  const updated = Date.now();
  const id = ulid();
  createCommentStmt.run({
    id,
    updated,
    ...opts,
  });
  return id;
};
