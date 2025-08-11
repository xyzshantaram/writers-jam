import { hashPostId, unhashPostId } from "../utils/mod.ts";
import { db } from "./db.ts";

db.exec(`
create table if not exists admin_codes(
    code integer primary key,
    created_at integer
);

create table if not exists admins(
    username text primary key,
    password text not null,
    created_at integer
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
        console.log(`No admins found. Created admin code ${code}`);
    }
};

const adminDeletePostStmt = db.prepare(`
    UPDATE post 
    SET deleted = 1 
    WHERE id = ?
`);

export const adminDeletePost = (id: string) => {
    adminDeletePostStmt.run(unhashPostId(id));
};

const adminSetPostNsfwStmt = db.prepare(`
    UPDATE post 
    SET nsfw = ? 
    WHERE id = ?
`);

export const adminSetPostNsfw = (id: string, nsfw: boolean) => {
    adminSetPostNsfwStmt.run(nsfw ? 1 : 0, unhashPostId(id));
};

const adminDeleteCommentStmt = db.prepare(`
    DELETE FROM comment 
    WHERE id = ?
`);

export const adminDeleteComment = (id: string) => {
    adminDeleteCommentStmt.run(unhashPostId(id));
};

initCode();
