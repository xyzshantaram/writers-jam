import { DatabaseSync } from "node:sqlite";

export const init = (db: DatabaseSync) => {
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
      deleted BOOLEAN NOT NULL DEFAULT 0,
      description TEXT DEFAULT ''
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
};
