import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check foreign key references to finished_products
tables = cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table'").fetchall()
refs = []
for t_name, sql in tables:
    if sql and "finished_products" in sql:
        refs.append(t_name)
print("Tables referencing finished_products:", refs)

for t in refs:
    cnt = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"Table {t} row count: {cnt}")
