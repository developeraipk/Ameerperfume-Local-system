import sqlite3

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("DROP TRIGGER IF EXISTS trg_prevent_voucher_delete;")
cur.execute("DROP TRIGGER IF EXISTS trg_prevent_ledger_entry_deletion;")
cur.execute("DROP TRIGGER IF EXISTS trg_prevent_stock_movement_deletion;")

cur.execute("DELETE FROM financial_ledger_entries;")
cur.execute("DELETE FROM journal_vouchers;")
cur.execute("DELETE FROM stock_movements;")

# Recreate triggers
cur.execute("""
CREATE TRIGGER trg_prevent_voucher_delete
BEFORE DELETE ON journal_vouchers
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Deleting accounting vouchers is strictly prohibited.');
END;
""")

cur.execute("""
CREATE TRIGGER trg_prevent_ledger_entry_deletion
BEFORE DELETE ON financial_ledger_entries
WHEN (SELECT is_immutable FROM journal_vouchers WHERE voucher_id = OLD.voucher_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'FINANCIAL VIOLATION: Ledger entries of posted vouchers cannot be deleted.');
END;
""")

cur.execute("""
CREATE TRIGGER trg_prevent_stock_movement_deletion
BEFORE DELETE ON stock_movements
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Deleting stock movements is strictly prohibited.');
END;
""")

conn.commit()

print("\n--- Current Tables with Data ---")
for (t,) in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
    cnt = cur.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0]
    if cnt > 0:
        print(f"{t}: {cnt} rows")

conn.close()
print("Success! Demo ledger vouchers and stock movements purged completely.")
