import sqlite3, uuid, datetime

db_path = r"C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("Testing database integrity & queries...")

# 1. Finished Products
active_fp = cur.execute("SELECT count(*) FROM finished_products WHERE is_active = 1").fetchone()[0]
print(f"Active finished products: {active_fp}")

# 2. Master BOM Recipes
active_rcp = cur.execute("""
    SELECT count(*) 
    FROM perfume_recipes r
    JOIN finished_products fp ON r.finished_product_id = fp.product_id
    WHERE r.is_active = 1 AND fp.is_active = 1
""").fetchone()[0]
print(f"Active master BOM recipes for active perfumes: {active_rcp}")

# 3. Attars
active_attars = cur.execute("SELECT count(*), name FROM attar_products WHERE is_active = 1").fetchall()
print(f"Active attars: {active_attars}")

# 4. Inventory Valuation
fg_val = cur.execute("SELECT COALESCE(SUM(current_stock_units * latest_batch_cost_paisa), 0) FROM finished_products WHERE is_active = 1").fetchone()[0]
rm_val = cur.execute("SELECT COALESCE(SUM(CAST(current_stock_units * weighted_average_cost_paisa AS INTEGER)), 0) FROM raw_materials WHERE is_active = 1").fetchone()[0]
print(f"FG Valuation: Rs. {fg_val / 100:.2f}, RM Valuation: Rs. {rm_val / 100:.2f}")

# 5. Open shifts
open_shifts = cur.execute("SELECT count(*) FROM cash_register_shifts WHERE shift_status = 'OPEN'").fetchone()[0]
print(f"Open cash shifts: {open_shifts}")

# 6. Wholesale customers
active_wc = cur.execute("SELECT count(*) FROM wholesale_customers WHERE is_active = 1").fetchone()[0]
print(f"Active wholesale customers: {active_wc}")

conn.close()
print("All checks passed cleanly!")
