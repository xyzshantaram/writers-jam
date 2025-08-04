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

const postPreviewRowMapper = (row: Record<string, any>) => ({
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

    return { posts: rows.map(postPreviewRowMapper), totalPages };
};

const homePageSelectFields = `
  p.id, p.title, p.nsfw, p.password, p.triggers,
  p.author, p.updated, p.views, p.tags
`;

const recentUpdatedStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
  ORDER BY p.updated DESC
  LIMIT 20
`);

const mostViewedStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
  ORDER BY p.views DESC
  LIMIT 20
`);

const sleptOnStmt = db.prepare(`
      SELECT ${homePageSelectFields}, IFNULL(c.comment_count, 0) as comment_count
      FROM post p
      LEFT JOIN (
        SELECT "for", COUNT(*) AS comment_count
        FROM comment
        GROUP BY "for"
      ) c ON c."for" = p.id
      WHERE p.deleted != 1
        AND (IFNULL(p.views, 0) <= ? OR IFNULL(c.comment_count, 0) <= ?)
      ORDER BY RANDOM()
      LIMIT 15
`);

const editionStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
    AND json_extract(p.tags, '$.edition.value') = ?
  ORDER BY RANDOM()
  LIMIT 10
`);

export const getCurrentEdition = () => {
    const editionRow = db.prepare(`
    SELECT MAX(id) as id FROM editions WHERE deleted = 0
  `).get();
    return (editionRow?.id || 0) as number;
};

const sleptOnThresholds = [
    { views: 20, comments: 3 },
    { views: 50, comments: 5 },
    { views: 100, comments: 10 },
    { views: 200, comments: 20 },
];

const getHomepageFeedsInternal = (): {
    latest: ReturnType<typeof getPosts>["posts"];
    sleptOn: ReturnType<typeof getPosts>["posts"];
    currentEdition: ReturnType<typeof getPosts>["posts"];
    mostViewed: ReturnType<typeof getPosts>["posts"];
} => {
    const editionRows = editionStmt.all(getCurrentEdition());
    const editionIds = new Set(editionRows.map((p) => p.id));

    let sleptOnCandidates: any[] = [];

    for (const { views, comments } of sleptOnThresholds) {
        sleptOnCandidates = sleptOnStmt.all(views, comments)
            .filter((p) => !editionIds.has(p.id));

        if (sleptOnCandidates.length >= 5) break;
    }

    const sleptOnRows = choose(sleptOnCandidates, 5);
    const sleptOnIds = new Set(sleptOnRows.map((p) => p.id));

    const recentUpdatedCandidates = recentUpdatedStmt.all()
        .filter((p) => !editionIds.has(p.id) && !sleptOnIds.has(p.id));
    const latestRows = choose(recentUpdatedCandidates, 5);
    const latestIds = new Set(latestRows.map((p) => p.id));

    const mostViewedCandidates = mostViewedStmt.all()
        .filter((p) =>
            !editionIds.has(p.id) &&
            !sleptOnIds.has(p.id) &&
            !latestIds.has(p.id)
        );
    const mostViewedRows = choose(mostViewedCandidates, 5);

    return {
        currentEdition: editionRows.length > 5
            ? choose(editionRows, 5).map(postPreviewRowMapper)
            : editionRows.map(postPreviewRowMapper),

        sleptOn: sleptOnRows.map(postPreviewRowMapper),
        latest: latestRows.map(postPreviewRowMapper),
        mostViewed: mostViewedRows.map(postPreviewRowMapper),
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
