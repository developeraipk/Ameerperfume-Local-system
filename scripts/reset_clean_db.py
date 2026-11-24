import sqlite3
import os

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
print(f"Connecting to database at: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Disable foreign keys temporarily for clean deletion
cur.execute("PRAGMA foreign_keys = OFF;")

# 1. Clear operational demo data
tables_to_clear = [
    "damaged_inventory_quarantine",
    "stock_reconciliation_queue",
    "stock_movements",
    "perfume_recipe_items",
    "perfume_recipes",
    "manufacturing_batches",
    "finished_products",
    "raw_materials",
    "supplier_purchase_lines",
    "supplier_purchase_invoices",
    "suppliers",
    "wholesale_invoice_items",
    "wholesale_invoices",
    "wholesale_customers",
    "cash_shift_audit",
    "cash_shift_denominations",
    "cash_movements",
    "cash_register_shifts",
    "financial_ledger_entries",
    "journal_vouchers",
    "customer_store_credit_movements",
    "customer_store_credits",
    "sales_invoice_payments",
    "sales_invoice_items",
    "sales_invoices",
    "petty_expenses",
    "sync_inbox_journal",
    "sync_outbox",
    "sync_conflict_quarantine",
]

for t in tables_to_clear:
    try:
        cur.execute(f"DELETE FROM [{t}];")
        print(f"Cleared table: {t}")
    except Exception as e:
        print(f"Error clearing {t}: {e}")

# 2. Clean attars: remove inactive demo attars, preserve user-created active attars
cur.execute("DELETE FROM attar_products WHERE is_active = 0;")
print("Removed inactive demo attars.")

cur.execute("PRAGMA foreign_keys = ON;")
conn.commit()

print("\n--- Verifying Database State ---")
for (t,) in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
    cnt = cur.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0]
    if cnt > 0:
        print(f"{t}: {cnt} rows")

conn.close()
print("\nDatabase is now completely clean and ready for user testing!")
