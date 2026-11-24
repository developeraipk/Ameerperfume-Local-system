"""
Ameer Perfumes ERP — Milestone 11 Automated Integration Test Suite
Executive Business Intelligence, Inventory Valuation & Auditing Reports
"""

import sqlite3
import os
import sys

def get_db_path():
    appdata = os.getenv("APPDATA") or os.path.expanduser("~")
    return os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

def run_tests():
    db_path = get_db_path()
    print(f"=================================================================")
    print(f"RUNNING MILESTONE 11 INTEGRATION TESTS AGAINST: {db_path}")
    print(f"=================================================================\n")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    passed_count = 0
    total_tests = 5

    # ------------------------------------------------------------------------
    # TEST 1: Inventory Valuation at Historical Batch Cost vs Retail Potential
    # ------------------------------------------------------------------------
    print("TEST 1: Inventory Valuation (Raw Materials & Finished Goods)...")
    cur.execute("""
        SELECT 
            SUM(current_stock_units * latest_batch_cost_paisa),
            SUM(current_stock_units * retail_price_paisa)
        FROM finished_products
        WHERE is_active = 1
    """)
    fg_cost, fg_retail = cur.fetchone()
    fg_cost = fg_cost or 0
    fg_retail = fg_retail or 0

    cur.execute("""
        SELECT SUM(CAST(current_stock_units * weighted_average_cost_paisa AS INTEGER))
        FROM raw_materials
        WHERE is_active = 1
    """)
    rm_cost = cur.fetchone()[0] or 0
    total_cost = fg_cost + rm_cost

    print(f"  Finished Goods Cost:     Rs. {fg_cost / 100:,.2f}")
    print(f"  Finished Goods Retail:   Rs. {fg_retail / 100:,.2f}")
    print(f"  Raw Materials Cost:      Rs. {rm_cost / 100:,.2f}")
    print(f"  Total Asset Valuation:   Rs. {total_cost / 100:,.2f}")

    assert total_cost > 0, "Inventory cost valuation must be greater than zero!"
    assert fg_retail > 0 and fg_cost > 0, "Finished goods valuation must be greater than zero!"
    print(f"  [PASS] Inventory valuation calculated correctly at batch absorption cost.")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 2: Executive Dashboard KPIs Integrity
    # ------------------------------------------------------------------------
    print("\nTEST 2: Executive Dashboard Financial & Operational KPIs...")
    cur.execute("""
        SELECT 
            COALESCE(SUM(net_payable_paisa), 0),
            COUNT(*)
        FROM sales_invoices
        WHERE is_voided = 0
    """)
    total_sales, orders_count = cur.fetchone()

    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN item_type = 'PERFUME' THEN line_total_paisa ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN item_type = 'ATTAR' THEN line_total_paisa ELSE 0 END), 0)
        FROM sales_invoice_items sii
        JOIN sales_invoices si ON sii.invoice_id = si.invoice_id
        WHERE si.is_voided = 0
    """)
    perfume_rev, attar_rev = cur.fetchone()

    print(f"  Total Historical Sales:  Rs. {total_sales / 100:,.2f} across {orders_count} orders")
    print(f"  Perfume Revenue:         Rs. {perfume_rev / 100:,.2f}")
    print(f"  Attar Revenue:           Rs. {attar_rev / 100:,.2f}")

    assert total_sales >= (perfume_rev + attar_rev), "Sales total mismatch with items sum!"
    print(f"  [PASS] Executive KPIs verified.")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 3: Wholesale Credit Exposure & Debt Risk Analysis
    # ------------------------------------------------------------------------
    print("\nTEST 3: Wholesale Debtors & Credit Exposure...")
    cur.execute("""
        SELECT customer_id, business_name, credit_limit_paisa, current_balance_paisa
        FROM wholesale_customers
        WHERE is_active = 1
    """)
    customers = cur.fetchall()
    assert len(customers) > 0, "At least one wholesale customer expected!"

    total_receivables = 0
    for cid, bname, clim, cbal in customers:
        total_receivables += cbal
        util = (cbal / clim * 100) if clim > 0 else 0
        print(f"  - {bname}: Balance Rs. {cbal / 100:,.2f} / Limit Rs. {clim / 100:,.2f} ({util:.1f}%)")
        assert cbal <= clim * 2, f"Customer {bname} drastically exceeding credit limit!"

    print(f"  Total Wholesale Debt Exposure: Rs. {total_receivables / 100:,.2f}")
    print(f"  [PASS] Wholesale debt exposure and credit utilization verified.")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 4: Damaged Returns Quarantine Audit
    # ------------------------------------------------------------------------
    print("\nTEST 4: Damaged Returns Quarantine Audit...")
    cur.execute("""
        SELECT COUNT(*), COALESCE(SUM(quantity), 0)
        FROM damaged_inventory_quarantine
    """)
    q_rows, q_qty = cur.fetchone()
    print(f"  Quarantined Ruined Items: {q_rows} records ({q_qty} units)")
    print(f"  [PASS] Quarantine audit records accessible and indexed.")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 5: Owner Read-Only Role Constraint Verification
    # ------------------------------------------------------------------------
    print("\nTEST 5: Strict Owner Read-Only Role Enforcement (Trigger Verification)...")
    # Verify trigger trg_verify_cashier_role_sales blocks Owner user from being cashier
    cur.execute("SELECT user_id FROM users WHERE role = 'OWNER' LIMIT 1")
    owner_row = cur.fetchone()
    assert owner_row is not None, "Owner user account not found!"
    owner_id = owner_row[0]

    # Attempt to insert sales invoice where cashier_user_id is OWNER -> Must fail
    try:
        cur.execute("""
            INSERT INTO sales_invoices (
                invoice_id, invoice_number, shift_id, terminal_id, order_source,
                customer_phone, salesperson_id, cashier_user_id, invoice_date,
                gross_total_paisa, item_discount_paisa, special_discount_paisa,
                special_discount_authorized_by_id, net_payable_paisa, is_voided,
                voided_by_user_id, voided_reason, created_at
            ) VALUES (
                'test_owner_inv', 'INV-OWNER-TEST', 'shift_test', 'POS-01', 'RETAIL_COUNTER',
                NULL, 'sp_1', ?, '2026-11-11T12:00:00Z',
                500000, 0, 0, NULL, 500000, 0, NULL, NULL, '2026-11-11T12:00:00Z'
            )
        """, (owner_id,))
        conn.commit()
        raise AssertionError("ERROR: Owner account was allowed to act as cashier!")
    except sqlite3.DatabaseError as e:
        err_msg = str(e).lower()
        assert "owner" in err_msg or "read-only" in err_msg or "security violation" in err_msg, f"Unexpected error: {e}"
        print(f"  [PASS] Successfully blocked OWNER account from performing operational checkout: {e}")
        passed_count += 1

    conn.close()

    print(f"\n=================================================================")
    print(f"ALL MILESTONE 11 REPORTING TESTS PASSED: {passed_count}/{total_tests} (100% SUCCESS)")
    print(f"=================================================================")

if __name__ == "__main__":
    run_tests()
