import { hashPostId, unhashPostId } from "../utils/mod.ts";
import { db } from "./db.ts";
import { getPostById } from "./mod.ts";
import { getCommentById } from "./mod.ts";
// import MODERATION_LOG_TEST from "../../moderation_log_fixture.json" with { type: "json" };

db.exec(`
create table if not exists admin_codes(
    code integer primary key,
    created_at integer
);

create table if not exists admins(
    username text primary key,
    password text not null,
    created_at integer
);

create table if not exists moderation_log(
    id integer primary key autoincrement,
    admin_username text not null,
    action_type text not null,
    target_type text not null,
    target_id text not null,
    target_title text,
    details text,
    created_at integer not null,
    foreign key (admin_username) references admins(username)
)`);

const createCodeQuery = db.prepare(`
    insert into admin_codes(
        code,
        created_at
    )
    values (
        abs(random() % 4294967296),
        cast(strftime('%s', 'now') as integer)
    )
    returning 
        code
`);

export const createAdminCode = () => {
    const { code } = createCodeQuery.get()!;
    return hashPostId(code as number);
};

const cleanupQuery = db.prepare(`
    DELETE FROM admin_codes
    WHERE strftime('%s','now') - created_at > 1800; 
`);

const isValidCodeQuery = db.prepare(`
    SELECT 1 FROM admin_codes
    WHERE code = ?
`);

export const isValidCode = (code: string) => {
    cleanupQuery.run();
    return !!isValidCodeQuery.get(unhashPostId(code));
};

const deletionQuery = db.prepare(`
    DELETE FROM admin_codes
    where code = ?    
`);

export const deleteCode = (code: string) => {
    deletionQuery.run(code);
};

const createAdminQuery = db.prepare(`
    insert into admins(
        username,
        password,
        created_at
    )
    values (
        ?,
        ?,
        cast(strftime('%s', 'now') as integer)
    )
`);

export const createAdmin = (username: string, hashedPassword: string) => {
    createAdminQuery.run(username, hashedPassword);
};

const getAdminQuery = db.prepare(`
    select username, password from admins
    where username = ?
`);

export interface AdminUser {
    username: string;
    password: string;
}

export interface ModerationLogEntry {
    id: number;
    admin_username: string;
    action_type: string;
    target_type: string;
    target_id: string;
    target_title?: string;
    details?: string;
    created_at: number;
}

export interface ModerationLogResponse {
    logs: ModerationLogEntry[];
    total: number;
    page: number;
}

export const getAdmin = (username: string): AdminUser | undefined => {
    const result = getAdminQuery.get(username);
    if (!result) return undefined;
    return {
        username: result.username as string,
        password: result.password as string,
    };
};

const initCode = () => {
    const { count } = db.prepare(`select count(username) as count from admins`).get()!;
    if (count !== null && typeof count !== "undefined" && count === 0) {
        const code = createAdminCode();
        console.info(`No admins found. Created admin code ${code}`);
    }
};

const adminDeletePostStmt = db.prepare(`
    UPDATE post 
    SET deleted = 1 
    WHERE id = ?
`);

export const adminDeletePost = (id: string, adminUsername: string) => {
    const post = getPostById(id);
    if (!post) return;

    adminDeletePostStmt.run(unhashPostId(id));

    logModerationAction(
        adminUsername,
        "delete",
        "post",
        id,
        post.title,
    );
};

const adminSetPostNsfwStmt = db.prepare(`
    UPDATE post 
    SET nsfw = ? 
    WHERE id = ?
`);

export const adminSetPostNsfw = (id: string, nsfw: boolean, adminUsername: string) => {
    const post = getPostById(id);
    if (!post) return;

    adminSetPostNsfwStmt.run(nsfw ? 1 : 0, unhashPostId(id));

    // Log the action if admin username is provided
    logModerationAction(
        adminUsername,
        nsfw ? "mark_nsfw" : "unmark_nsfw",
        "post",
        id,
        post.title,
    );
};

const adminDeleteCommentStmt = db.prepare(`
    DELETE FROM comment 
    WHERE id = ?
`);

export const adminDeleteComment = (id: string, adminUsername: string) => {
    // Get comment details for logging before deletion
    const comment = getCommentById(id);
    if (!comment) return;

    adminDeleteCommentStmt.run(id);
    logModerationAction(
        adminUsername,
        "delete",
        "comment",
        id,
        undefined,
        comment.content,
    );
};

// Moderation log functions
const logModerationActionStmt = db.prepare(`
    INSERT INTO moderation_log (
        admin_username, action_type, target_type, target_id, target_title, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const logModerationAction = (
    adminUsername: string,
    actionType: string,
    targetType: string,
    targetId: string,
    targetTitle?: string,
    details?: string,
) => {
    const createdAt = Math.floor(Date.now() / 1000);
    logModerationActionStmt.run(
        adminUsername,
        actionType,
        targetType,
        targetId,
        targetTitle || null,
        details || null,
        createdAt,
    );
};

const getModerationLogsQuery = db.prepare(`
    SELECT id, admin_username, action_type, target_type, target_id, target_title, details, created_at
    FROM moderation_log
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`);

export const getModerationLogs = (
    page: number = 1,
    pageSize: number = 20,
): ModerationLogResponse => {
    const offset = (page - 1) * pageSize;

    const logs = getModerationLogsQuery.all(pageSize, offset) as unknown as ModerationLogEntry[];
    // const logs = MODERATION_LOG_TEST.slice(offset, offset + pageSize);
    // console.log(logs[0], offset, offset + pageSize);
    const count = logs.length;
    const total = Math.ceil(count / pageSize);

    return {
        logs,
        total,
        page,
    };
};

initCode();
