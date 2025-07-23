import sqlite3
import tempfile
import subprocess
import os

DB_PATH = "writers-jam.db"


def check_markdown_breakage(content):
    lines = content.splitlines()
    has_double_newline = "\n\n" in content or "\r\n\r\n" in content
    if has_double_newline:
        return None

    has_single_newline = any(
        lines[i].strip() and lines[i + 1].strip() for i in range(len(lines) - 1)
    )
    has_blockquote = any(line.lstrip().startswith(">") for line in lines)

    if not has_single_newline and not has_blockquote:
        return None

    return {
        "newlines": has_single_newline,
        "blockquote": has_blockquote,
        "will_break": has_single_newline or has_blockquote,
    }


def launch_nano_with_tempfile(initial_text):
    with tempfile.NamedTemporaryFile(
        delete=False, mode="w+", encoding="utf-8", suffix=".tmp"
    ) as tf:
        tf.write(initial_text)
        tf.flush()
        temp_path = tf.name

    subprocess.call(["nano", temp_path])

    with open(temp_path, "r", encoding="utf-8") as tf:
        updated_text = tf.read()

    os.remove(temp_path)
    return updated_text


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, content FROM comment")
    rows = cursor.fetchall()

    matching_comments = []

    for id_, content in rows:
        flags = check_markdown_breakage(content)
        if flags:
            matching_comments.append((id_, content, flags))

    print(f"Found {len(matching_comments)} potentially breakable comments.\n")

    for i, (id_, content, flags) in enumerate(matching_comments):
        print(f"[{i + 1}/{len(matching_comments)}] ID: {id_}")
        print(f"newlines: {flags['newlines']} | blockquote: {flags['blockquote']}")
        preview = content.strip().splitlines()
        for line in preview[:5]:
            print("  " + line)
        if len(preview) > 5:
            print("  ...")

        inp = input("Edit this comment? [Y/n/skip to index]: ").strip().lower()

        if inp == "n":
            continue
        elif inp.isdigit():
            jump = int(inp) - 1
            if 0 <= jump < len(matching_comments):
                i = jump - 1  # will be incremented by loop
                continue
        else:
            edited = launch_nano_with_tempfile(content)
            if edited != content:
                cursor.execute(
                    "UPDATE comment SET content = ? WHERE id = ?", (edited, id_)
                )
                conn.commit()
                print(f"Updated comment {id_}")
            else:
                print("No changes made.")

        print()

    conn.close()


if __name__ == "__main__":
    main()
