import sqlite3
import json

DB_PATH = "writers-jam.db"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Step 1: Assign editions to posts with NULL or empty tags
cur.execute("""
SELECT id, title, content, author, tags FROM post
WHERE tags IS NULL OR LENGTH(TRIM(tags)) = 0
""")

posts = cur.fetchall()
print(f"Fetched {len(posts)} posts with empty or null tags")

try:
    for post in posts:
        if not post["tags"] or post["tags"].strip() == "":
            tags = {}
        else:
            try:
                tags = json.loads(post["tags"])
            except json.JSONDecodeError:
                print(f"Skipping post {post['id']} due to JSON error")
                continue

        print("\nPost ID:", post["id"])
        print("Title:", post["title"])
        print("Author:", post["author"])
        print("Content:")
        print(post["content"])

        while True:
            choice = input(
                "Choose edition [0: No edition, 1: How are you feeling?, 2: The One That Got Away]: "
            ).strip()
            if choice in {"0", "1", "2"}:
                break
            print("Invalid input. Enter 0, 1, or 2.")

        tags["edition"] = {"value": int(choice)}
        tags_json = json.dumps(tags, separators=(",", ":"))

        cur.execute("UPDATE post SET tags = ? WHERE id = ?", (tags_json, post["id"]))
        conn.commit()

except KeyboardInterrupt:
    print("\nInterrupted during initial pass.")

# Step 2: Recheck posts with edition.value == 1
print("\n--- Rechecking posts with edition 1 ---")

cur.execute("""
SELECT id, title, content, author, tags FROM post
WHERE json_extract(tags, '$.edition.value') = 1
""")

edition_1_posts = cur.fetchall()
print(f"Fetched {len(edition_1_posts)} posts with edition 1")

try:
    for post in edition_1_posts:
        try:
            tags = json.loads(post["tags"])
        except json.JSONDecodeError:
            print(f"Skipping post {post['id']} due to JSON error")
            continue

        print("\nPost ID:", post["id"])
        print("Title:", post["title"])
        print("Author:", post["author"])
        print("Content:")
        print(post["content"])

        while True:
            choice = input(
                "Confirm or update edition [1: Keep, 0: No edition, 2: The One That Got Away]: "
            ).strip()
            if choice in {"0", "1", "2"}:
                break
            print("Invalid input. Enter 0, 1, or 2.")

        if int(choice) != 1:
            tags["edition"]["value"] = int(choice)
            tags_json = json.dumps(tags, separators=(",", ":"))
            cur.execute(
                "UPDATE post SET tags = ? WHERE id = ?", (tags_json, post["id"])
            )
            conn.commit()

except KeyboardInterrupt:
    print("\nInterrupted during recheck pass.")

conn.close()
