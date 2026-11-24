import sqlite3

db_path = r'C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("--- Salespersons ---")
cur.execute("SELECT * FROM salespersons")
for r in cur.fetchall():
    print(r)

print("--- Users ---")
cur.execute("SELECT user_id, username, full_name, role, is_active FROM users")
for r in cur.fetchall():
    print(r)
