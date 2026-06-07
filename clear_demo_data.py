"""
One-time migration: wipe all trade rows and their associated image files.
Leaves instruments, tags, checklist, and settings intact.

Usage:
    python clear_demo_data.py
    DB_PATH=/custom/path.db python clear_demo_data.py
"""
import os
import shutil
import sqlite3

DB_PATH = os.environ.get('DB_PATH', '/app/data/trading_journal.db')
IMAGES_DIR = os.environ.get('IMAGES_DIR', '/app/data/images')


def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH} — nothing to do.")
        return

    conn = sqlite3.connect(DB_PATH)
    count = conn.execute('SELECT COUNT(*) FROM trades').fetchone()[0]
    conn.execute('DELETE FROM trades')
    conn.commit()
    conn.close()
    print(f"Deleted {count} trade row(s) from {DB_PATH}")

    if os.path.isdir(IMAGES_DIR):
        shutil.rmtree(IMAGES_DIR)
        os.makedirs(IMAGES_DIR, exist_ok=True)
        print(f"Cleared image files from {IMAGES_DIR}")
    else:
        print(f"Images directory not found at {IMAGES_DIR} — skipping.")


if __name__ == '__main__':
    main()
