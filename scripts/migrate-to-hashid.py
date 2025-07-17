import sqlite3
import os

old_db = "writing-jam.db"
new_db = "writers-jam.db"

if os.path.exists(new_db):
    os.remove(new_db)

# Open source and destination databases
src_conn = sqlite3.connect(old_db)
dst_conn = sqlite3.connect(new_db)

src = src_conn.cursor()
dst = dst_conn.cursor()

# Create new schema in destination
dst.executescript("""
CREATE TABLE post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  nsfw BOOLEAN NOT NULL,
  password TEXT,
  triggers TEXT,
  title TEXT,
  author TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT 0,
  tags TEXT
);

CREATE TABLE comment (
  id TEXT PRIMARY KEY,
  for INTEGER NOT NULL,
  content TEXT NOT NULL,
  author TEXT,
  posted INTEGER NOT NULL,
  FOREIGN KEY (for) REFERENCES post(id) ON DELETE CASCADE
);

CREATE TABLE post_id_map (
  ulid TEXT PRIMARY KEY,
  new_id INTEGER UNIQUE NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS post_fts USING fts5(
  content,
  title,
  author,
  content='post',
  content_rowid='id'
);

CREATE TRIGGER post_ai AFTER INSERT ON post BEGIN
  INSERT INTO post_fts(rowid, content, title, author)
  VALUES (new.id, new.content, new.title, new.author);
END;

CREATE TRIGGER post_au AFTER UPDATE ON post BEGIN
  UPDATE post_fts
  SET content = new.content,
      title = new.title,
      author = new.author
  WHERE rowid = new.id;
END;

CREATE TRIGGER post_ad AFTER DELETE ON post BEGIN
  DELETE FROM post_fts WHERE rowid = old.id;
END;
""")

# Migrate posts
src.execute("SELECT * FROM post")
columns = [d[0] for d in src.description]

for row in src.fetchall():
    post_data = dict(zip(columns, row))
    ulid = post_data["id"]
    content = post_data["content"]
    nsfw = post_data["nsfw"]
    password = post_data["password"]
    triggers = post_data["triggers"]
    title = post_data["title"]
    author = post_data["author"]
    views = post_data["views"]
    reports = post_data["reports"]
    updated = post_data["updated"]
    deleted = post_data["deleted"]
    tags = None  # default, no tags in old schema

    dst.execute(
        """
        INSERT INTO post (content, nsfw, password, triggers, title, author, views, reports, updated, deleted, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            content,
            nsfw,
            password,
            triggers,
            title,
            author,
            views,
            reports,
            updated,
            deleted,
            tags,
        ),
    )

    new_id = dst.lastrowid
    dst.execute("INSERT INTO post_id_map (ulid, new_id) VALUES (?, ?)", (ulid, new_id))

# Migrate comments
src.execute("SELECT * FROM comment")
columns = [d[0] for d in src.description]

for row in src.fetchall():
    comment_data = dict(zip(columns, row))
    cid = comment_data["id"]
    old_for = comment_data["for"]
    content = comment_data["content"]
    author = comment_data["author"]
    posted = comment_data["posted"]

    dst.execute("SELECT new_id FROM post_id_map WHERE ulid = ?", (old_for,))
    result = dst.fetchone()
    if result:
        new_for = result[0]
        dst.execute(
            """
            INSERT INTO comment (id, for, content, author, posted)
            VALUES (?, ?, ?, ?, ?)
        """,
            (cid, new_for, content, author, posted),
        )

dst_conn.commit()
src_conn.close()
dst_conn.close()
