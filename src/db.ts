import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { createCommentSchema, createPostSchema } from "./schemas/mod.ts";
import { ulid } from "@std/ulid";

const db = new DatabaseSync("./writing-jam.db", {
  enableForeignKeyConstraints: true,
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
  on TEXT NOT NULL,
  content TEXT NOT NULL,
  nickname TEXT,
  created INTEGER NOT NULL,
  FOREIGN KEY (on) REFERENCES post(id) ON DELETE CASCADE
)`);

const createPostStmt = db.prepare(`INSERT INTO post (
    id,
    content,
    nsfw,
    password,
    triggers,
    title,
    nickname,
  ) VALUES (
    :id,
    :content,
    :nsfw,
    :password,
    :triggers,
    :title,
    :nickname,
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

const createCommentStmt = db.prepare(`\
INSERT INTO comment(
    id,
    on,
    content,
    nickname,
    created
) VALUES (
    :id,
    :on,
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
