import sqlite3

db_path = r'C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]

for t in sorted(tables):
    if t.startswith("sqlite_"): continue
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    cnt = cur.fetchone()[0]
    if cnt > 0:
        print(f"{t}: {cnt} rows")
