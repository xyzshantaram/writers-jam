import sqlite3
import json

DB_PATH = "writers-jam.db"  # Replace with your actual path

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Select posts with tags field nonempty and no edition present
cur.execute("""
SELECT id, title, content, author, tags FROM post
WHERE tags IS NULL OR LENGTH(TRIM(tags)) = 0
""")

posts = cur.fetchall()
print(f"Fetched {len(posts)} posts with nonempty tags")

for post in posts:
    if not post["tags"] or post["tags"].strip() == "":
        tags = {}
    else:
        try:
            tags = json.loads(post["tags"])
        except json.JSONDecodeError:
            print(f"Skipping post {post['id']} due to JSON error")
            continue

    # Proceed regardless of presence of edition
    print("\nPost ID:", post["id"])
    print("Title:", post["title"])
    print("Author:", post["author"])
    print("Content:")
    print(post['content'])

    while True:
        choice = input(
            "Choose edition [0: No edition, 1: How are you feeling?, 2: The One That Got Away]: "
        ).strip()
        if choice in {"0", "1", "2"}:
            break
        print("Invalid input. Enter 0 or 2.")

    tags["edition"] = {"value": int(choice)}
    tags_json = json.dumps(tags, separators=(",", ":"))

    cur.execute("UPDATE post SET tags = ? WHERE id = ?", (tags_json, post["id"]))
    conn.commit()

conn.close()