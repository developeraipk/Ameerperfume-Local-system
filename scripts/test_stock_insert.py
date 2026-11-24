import sqlite3
import datetime

db_path = r'C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check what products exist
cur.execute("SELECT product_id, sku, name FROM finished_products")
print("Finished products:", cur.fetchall())

# Test stock_movements insert
now = datetime.datetime.now().isoformat()
try:
    cur.execute("""
        INSERT INTO stock_movements 
        (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
        VALUES ('test_mov_1', 'FINISHED_PERFUME', NULL, 'FP-TEST', NULL, 'OPENING_STOCK', 10, 1000, 10, 'INITIAL_SETUP', 'setup_FP-TEST', 0, 'Test', 'usr_admin', ?, ?);
    """, (now, now))
    print("Insert succeeded!")
    conn.rollback()
except Exception as e:
    print("Insert failed:", e)
    conn.rollback()
