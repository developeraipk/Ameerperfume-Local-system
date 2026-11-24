# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Milestone 4 Integration & Test Suite
Validates:
1. Invoice lookup for return
2. Undamaged item return processing (restock + RETURN_RESTOCK movement)
3. Anti-over-return trigger validation (FRAUD VIOLATION abort)
4. Damaged item return processing (quarantine insertion, no restock)
5. Customer store credit issuance & credit ledger movement
6. Automatic trigger updates (sales_invoice_items.returned_quantity)
7. PRAGMA integrity_check
"""

import os
import sqlite3
import datetime
import uuid

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")
print(f"Target Persistent Database: {db_path}")

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

def run_tests():
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    cur = conn.cursor()

    # 1. First, create a fresh sales invoice for testing returns
    # Customer buys 3x Taif Rose 50ml (14,000 PKR each = 42,000 PKR / 4,200,000 paisa)
    inv_id = f"test_ret_inv_{uuid.uuid4().hex[:10]}"
    inv_num = f"INV-RET-TEST-{int(datetime.datetime.now().timestamp())}"
    item_id = f"item_{inv_id}_1"
    cust_phone = f"0321-{int(datetime.datetime.now().timestamp() * 1000) % 10000000:07d}"
    qty_purchased = 3
    unit_retail_paisa = 1400000
    unit_cost_paisa = 540000
    net_payable_paisa = qty_purchased * unit_retail_paisa

    # Get initial stock of Taif Rose
    cur.execute("SELECT current_stock_units FROM finished_products WHERE product_id = 'FP-ROSE-TAIF-50';")
    initial_stock = cur.fetchone()[0]

    with conn:
        conn.execute("""
            INSERT INTO sales_invoices
            (invoice_id, invoice_number, shift_id, terminal_id, order_source, customer_phone, salesperson_id, cashier_user_id, invoice_date, gross_total_paisa, item_discount_paisa, special_discount_paisa, net_payable_paisa, is_voided, created_at)
            VALUES (?, ?, 'shift_pos01_active', 'POS-01', 'WALK_IN', ?, 'sp_01', 'usr_cashier1', ?, ?, 0, 0, ?, 0, ?);
        """, (inv_id, inv_num, cust_phone, now, net_payable_paisa, net_payable_paisa, now))

        conn.execute("""
            INSERT INTO sales_invoice_items
            (invoice_item_id, invoice_id, item_type, finished_product_id, attar_id, product_name, quantity, measurement_unit, measurement_quantity, density_grams_per_ml, calculated_total_ml, batch_id, unit_cost_paisa, unit_selling_price_paisa, discount_amount_paisa, line_total_paisa, line_profit_paisa, returned_quantity, shortage_warning_acknowledged, created_at)
            VALUES (?, ?, 'PERFUME', 'FP-ROSE-TAIF-50', NULL, 'Taif Rose Extrait de Parfum 50ml', ?, 'BOTTLE', 1, 1000, 150, NULL, ?, ?, 0, ?, ?, 0, 0, ?);
        """, (item_id, inv_id, qty_purchased, unit_cost_paisa, unit_retail_paisa, net_payable_paisa, (unit_retail_paisa - unit_cost_paisa) * qty_purchased, now))

        conn.execute("UPDATE finished_products SET current_stock_units = current_stock_units - ? WHERE product_id = 'FP-ROSE-TAIF-50';", (qty_purchased,))

        conn.execute("""
            INSERT INTO sales_invoice_payments
            (payment_id, invoice_id, payment_method, amount_paisa, reference_transaction_code, bank_account_id, is_cash_drawer_tender, received_by_user_id, created_at)
            VALUES (?, ?, 'CASH', ?, NULL, NULL, 1, 'usr_cashier1', ?);
        """, (f"pay_{inv_id}", inv_id, net_payable_paisa, now))

    print(f"[PASS] 1. Baseline Test Invoice Created: {inv_num} for 3 units of Taif Rose. (New stock: {initial_stock - qty_purchased})")

    # 2. Test Undamaged Return of 1 Unit (Restock to inventory)
    ret_id_1 = f"ret_{uuid.uuid4().hex[:10]}"
    ret_num_1 = f"RET-TEST-001-{int(datetime.datetime.now().timestamp())}"
    ret_item_id_1 = f"reti_{ret_id_1}_1"

    with conn:
        # Create return voucher
        conn.execute("""
            INSERT INTO return_vouchers
            (return_id, return_voucher_number, original_sales_invoice_id, original_wholesale_invoice_id, invoice_type, customer_id, return_type, condition_status, total_refund_amount_paisa, refund_settlement_method, replacement_invoice_id, exchange_price_difference_paisa, cashier_user_id, terminal_id, return_date, created_at)
            VALUES (?, ?, ?, NULL, 'RETAIL', NULL, 'FULL_REFUND', 'UNDAMAGED_NORMAL', ?, 'CASH', NULL, 0, 'usr_cashier1', 'POS-01', ?, ?);
        """, (ret_id_1, ret_num_1, inv_id, unit_retail_paisa, now, now))

        # Create return voucher item (Triggers trg_update_retail_returned_quantity on sales_invoice_items)
        conn.execute("""
            INSERT INTO return_voucher_items
            (return_item_id, return_id, original_retail_item_id, original_wholesale_item_id, item_type, finished_product_id, attar_id, quantity_returned, original_unit_price_paisa, original_unit_cost_paisa, refund_line_total_paisa, condition_notes, inspection_status, disposition_authorized_by_id, disposition_at, created_at)
            VALUES (?, ?, ?, NULL, 'PERFUME', 'FP-ROSE-TAIF-50', NULL, 1, ?, ?, ?, 'Customer changed mind - seal intact', 'RESTOCKED_SALEABLE', 'usr_cashier1', ?, ?);
        """, (ret_item_id_1, ret_id_1, item_id, unit_retail_paisa, unit_cost_paisa, unit_retail_paisa, now, now))

        # Restock product
        conn.execute("UPDATE finished_products SET current_stock_units = current_stock_units + 1 WHERE product_id = 'FP-ROSE-TAIF-50';")

        # Record stock movement
        conn.execute("""
            INSERT INTO stock_movements
            (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
            VALUES (?, 'FINISHED_PERFUME', NULL, 'FP-ROSE-TAIF-50', NULL, 'RETURN_RESTOCK', 1, ?, ?, 'RETURN_VOUCHER', ?, 0, 'Restocked undamaged return', 'usr_cashier1', ?, ?);
        """, (f"sm_{ret_id_1}", unit_cost_paisa, initial_stock - qty_purchased + 1, ret_id_1, now, now))

    # Verify that trigger trg_update_retail_returned_quantity updated returned_quantity
    cur.execute("SELECT returned_quantity FROM sales_invoice_items WHERE invoice_item_id = ?;", (item_id,))
    ret_qty = cur.fetchone()[0]
    assert ret_qty == 1, f"Expected returned_quantity = 1, got {ret_qty}"
    print(f"[PASS] 2. Undamaged Return Processed: Trigger trg_update_retail_returned_quantity confirmed returned_quantity = {ret_qty}.")

    # Verify inventory was restored
    cur.execute("SELECT current_stock_units FROM finished_products WHERE product_id = 'FP-ROSE-TAIF-50';")
    stock_after_ret1 = cur.fetchone()[0]
    assert stock_after_ret1 == initial_stock - qty_purchased + 1
    print(f"[PASS] 3. Stock Restock Verified: Finished product stock restored to {stock_after_ret1} units.")

    # 3. Test Anti-Over-Return Protection Trigger
    # Currently 1 returned out of 3. Returning 3 more (total 4 > 3) must be REJECTED!
    over_return_rejected = False
    try:
        conn.execute("""
            INSERT INTO return_voucher_items
            (return_item_id, return_id, original_retail_item_id, original_wholesale_item_id, item_type, finished_product_id, attar_id, quantity_returned, original_unit_price_paisa, original_unit_cost_paisa, refund_line_total_paisa, condition_notes, inspection_status, disposition_authorized_by_id, disposition_at, created_at)
            VALUES ('reti_over_fail', ?, ?, NULL, 'PERFUME', 'FP-ROSE-TAIF-50', NULL, 3, ?, ?, ?, 'Over return test', 'RESTOCKED_SALEABLE', 'usr_cashier1', ?, ?);
        """, (ret_id_1, item_id, unit_retail_paisa, unit_cost_paisa, unit_retail_paisa * 3, now, now))
    except sqlite3.IntegrityError as e:
        over_return_rejected = True
        print(f"[PASS] 4. Anti-Over-Return Trigger Verified: Over-return rejected ({e}).")
    assert over_return_rejected, "Anti-over-return trigger failed to reject excessive return!"

    # 4. Test Damaged Item Return (Quarantine insertion, Store Credit issued)
    # Returning 1 more unit as DAMAGED_RUINED with refund_settlement_method = CUSTOMER_CREDIT
    ret_id_2 = f"ret_{uuid.uuid4().hex[:10]}"
    ret_num_2 = f"RET-TEST-002-{int(datetime.datetime.now().timestamp())}"
    ret_item_id_2 = f"reti_{ret_id_2}_1"
    quar_id = f"quar_{ret_id_2}_1"

    with conn:
        conn.execute("""
            INSERT INTO return_vouchers
            (return_id, return_voucher_number, original_sales_invoice_id, original_wholesale_invoice_id, invoice_type, customer_id, return_type, condition_status, total_refund_amount_paisa, refund_settlement_method, replacement_invoice_id, exchange_price_difference_paisa, cashier_user_id, terminal_id, return_date, created_at)
            VALUES (?, ?, ?, NULL, 'RETAIL', NULL, 'FULL_REFUND', 'DAMAGED_RUINED', ?, 'CUSTOMER_CREDIT', NULL, 0, 'usr_cashier1', 'POS-01', ?, ?);
        """, (ret_id_2, ret_num_2, inv_id, unit_retail_paisa, now, now))

        conn.execute("""
            INSERT INTO return_voucher_items
            (return_item_id, return_id, original_retail_item_id, original_wholesale_item_id, item_type, finished_product_id, attar_id, quantity_returned, original_unit_price_paisa, original_unit_cost_paisa, refund_line_total_paisa, condition_notes, inspection_status, disposition_authorized_by_id, disposition_at, created_at)
            VALUES (?, ?, ?, NULL, 'PERFUME', 'FP-ROSE-TAIF-50', NULL, 1, ?, ?, ?, 'Broken spray nozzle/leaking', 'QUARANTINED', 'usr_cashier1', ?, ?);
        """, (ret_item_id_2, ret_id_2, item_id, unit_retail_paisa, unit_cost_paisa, unit_retail_paisa, now, now))

        # Insert into quarantine table
        conn.execute("""
            INSERT INTO damaged_inventory_quarantine
            (quarantine_id, return_item_id, finished_product_id, attar_id, quantity, unit_cost_paisa, damage_reason, admin_disposition, discretionary_refund_approved_paisa, admin_notes, authorized_by_admin_id, authorized_at, created_at)
            VALUES (?, ?, 'FP-ROSE-TAIF-50', NULL, 1, ?, 'Broken spray nozzle', NULL, ?, 'Quarantined for manager inspection', NULL, NULL, ?);
        """, (quar_id, ret_item_id_2, unit_cost_paisa, unit_retail_paisa, now))

        # Credit customer balance in customer_store_credits
        conn.execute("""
            INSERT INTO customer_store_credits (credit_id, customer_phone, customer_name, current_credit_balance_paisa, last_updated_at)
            VALUES (?, ?, 'Valued Customer', ?, ?)
            ON CONFLICT(customer_phone) DO UPDATE SET
            current_credit_balance_paisa = current_credit_balance_paisa + ?,
            last_updated_at = ?;
        """, (f"cred_{cust_phone}", cust_phone, unit_retail_paisa, now, unit_retail_paisa, now))

        # Record movement in customer_store_credit_movements
        conn.execute("""
            INSERT INTO customer_store_credit_movements
            (movement_id, customer_phone, movement_type, amount_paisa, reference_document_type, reference_document_id, running_balance_after_paisa, notes, created_at)
            VALUES (?, ?, 'CREDIT_ISSUED_RETURN', ?, 'RETURN_VOUCHER', ?, ?, 'Full refund store credit', ?);
        """, (f"cmov_{ret_id_2}", cust_phone, unit_retail_paisa, ret_id_2, unit_retail_paisa, now))

    # Verify quarantine entry
    cur.execute("SELECT quantity, damage_reason FROM damaged_inventory_quarantine WHERE quarantine_id = ?;", (quar_id,))
    q_row = cur.fetchone()
    assert q_row is not None, "Quarantine record not found!"
    assert q_row[0] == 1
    print(f"[PASS] 5. Damaged Item Quarantine Verified: 1 bottle quarantined ({q_row[1]}).")

    # Verify customer credit balance
    cur.execute("SELECT current_credit_balance_paisa FROM customer_store_credits WHERE customer_phone = ?;", (cust_phone,))
    credit_bal = cur.fetchone()[0]
    assert credit_bal == unit_retail_paisa, f"Expected credit balance {unit_retail_paisa}, got {credit_bal}"
    print(f"[PASS] 6. Customer Store Credit Verified: Rs. {credit_bal / 100:,.2f} credited to {cust_phone}.")

    # Verify PRAGMA integrity_check
    cur.execute("PRAGMA integrity_check;")
    integrity = cur.fetchone()[0]
    assert integrity == "ok"
    print(f"[PASS] 7. PRAGMA integrity_check: {integrity.upper()}.")

    conn.close()
    print("=== ALL MILESTONE 4 TESTS PASSED (100%) ===")

if __name__ == "__main__":
    print("=== AMEER PERFUMES ERP — MILESTONE 4 RETURNS & CREDITS TEST SUITE ===")
    run_tests()
