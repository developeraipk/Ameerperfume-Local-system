import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

for name in ['trg_prevent_voucher_delete', 'trg_prevent_ledger_entry_deletion', 'trg_prevent_stock_movement_deletion']:
    sql = cur.execute(f"SELECT sql FROM sqlite_master WHERE name='{name}'").fetchone()
    print(f"--- {name} ---")
    print(sql[0] if sql else "Not found")
