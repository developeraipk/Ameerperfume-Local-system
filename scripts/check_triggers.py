import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

triggers = cur.execute("SELECT name, sql FROM sqlite_master WHERE type='trigger'").fetchall()
for name, sql in triggers:
    if "DELETE" in sql.upper():
        print(f"Trigger: {name}")
