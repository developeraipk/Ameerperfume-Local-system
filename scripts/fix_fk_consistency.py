# -*- coding: utf-8 -*-
import sqlite3
import os

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("""
INSERT OR IGNORE INTO users (user_id, username, password_hash, pin_salt_hash, full_name, role, is_active, created_at, updated_at)
VALUES ('usr_mgr1', 'manager1', 'hash_mgr_placeholder', 'hash_pin_2222', 'Tariq Mahmood (Shop Manager)', 'SHOP_MANAGER', 1, datetime('now'), datetime('now'));
""")
conn.commit()

violations = cur.execute("PRAGMA foreign_key_check;").fetchall()
print(f"Remaining FK Violations: {len(violations)}")
if violations:
    print(violations)
else:
    print("Zero FK violations! Foreign key constraints 100% satisfied.")

conn.close()
