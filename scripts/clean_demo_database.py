import sqlite3

db_path = r'C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Deactivate demo raw materials
cur.execute("UPDATE raw_materials SET is_active = 0, current_stock_units = 0")

# 2. Deactivate demo suppliers
cur.execute("UPDATE suppliers SET is_active = 0")

# 3. Deactivate demo perfume recipes
cur.execute("UPDATE perfume_recipes SET is_active = 0 WHERE finished_product_id IN (SELECT product_id FROM finished_products WHERE is_active = 0)")

# 4. Close demo open shifts and zero out expected cash
cur.execute("UPDATE cash_register_shifts SET shift_status = 'CLOSED', system_expected_cash_paisa = 0, actual_counted_cash_paisa = 0 WHERE shift_status = 'OPEN'")

# 5. Deactivate demo wholesale customers and zero balances
cur.execute("UPDATE wholesale_customers SET is_active = 0, current_balance_paisa = 0")

conn.commit()

# Verify active counts
cur.execute("SELECT COUNT(*) FROM finished_products WHERE is_active = 1")
print("Active finished_products:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM attar_products WHERE is_active = 1")
print("Active attar_products:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM perfume_recipes WHERE is_active = 1")
print("Active perfume_recipes:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM raw_materials WHERE is_active = 1")
print("Active raw_materials:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM suppliers WHERE is_active = 1")
print("Active suppliers:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM cash_register_shifts WHERE shift_status = 'OPEN'")
print("Open shifts:", cur.fetchone()[0])

cur.execute("SELECT product_id, name FROM finished_products WHERE is_active = 1")
print("Genuine finished products:", cur.fetchall())

cur.execute("SELECT attar_id, name FROM attar_products WHERE is_active = 1")
print("Genuine attars:", cur.fetchall())
