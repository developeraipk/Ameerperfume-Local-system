import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
for (t,) in tables:
    cnt = cur.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0]
    if cnt > 0:
        print(f"{t}: {cnt} rows")
