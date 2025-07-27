import { DatabaseSync } from "node:sqlite";
import { z } from "zod/v4";
import { Comment, createCommentSchema, createPostSchema, Post } from "./schemas/mod.ts";
import { ulid } from "@std/ulid";
import { cache, choose, getPostTagString, hashPostId, unhashPostId } from "./utils/mod.ts";
import { timeMs } from "./utils/time.ts";

const db = new DatabaseSync("./writers-jam.db", {
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

db.exec(`CREATE TABLE IF NOT EXISTS post_id_map (
  ulid TEXT PRIMARY KEY,
  new_id INTEGER UNIQUE NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO editions (id, name) VALUES (0, 'No edition');
`);

db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS post_fts USING fts5(
  content,
  title,
  author,
  content='post',
  content_rowid='id',
  tokenize = 'porter unicode61'
);

-- AFTER INSERT: mirror the insert
CREATE TRIGGER IF NOT EXISTS post_ai AFTER INSERT ON post BEGIN
  INSERT INTO post_fts(rowid, content, title, author)
  VALUES (new.id, new.content, new.title, new.author);
END;

CREATE TRIGGER IF NOT EXISTS post_au  AFTER UPDATE OF content, title, author, deleted ON post BEGIN
  -- always remove from FTS
  DELETE FROM post_fts WHERE rowid = old.id;

  -- reinsert only if not deleted
  INSERT INTO post_fts(rowid, content, title, author)
  SELECT new.id, new.content, new.title, new.author
  WHERE new.deleted = 0;
END;

-- AFTER DELETE: mirror the delete
CREATE TRIGGER IF NOT EXISTS post_ad AFTER DELETE ON post BEGIN
  DELETE FROM post_fts WHERE rowid = old.id;
END;`);

const createPostStmt = db.prepare(`INSERT INTO post (
    content,
    nsfw,
    password,
    triggers,
    title,
    author,
    updated,
    tags
  ) VALUES (
    :content,
    :nsfw,
    :password,
    :triggers,
    :title,
    :author,
    :updated,
    :tags
  )
  returning
    id`);

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

interface GetPostOpts {
    sort?: "views" | "updated";
    nsfw?: "yes" | "no";
    page?: number;
    order?: "asc" | "desc";
    search?: string;
    edition?: number;
}

interface PaginatedPosts {
    posts: Omit<Post, "content" | "reports" | "deleted">[];
    totalPages: number;
}

export const getPosts = (
    opts?: GetPostOpts,
): PaginatedPosts => {
    const { sort = "updated", nsfw, page = 1, search, order = "desc", edition } = opts || {};
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ["p.deleted != 1"];
    if (nsfw !== "yes") {
        conditions.push("p.nsfw = 0");
    }

    if (typeof edition === "number") {
        conditions.push(`json_extract(p.tags, '$.edition.value') = ${edition}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    let joinClause = "";
    let searchClause = "";
    let countQuery = "";
    let mainQuery = "";

    if (search && search.trim() !== "") {
        // Join post_fts on post.id
        joinClause = `JOIN post_fts fts ON fts.rowid = p.id`;
        searchClause = `AND post_fts MATCH ?`;

        countQuery = `
      SELECT COUNT(*) as count
      FROM post p
      ${joinClause}
      ${whereClause}
      ${searchClause}
    `;

        mainQuery = `
      SELECT p.id, p.title, p.nsfw, p.password, p.triggers, p.author, p.updated, p.views, p.tags
      FROM post p
      ${joinClause}
      ${whereClause}
      ${searchClause}
    `;
    } else {
        countQuery = `
      SELECT COUNT(*) as count
      FROM post p
      ${whereClause}
    `;

        mainQuery = `
      SELECT p.id, p.title, p.nsfw, p.password, p.triggers, p.author, p.updated, p.views, p.tags
      FROM post p
      ${whereClause}
    `;
    }

    mainQuery += sort === "views" ? ` ORDER BY p.views ${order}` : ` ORDER BY p.updated ${order}`;
    mainQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const countStmt = db.prepare(countQuery);
    const count = search && search.trim() !== ""
        ? (countStmt.get(search) as { count: number }).count
        : (countStmt.get() as { count: number }).count;

    const totalPages = Math.ceil(count / pageSize);

    const stmt = db.prepare(mainQuery);
    const rows = search && search.trim() !== "" ? stmt.all(search) : stmt.all();

    const posts = rows.map((row) => ({
        id: hashPostId(row.id as number),
        title: row.title as string,
        nsfw: !!row.nsfw,
        password: String(row.password || ""),
        triggers: String(row.triggers || ""),
        author: row.author as string,
        updated: Number(row.updated),
        views: Number(row.views),
        tags: JSON.parse(String(row.tags || "{}")),
    }));

    return { posts, totalPages };
};

const homePageSelectFields = `
  p.id, p.title, p.nsfw, p.password, p.triggers,
  p.author, p.updated, p.views, p.tags
`;

const latestStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1 AND p.nsfw = 0
  ORDER BY p.updated DESC
  LIMIT 15
`);

const mostViewedStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1 AND p.nsfw = 0
  ORDER BY p.views DESC
  LIMIT 15
`);

const sleptOnStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  LEFT JOIN (
    SELECT "for", COUNT(*) AS comment_count
    FROM comment
    GROUP BY "for"
  ) c ON c."for" = p.id
  WHERE p.deleted != 1 AND p.nsfw = 0
    AND (IFNULL(p.views, 0) < 15 OR IFNULL(c.comment_count, 0) < 2)
  ORDER BY RANDOM()
  LIMIT 5
`);

const editionStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1 AND p.nsfw = 0
    AND json_extract(p.tags, '$.edition.value') = ?
  ORDER BY RANDOM()
  LIMIT 5
`);

export const getCurrentEdition = () => {
    const editionRow = db.prepare(`
    SELECT MAX(id) as id FROM editions WHERE deleted = 0
  `).get();
    return (editionRow?.id || 0) as number;
};

const getHomepageFeedsInternal = (): {
    latest: ReturnType<typeof getPosts>["posts"];
    sleptOn: ReturnType<typeof getPosts>["posts"];
    currentEdition: ReturnType<typeof getPosts>["posts"];
    mostViewed: ReturnType<typeof getPosts>["posts"];
} => {
    const latestRows = choose(latestStmt.all(), 5);
    const mostViewedRows = choose(mostViewedStmt.all(), 5);
    const sleptOnRows = sleptOnStmt.all();
    const editionRows = editionStmt.all(getCurrentEdition());

    const mapRow = (row: any) => ({
        id: hashPostId(row.id as number),
        title: row.title as string,
        nsfw: !!row.nsfw,
        password: String(row.password || ""),
        triggers: String(row.triggers || ""),
        author: row.author as string,
        updated: Number(row.updated),
        views: Number(row.views),
        tags: JSON.parse(String(row.tags || "{}")),
    });

    return {
        latest: latestRows.map(mapRow),
        sleptOn: sleptOnRows.map(mapRow),
        currentEdition: editionRows.map(mapRow),
        mostViewed: mostViewedRows.map(mapRow),
    };
};

export const getHomepageFeeds = cache(getHomepageFeedsInternal, timeMs({ m: 10 }));

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
    opts: Omit<z.infer<typeof createCommentSchema>, "captcha">,
) => {
    const posted = Date.now();
    const id = ulid();

    createCommentStmt.run({
        id,
        posted,
        ...opts,
        for: unhashPostId(opts.for),
    });
    return id;
};

const randomPostQuery = db.prepare(
    "select id from post where deleted = 0 order by random() limit 1",
);

export const randomPost = () => {
    const res = randomPostQuery.get();
    if (!res) return null;
    return hashPostId(res.id as number);
};

const postCountQuery = db.prepare(
    "select distinct count(id) as count from post where deleted != 1",
);

export const getPostCount = () => {
    const res = postCountQuery.get();
    if (!res) throw new Error("This should never happen");
    return res.count as number || 0;
};

const aggViewCountQuery = db.prepare(
    "select sum(views) as count from post",
);

export const getViewCount = () => {
    const res = aggViewCountQuery.get();
    if (!res) throw new Error("This should never happen");
    return res.count as number || 0;
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
  views,
  tags
from post where
  deleted = 0 and
  id = ?`);

export const getPostById = (id: string): Post | null => {
    const res = postByIdQuery.get(unhashPostId(id));
    if (!res) return null;
    return {
        content: res.content as string,
        nsfw: !!res.nsfw,
        views: Number(res.views) || 0,
        reports: Number(res.reports) || 0,
        id,
        updated: Number(res.updated) || NaN,
        deleted: res.deleted === 1 ? true : false,
        author: String(res.author || ""),
        password: String(res.password || ""),
        title: String(res.title || ""),
        triggers: String(res.triggers || ""),
        tags: JSON.parse(String(res.tags || "{}")),
    };
};

const getNewPostIdQuery = db.prepare(`select
  new_id
from 
  post_id_map
where
  ulid = ?
`);

export const getNewPostId = (ulid: string): string | null => {
    const result = getNewPostIdQuery.get(ulid);
    if (!result || !result.new_id) return null;
    return hashPostId(result.new_id as number);
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

const addPostViewStmt = db.prepare(
    "update post set views = views + 1 where id = ?",
);

export const addPostView = (id: string) => {
    addPostViewStmt.run(unhashPostId(id));
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

const getPostTagsStmt = db.prepare(`
  SELECT tags FROM post WHERE id = :id
`);

export const getPostTags = (id: number) => {
    const result = getPostTagsStmt.get({ id });
    if (!result) return null;
    return JSON.parse(String(result.tags || "{}"));
};

export const updatePost = (id: string, {
    title,
    content,
    triggers,
    nsfw,
    edition,
}: {
    title: string;
    content: string;
    triggers?: string;
    nsfw: boolean;
    edition: number;
}) => {
    const updated = Date.now();
    const rawId = unhashPostId(id);
    return updatePostStmt.run({
        id: rawId,
        title,
        content,
        triggers: triggers || "",
        nsfw: nsfw ? 1 : 0,
        updated,
        tags: getPostTagString({ edition: { value: edition } }, getPostTags(rawId)),
    });
};

export type Edition = {
    id: number;
    name: string;
    deleted: boolean;
};

export const getAllEditions = (): Edition[] => {
    const stmt = db.prepare(`
    SELECT id, name, deleted
    FROM editions
    ORDER BY id DESC
  `);
    return stmt.all() as unknown as Edition[];
};

export const createEdition = (name: string): Edition => {
    const insertStmt = db.prepare(`
    INSERT INTO editions (name)
    VALUES (?)
  `);
    const info = insertStmt.run(name);

    const selectStmt = db.prepare(`
    SELECT id, name, deleted
    FROM editions
    WHERE id = ?
  `);

    return selectStmt.get(info.lastInsertRowid as number) as unknown as Edition;
};

export const deleteEdition = (id: number): void => {
    const stmt = db.prepare(`
    UPDATE editions
    SET deleted = 1
    WHERE id = ?
  `);
    stmt.run(id);
};
