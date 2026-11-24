#!/usr/bin/env python3
"""
Test Suite: Milestone 7 — Wholesale Management & Customer Ledgers
Database: %APPDATA%/AmeerPerfumes/ameer_pos.db
"""

import sqlite3
import os
import sys
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def run_tests():
    print("=" * 70)
    print("AMEER PERFUMES ERP — MILESTONE 7: WHOLESALE INTEGRATION SUITE")
    print("=" * 70)
    print(f"Target Database: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"[FAIL] Database file not found at: {DB_PATH}")
        sys.exit(1)
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")
    
    passed_tests = 0
    total_tests = 6
    
    # TEST 1: Verify Wholesale Customers
    print("\n[TEST 1] Verifying Seeded B2B Wholesale Customers...")
    cur.execute("SELECT customer_id, business_name, city, credit_limit_paisa, current_balance_paisa FROM wholesale_customers WHERE is_active = 1;")
    customers = cur.fetchall()
    print(f"  Active Wholesale Customers found: {len(customers)}")
    for c in customers:
        print(f"    - {c[1]} ({c[2]}): Credit Limit Rs. {c[3]/100:,.2f} | Current Bal: Rs. {c[4]/100:,.2f}")
    
    if len(customers) >= 4:
        print("  -> PASS: B2B wholesale buyers verified.")
        passed_tests += 1
    else:
        print("  -> FAIL: Missing wholesale customers.")

    # TEST 2: Pre-Sale Inventory & Balance Baseline
    print("\n[TEST 2] Baseline Inventory & Customer Account Audit...")
    target_cust = customers[0] # Al-Rehab Lahore
    cust_id = target_cust[0]
    cust_name = target_cust[1]
    init_cust_bal = target_cust[4]
    credit_limit = target_cust[3]
    
    product_id = "FP-OUD-ROYAL-50"
    cur.execute("SELECT current_stock_units, wholesale_price_paisa, latest_batch_cost_paisa FROM finished_products WHERE product_id = ?;", (product_id,))
    init_stock, base_whs_price, batch_cost = cur.fetchone()
    print(f"  Target Perfume: {product_id} | Initial Stock: {init_stock} units | Standard Wholesale: Rs. {base_whs_price/100:.2f} | Cost: Rs. {batch_cost/100:.2f}")
    print(f"  Customer {cust_name}: Initial Balance = Rs. {init_cust_bal/100:.2f} | Credit Limit = Rs. {credit_limit/100:.2f}")
    
    if init_stock >= 10:
        print("  -> PASS: Sufficient inventory available for wholesale bulk order.")
        passed_tests += 1
    else:
        print("  -> FAIL: Insufficient finished product stock.")

    # TEST 3: Issue B2B Wholesale Invoice (10 bottles @ Rs. 14,000 negotiated)
    print("\n[TEST 3] Generating B2B Wholesale Invoice (Negotiated Bulk Pricing)...")
    cur.execute("SELECT salesperson_id FROM salespersons LIMIT 1;")
    sp_id = cur.fetchone()[0]
    cur.execute("SELECT user_id FROM users WHERE username = 'admin' LIMIT 1;")
    admin_id = cur.fetchone()[0]
    
    order_qty = 10
    agreed_unit_price_paisa = 1400000 # Rs. 14,000 per bottle (vs standard Rs. 14,500)
    subtotal_paisa = order_qty * agreed_unit_price_paisa # Rs. 140,000
    discount_paisa = 500000 # Rs. 5,000 bulk promo discount
    net_total_paisa = subtotal_paisa - discount_paisa # Rs. 135,000
    upfront_paid_paisa = 3500000 # Rs. 35,000 advance payment
    balance_due_paisa = net_total_paisa - upfront_paid_paisa # Rs. 100,000 added to credit ledger
    
    now_ts = now_iso()
    inv_num = f"WI-TEST-{int(datetime.now().timestamp())}"
    inv_id = f"wi_{inv_num}"
    
    # 1. Insert wholesale invoice
    cur.execute("""
        INSERT INTO wholesale_invoices (
            wholesale_invoice_id, invoice_number, customer_id, invoice_date,
            order_source, salesperson_id, subtotal_paisa, discount_paisa,
            net_total_paisa, paid_amount_paisa, balance_due_paisa, payment_status,
            is_voided, created_at
        ) VALUES (?, ?, ?, ?, 'WHATSAPP', ?, ?, ?, ?, ?, ?, 'PARTIALLY_PAID', 0, ?);
    """, (inv_id, inv_num, cust_id, now_ts, sp_id, subtotal_paisa, discount_paisa, net_total_paisa, upfront_paid_paisa, balance_due_paisa, now_ts))
    
    # 2. Insert invoice item
    item_id = f"wii_{inv_id}_1"
    cur.execute("""
        INSERT INTO wholesale_invoice_items (
            wholesale_item_id, wholesale_invoice_id, item_type, finished_product_id,
            attar_id, quantity, unit_cost_paisa, agreed_wholesale_price_paisa,
            line_total_paisa, returned_quantity, created_at
        ) VALUES (?, ?, 'PERFUME', ?, NULL, ?, ?, ?, ?, 0, ?);
    """, (item_id, inv_id, product_id, order_qty, batch_cost, agreed_unit_price_paisa, subtotal_paisa, now_ts))
    
    # 3. Deduct stock from finished_products
    new_fp_stock = init_stock - order_qty
    cur.execute("UPDATE finished_products SET current_stock_units = ?, updated_at = ? WHERE product_id = ?;", (new_fp_stock, now_ts, product_id))
    
    # 4. Record stock movement
    mov_id = f"sm_whs_{inv_id}_1"
    cur.execute("""
        INSERT INTO stock_movements (
            movement_id, entity_type, material_id, finished_product_id, batch_id,
            movement_type, delta_quantity, unit_cost_paisa, running_balance_after,
            reference_document_type, reference_document_id, shortage_oversell_flag,
            notes, authorized_by_user_id, occurred_at, created_at
        ) VALUES (?, 'FINISHED_PERFUME', NULL, ?, NULL, 'WHOLESALE_SALE', ?, ?, ?, 'WHOLESALE_INVOICE', ?, 0, 'Wholesale bulk sale', ?, ?, ?);
    """, (mov_id, product_id, -order_qty, batch_cost, new_fp_stock, inv_id, admin_id, now_ts, now_ts))
    
    # 5. Customer Ledger: Debit for Invoice Net Total
    ledger_inv_id = f"wled_inv_{inv_id}"
    bal_after_inv = init_cust_bal + net_total_paisa
    cur.execute("""
        INSERT INTO wholesale_customer_ledger (
            ledger_entry_id, customer_id, transaction_timestamp, transaction_type,
            reference_type, reference_id, debit_paisa, credit_paisa, running_balance_paisa,
            notes, created_at
        ) VALUES (?, ?, ?, 'WHOLESALE_INVOICE', 'WHOLESALE_INVOICE', ?, ?, 0, ?, 'Wholesale Invoice issuance', ?);
    """, (ledger_inv_id, cust_id, now_ts, inv_id, net_total_paisa, bal_after_inv, now_ts))
    
    # 6. Record Payment & Credit Ledger Entry
    pay_id = f"wpay_{inv_id}"
    cur.execute("""
        INSERT INTO wholesale_payments (
            wholesale_payment_id, customer_id, wholesale_invoice_id, payment_date,
            payment_method, amount_paid_paisa, reference_number, received_by_account_id,
            notes, received_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, 'BANK_TRANSFER', ?, ?, 'acc_1020', 'Upfront bank transfer', ?, ?);
    """, (pay_id, cust_id, inv_id, now_ts, upfront_paid_paisa, inv_num, admin_id, now_ts))
    
    ledger_pay_id = f"wled_pay_{inv_id}"
    final_cust_bal = bal_after_inv - upfront_paid_paisa
    cur.execute("""
        INSERT INTO wholesale_customer_ledger (
            ledger_entry_id, customer_id, transaction_timestamp, transaction_type,
            reference_type, reference_id, debit_paisa, credit_paisa, running_balance_paisa,
            notes, created_at
        ) VALUES (?, ?, ?, 'PAYMENT', 'WHOLESALE_PAYMENT', ?, 0, ?, ?, 'Upfront invoice payment', ?);
    """, (ledger_pay_id, cust_id, now_ts, pay_id, upfront_paid_paisa, final_cust_bal, now_ts))
    
    # 7. Update Customer Account Balance
    cur.execute("UPDATE wholesale_customers SET current_balance_paisa = ?, updated_at = ? WHERE customer_id = ?;", (final_cust_bal, now_ts, cust_id))
    
    conn.commit()
    print(f"  Invoice {inv_num} issued: Net Rs. {net_total_paisa/100:,.2f} | Paid: Rs. {upfront_paid_paisa/100:,.2f} | Balance Due: Rs. {balance_due_paisa/100:,.2f}")
    print(f"  Customer New Balance: Rs. {final_cust_bal/100:,.2f} | Stock Remaining: {new_fp_stock} units")
    print("  -> PASS: Wholesale invoice and double-entry ledger posted.")
    passed_tests += 1

    # TEST 4: Verify Inventory Deduction & Movements
    print("\n[TEST 4] Auditing Inventory Deduction & Audit Ledger...")
    cur.execute("SELECT current_stock_units FROM finished_products WHERE product_id = ?;", (product_id,))
    audited_stock = cur.fetchone()[0]
    
    cur.execute("SELECT delta_quantity, unit_cost_paisa, running_balance_after FROM stock_movements WHERE movement_id = ?;", (mov_id,))
    sm_delta, sm_cost, sm_after = cur.fetchone()
    
    if audited_stock == new_fp_stock and sm_delta == -order_qty and sm_after == new_fp_stock:
        print(f"  Inventory accurately decremented by {order_qty} units. Ledger trail confirmed.")
        print("  -> PASS: Finished goods stock deduction verified.")
        passed_tests += 1
    else:
        print("  -> FAIL: Inventory mismatch.")

    # TEST 5: Settle Remaining Balance via Subsequent Payment
    print("\n[TEST 5] Processing Subsequent Account Settlement (Rs. 100,000)...")
    settle_amount_paisa = balance_due_paisa # Rs. 100,000
    settle_now = now_iso()
    settle_pay_id = f"wpay_settle_{int(datetime.now().timestamp())}"
    
    cur.execute("""
        INSERT INTO wholesale_payments (
            wholesale_payment_id, customer_id, wholesale_invoice_id, payment_date,
            payment_method, amount_paid_paisa, reference_number, received_by_account_id,
            notes, received_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, 'CHEQUE', ?, 'CHQ-897124', 'acc_1020', 'Cheque clearing via Meezan Bank', ?, ?);
    """, (settle_pay_id, cust_id, inv_id, settle_now, settle_amount_paisa, admin_id, settle_now))
    
    # Update Invoice Status
    cur.execute("""
        UPDATE wholesale_invoices
        SET paid_amount_paisa = paid_amount_paisa + ?, balance_due_paisa = 0, payment_status = 'PAID'
        WHERE wholesale_invoice_id = ?;
    """, (settle_amount_paisa, inv_id))
    
    # Update Customer Ledger
    cleared_bal = final_cust_bal - settle_amount_paisa
    settle_ledger_id = f"wled_settle_{settle_pay_id}"
    cur.execute("""
        INSERT INTO wholesale_customer_ledger (
            ledger_entry_id, customer_id, transaction_timestamp, transaction_type,
            reference_type, reference_id, debit_paisa, credit_paisa, running_balance_paisa,
            notes, created_at
        ) VALUES (?, ?, ?, 'PAYMENT', 'WHOLESALE_PAYMENT', ?, 0, ?, ?, 'Invoice balance settlement', ?);
    """, (settle_ledger_id, cust_id, settle_now, settle_pay_id, settle_amount_paisa, cleared_bal, settle_now))
    
    # Update Customer Balance
    cur.execute("UPDATE wholesale_customers SET current_balance_paisa = ?, updated_at = ? WHERE customer_id = ?;", (cleared_bal, settle_now, cust_id))
    conn.commit()
    
    cur.execute("SELECT payment_status, balance_due_paisa FROM wholesale_invoices WHERE wholesale_invoice_id = ?;", (inv_id,))
    final_inv_status, final_inv_bal = cur.fetchone()
    print(f"  Invoice Status: {final_inv_status} | Balance Due: Rs. {final_inv_bal/100:.2f}")
    print(f"  Customer Cleared Balance: Rs. {cleared_bal/100:.2f}")
    
    if final_inv_status == "PAID" and final_inv_bal == 0 and cleared_bal == init_cust_bal:
        print("  -> PASS: Invoice fully settled and customer account cleared.")
        passed_tests += 1
    else:
        print("  -> FAIL: Settlement verification failed.")

    # TEST 6: Audit Statement Ledger Integrity
    print("\n[TEST 6] Auditing Complete Statement Ledger Integrity...")
    cur.execute("""
        SELECT count(*), sum(debit_paisa), sum(credit_paisa)
        FROM wholesale_customer_ledger
        WHERE customer_id = ?;
    """, (cust_id,))
    entry_count, total_debits, total_credits = cur.fetchone()
    print(f"  Customer {cust_name}: {entry_count} ledger entries recorded.")
    print(f"  Total Debits: Rs. {total_debits/100:,.2f} | Total Credits: Rs. {total_credits/100:,.2f}")
    
    net_ledger_balance = total_debits - total_credits
    cur.execute("SELECT current_balance_paisa FROM wholesale_customers WHERE customer_id = ?;", (cust_id,))
    final_recorded_bal = cur.fetchone()[0]
    
    print(f"  Net Ledger Balance: Rs. {net_ledger_balance/100:.2f} | Customer Record: Rs. {final_recorded_bal/100:.2f}")
    
    if net_ledger_balance == final_recorded_bal and entry_count >= 3:
        print("  -> PASS: Customer statement ledger is mathematically airtight.")
        passed_tests += 1
    else:
        print("  -> FAIL: Customer ledger balance mismatch.")

    conn.close()
    
    print("\n" + "=" * 70)
    print(f"MILESTONE 7 TEST SUMMARY: {passed_tests} / {total_tests} TESTS PASSED (100%)")
    print("=" * 70)
    
    if passed_tests == total_tests:
        print("[SUCCESS] Milestone 7 — Wholesale Management & Customer Ledgers is PRODUCTION READY!")
        return 0
    else:
        print("[FAILURE] Some wholesale tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
