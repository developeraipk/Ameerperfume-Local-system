import sqlite3
import os
import datetime

db_path = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON;")

try:
    # Check if there is an open shift
    shift = conn.execute("SELECT shift_id FROM cash_register_shifts WHERE terminal_id = 'POS-01' AND shift_status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;").fetchone()
    print("Open shift in DB:", shift)
    shift_id = shift[0] if shift else "shift_pos01_active"

    now = datetime.datetime.now().isoformat()
    inv_id = f"inv_test_{int(datetime.datetime.now().timestamp())}"
    inv_num = f"INV-TEST-{int(datetime.datetime.now().timestamp())}"

    # Get stock before
    stock_before = conn.execute("SELECT current_stock_units FROM finished_products WHERE product_id = 'FP-JASMINE-VELVET-50'").fetchone()[0]
    print(f"Stock BEFORE sale: {stock_before}")

    # Start transaction
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sales_invoices 
        (invoice_id, invoice_number, shift_id, terminal_id, order_source, customer_phone, salesperson_id, cashier_user_id, invoice_date, gross_total_paisa, item_discount_paisa, special_discount_paisa, net_payable_paisa, is_voided, created_at)
        VALUES (?, ?, ?, 'POS-01', 'WALK_IN', '0300-0000000', 'sp_01', 'usr_cashier1', ?, 1250000, 0, 0, 1250000, 0, ?);
    """, (inv_id, inv_num, shift_id, now, now))

    # Insert line item
    cur.execute("""
        INSERT INTO sales_invoice_items
        (invoice_item_id, invoice_id, item_type, finished_product_id, attar_id, product_name, quantity, measurement_unit, measurement_quantity, density_grams_per_ml, calculated_total_ml, batch_id, unit_cost_paisa, unit_selling_price_paisa, discount_amount_paisa, line_total_paisa, line_profit_paisa, returned_quantity, shortage_warning_acknowledged, created_at)
        VALUES (?, ?, 'PERFUME', 'FP-JASMINE-VELVET-50', NULL, 'Jasmine Velvet Extrait 50ml', 1, 'BOTTLE', 1, 1000, 50, NULL, 600000, 1250000, 0, 1250000, 650000, 0, 0, ?);
    """, (f"item_{inv_id}_1", inv_id, now))

    # Update product stock
    cur.execute("""
        UPDATE finished_products SET current_stock_units = current_stock_units - 1 WHERE product_id = 'FP-JASMINE-VELVET-50';
    """)

    # Record stock movement
    cur.execute("""
        INSERT INTO stock_movements
        (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
        VALUES (?, 'FINISHED_PERFUME', NULL, 'FP-JASMINE-VELVET-50', NULL, 'RETAIL_SALE', -1, 600000, ?, 'SALES_INVOICE', ?, 0, 'Retail counter checkout', 'usr_cashier1', ?, ?);
    """, (f"sm_{inv_id}_1", stock_before - 1, inv_id, now, now))

    # Insert payment
    cur.execute("""
        INSERT INTO sales_invoice_payments
        (payment_id, invoice_id, payment_method, amount_paisa, reference_transaction_code, bank_account_id, is_cash_drawer_tender, received_by_user_id, created_at)
        VALUES (?, ?, 'CASH', 1250000, NULL, NULL, 1, 'usr_cashier1', ?);
    """, (f"pay_{inv_id}_1", inv_id, now))

    conn.commit()

    stock_after = conn.execute("SELECT current_stock_units FROM finished_products WHERE product_id = 'FP-JASMINE-VELVET-50'").fetchone()[0]
    print(f"Stock AFTER sale: {stock_after}")
    print("SUCCESS: Transaction committed successfully!")

except Exception as e:
    conn.rollback()
    print("ERROR DURING TRANSACTION:", e)
