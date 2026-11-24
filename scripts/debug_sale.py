import sqlite3
import os

db_path = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON;")

print("--- SALESPERSONS ---")
for sp in conn.execute("SELECT * FROM salespersons").fetchall():
    print(sp)

print("\n--- USERS ---")
for u in conn.execute("SELECT user_id, username, role FROM users").fetchall():
    print(u)

print("\n--- RECENT SHIFTS (POS-01) ---")
for s in conn.execute("SELECT shift_id, terminal_id, cashier_user_id, shift_status FROM cash_register_shifts WHERE terminal_id = 'POS-01' ORDER BY opened_at DESC LIMIT 5").fetchall():
    print(s)

print("\n--- PRODUCTS STOCK ---")
for p in conn.execute("SELECT product_id, sku, name, current_stock_units FROM finished_products").fetchall():
    print(p)
