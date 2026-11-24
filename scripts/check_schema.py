import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
row = cur.execute("SELECT sql FROM sqlite_master WHERE name='stock_movements'").fetchone()
if row:
    print(row[0])
else:
    print("Not found")
