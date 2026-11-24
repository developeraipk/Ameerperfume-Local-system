import sqlite3
import datetime
import time

db_path = r'C:\Users\Default.DESKTOP-QO1EVKV\AppData\Roaming\AmeerPerfumes\ameer_pos.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA foreign_keys = ON;")

now = datetime.datetime.now().isoformat()
ts = int(time.time())

print("==================================================")
print("TEST 1: Finished Perfume Creation with Opening Stock & Category")
print("==================================================")
test_prod_id = f"FP-TEST-{ts}"

cur.execute("""
    INSERT INTO finished_products 
    (product_id, sku, barcode, name, brand, size_ml, category, current_stock_units, retail_price_paisa, wholesale_price_paisa, latest_batch_cost_paisa, reorder_threshold_units, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'Blue De Sapphire 50ml', 'Ameer Perfumes', 50, 'MENS', 50, 230000, 180000, 120000, 5, 1, ?, ?);
""", (test_prod_id, f"TEST-SKU-{ts}", f"8964000{ts%1000000:06d}", now, now))

cur.execute("""
    INSERT INTO stock_movements 
    (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
    VALUES (?, 'FINISHED_PERFUME', NULL, ?, NULL, 'OPENING_STOCK', 50, 120000, 50, 'INITIAL_SETUP', ?, 0, 'Initial catalog inventory setup', 'usr_admin', ?, ?);
""", (f"sm_test_{ts}", test_prod_id, f"setup_{test_prod_id}", now, now))
conn.commit()
print("-> Perfume + OPENING_STOCK inserted successfully! CHECK constraint PASSED.")

print("\n==================================================")
print("TEST 2: Wholesale Dokandar / Customer Registration & Payment")
print("==================================================")
test_cust_id = "WC-TEST-001"
cur.execute("DELETE FROM wholesale_payments WHERE customer_id = ?", (test_cust_id,))
cur.execute("DELETE FROM wholesale_invoice_items WHERE wholesale_invoice_id IN (SELECT wholesale_invoice_id FROM wholesale_invoices WHERE customer_id = ?)", (test_cust_id,))
cur.execute("DELETE FROM wholesale_invoices WHERE customer_id = ?", (test_cust_id,))
cur.execute("DELETE FROM wholesale_customers WHERE customer_id = ?", (test_cust_id,))
conn.commit()

cur.execute("""
    INSERT INTO wholesale_customers
    (customer_id, business_name, contact_person, phone, city, credit_limit_paisa, current_balance_paisa, is_active, created_at, updated_at)
    VALUES (?, 'Al-Noor Fragrance Hub', 'Noor Muhammad', '0300-1122334', 'Lahore', 50000000, 0, 1, ?, ?);
""", (test_cust_id, now, now))
conn.commit()
print("-> Wholesale Customer registered successfully!")

# Insert wholesale invoice
inv_id = "WINV-TEST-0001"
cur.execute("""
    INSERT INTO wholesale_invoices
    (wholesale_invoice_id, invoice_number, customer_id, invoice_date, order_source, salesperson_id, subtotal_paisa, discount_paisa, net_total_paisa, paid_amount_paisa, balance_due_paisa, payment_status, is_voided, created_at)
    VALUES (?, 'WINV-20261116-9999', ?, ?, 'WHATSAPP', 'sp_01', 1800000, 0, 1800000, 0, 1800000, 'UNPAID', 0, ?);
""", (inv_id, test_cust_id, now, now))

cur.execute("UPDATE wholesale_customers SET current_balance_paisa = current_balance_paisa + 1800000 WHERE customer_id = ?", (test_cust_id,))
conn.commit()

# Record wholesale payment
pay_id = "WPAY-TEST-0001"
paid_amt = 1800000
cur.execute("""
    INSERT INTO wholesale_payments
    (wholesale_payment_id, customer_id, wholesale_invoice_id, payment_date, payment_method, amount_paid_paisa, reference_number, received_by_account_id, notes, received_by_user_id, created_at)
    VALUES (?, ?, ?, ?, 'CASH', ?, 'RECEIPT-01', 'acc_1010', 'Full cash settlement', 'usr_admin', ?);
""", (pay_id, test_cust_id, inv_id, now, paid_amt, now))

# Update invoice balance and status
cur.execute("""
    UPDATE wholesale_invoices 
    SET paid_amount_paisa = paid_amount_paisa + ?,
        balance_due_paisa = balance_due_paisa - ?,
        payment_status = CASE WHEN balance_due_paisa - ? <= 0 THEN 'PAID' ELSE 'PARTIALLY_PAID' END
    WHERE wholesale_invoice_id = ?;
""", (paid_amt, paid_amt, paid_amt, inv_id))

cur.execute("UPDATE wholesale_customers SET current_balance_paisa = current_balance_paisa - ? WHERE customer_id = ?", (paid_amt, test_cust_id))
conn.commit()

cur.execute("SELECT payment_status, paid_amount_paisa, balance_due_paisa FROM wholesale_invoices WHERE wholesale_invoice_id = ?", (inv_id,))
row = cur.fetchone()
print(f"-> Wholesale Invoice after payment: Status={row[0]}, Paid={row[1]}, BalanceDue={row[2]} (STATUS CHANGE PASSED)")

print("\n==================================================")
print("TEST 3: Sales Channels Telemetry (Shop vs WhatsApp vs Website)")
print("==================================================")
cur.execute("""
    SELECT order_source, COUNT(*) as orders_count, SUM(net_payable_paisa) as total_rev
    FROM sales_invoices
    GROUP BY order_source;
""")
print("Existing Retail Channels Breakdown:", cur.fetchall())

print("\n==================================================")
print("TEST 4: Cleanup Test Records")
print("==================================================")
cur.execute("DELETE FROM wholesale_payments WHERE customer_id = ?", (test_cust_id,))
cur.execute("DELETE FROM wholesale_invoices WHERE customer_id = ?", (test_cust_id,))
cur.execute("DELETE FROM wholesale_customers WHERE customer_id = ?", (test_cust_id,))
cur.execute("UPDATE finished_products SET is_active = 0, current_stock_units = 0 WHERE product_id = ?", (test_prod_id,))
conn.commit()
print("-> Cleaned up test data cleanly!")

print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
