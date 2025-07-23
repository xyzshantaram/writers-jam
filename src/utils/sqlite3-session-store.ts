import Module from "node:module";
import session from "express-session";
import bsqlite3 from "better-sqlite3";

interface ExpiredOptions {
    clear?: boolean;
    intervalMs?: number;
}

interface SqliteStoreOptions {
    client: bsqlite3.Database;
    expired?: ExpiredOptions;
}

const require = Module.createRequire(import.meta.url);
const store = require("better-sqlite3-session-store")(session);

declare class TSqliteStore extends session.Store {
    private client: bsqlite3.Database;
    private expired: ExpiredOptions;

    constructor(options: SqliteStoreOptions);

    private createDb(): void;
    private startInterval(): void;
    private clearExpiredSessions(): void;

    set(sid: string, sess: session.SessionData, cb?: (err?: any) => void): void;
    get(
        sid: string,
        cb: (err: any, session?: session.SessionData | null) => void,
    ): void;
    destroy(sid: string, cb?: (err?: any) => void): void;
    length(cb: (err: any, length?: number) => void): void;
    clear(cb?: (err?: any) => void): void;
    touch(sid: string, sess: session.SessionData, cb?: (err?: any) => void): void;

    all(
        cb: (err: any, obj?: { [sid: string]: session.SessionData } | null) => void,
    ): void;
}

export const SqliteStore: { new (options: SqliteStoreOptions): TSqliteStore } = store;
