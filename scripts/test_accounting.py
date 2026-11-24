"""
Ameer Perfumes ERP — Milestone 10 Automated Integration Test Suite
Comprehensive Double-Entry General Ledger, Triggers, Immutability & Financial Reporting
"""

import sqlite3
import os
import sys
from datetime import datetime, timezone

def get_db_path():
    appdata = os.getenv("APPDATA") or os.path.expanduser("~")
    return os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

def run_tests():
    db_path = get_db_path()
    print(f"=================================================================")
    print(f"RUNNING MILESTONE 10 INTEGRATION TESTS AGAINST: {db_path}")
    print(f"=================================================================\n")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    passed_count = 0
    total_tests = 7

    # ------------------------------------------------------------------------
    # TEST 1: Chart of Accounts Structure & Verification
    # ------------------------------------------------------------------------
    print("TEST 1: Chart of Accounts Structure & Verification...")
    cur.execute("SELECT COUNT(*) FROM chart_of_accounts WHERE is_active = 1")
    active_count = cur.fetchone()[0]
    assert active_count >= 15, f"Expected at least 15 active accounts, got {active_count}"

    cur.execute("SELECT DISTINCT account_type FROM chart_of_accounts")
    types = {r[0] for r in cur.fetchall()}
    expected_types = {"ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"}
    assert expected_types.issubset(types), f"Missing account types. Found: {types}"

    print(f"  [PASS] {active_count} active accounts verified across all 5 core accounting types.")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 2: Unbalanced Voucher Posting Rejection (Trigger trg_verify_voucher_balance_before_post)
    # ------------------------------------------------------------------------
    print("\nTEST 2: Out-of-Balance Voucher Posting Rejection Trigger...")
    now = datetime.now(timezone.utc).isoformat()
    test_unbalanced_id = f"test_jv_unbal_{int(datetime.now().timestamp() * 1000)}"

    cur.execute("""
        INSERT INTO journal_vouchers (
            voucher_id, voucher_number, voucher_date, voucher_type, source_module,
            source_document_id, description, is_posted, is_immutable, posted_by_user_id, created_at
        ) VALUES (?, ?, '2026-11-11', 'STANDARD', 'GL', 'TEST-REF', 'Unbalanced test', 0, 0, 'usr_mgr1', ?)
    """, (test_unbalanced_id, f"JV-UNBAL-{int(datetime.now().timestamp() * 1000)}", now))

    # Debit 10,000 Paisa (Rs. 100.00), Credit 8,000 Paisa (Rs. 80.00) -> Out of balance by 2,000 Paisa
    cur.execute("""
        INSERT INTO financial_ledger_entries (entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, currency, memo, created_at)
        VALUES (?, ?, 'acc_1010', 'DEBIT', 10000, 0, 'PKR', 'Cash in', ?)
    """, (f"entry_unb_1_{test_unbalanced_id}", test_unbalanced_id, now))

    cur.execute("""
        INSERT INTO financial_ledger_entries (entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, currency, memo, created_at)
        VALUES (?, ?, 'acc_4010', 'CREDIT', 0, 8000, 'PKR', 'Revenue', ?)
    """, (f"entry_unb_2_{test_unbalanced_id}", test_unbalanced_id, now))

    conn.commit()

    try:
        cur.execute("UPDATE journal_vouchers SET is_posted = 1 WHERE voucher_id = ?", (test_unbalanced_id,))
        conn.commit()
        raise AssertionError("ERROR: Unbalanced voucher was allowed to post!")
    except sqlite3.DatabaseError as e:
        err_msg = str(e).lower()
        assert "unbalanced" in err_msg or "financial violation" in err_msg or "accounting violation" in err_msg, f"Unexpected error: {e}"
        print(f"  [PASS] Successfully rejected unbalanced voucher with trigger exception: {e}")
        passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 3: Minimum Entry Count Trigger (< 2 lines)
    # ------------------------------------------------------------------------
    print("\nTEST 3: Minimum Line Count Verification Trigger (< 2 lines)...")
    test_single_id = f"test_jv_single_{int(datetime.now().timestamp() * 1000)}"

    cur.execute("""
        INSERT INTO journal_vouchers (
            voucher_id, voucher_number, voucher_date, voucher_type, source_module,
            source_document_id, description, is_posted, is_immutable, posted_by_user_id, created_at
        ) VALUES (?, ?, '2026-11-11', 'STANDARD', 'GL', 'TEST-REF', 'Single line test', 0, 0, 'usr_mgr1', ?)
    """, (test_single_id, f"JV-SINGLE-{int(datetime.now().timestamp() * 1000)}", now))

    conn.commit()

    try:
        cur.execute("UPDATE journal_vouchers SET is_posted = 1 WHERE voucher_id = ?", (test_single_id,))
        conn.commit()
        raise AssertionError("ERROR: Empty/single entry voucher was allowed to post!")
    except sqlite3.DatabaseError as e:
        err_msg = str(e).lower()
        assert "at least two entries" in err_msg or "unbalanced" in err_msg or "financial violation" in err_msg or "accounting violation" in err_msg, f"Unexpected error: {e}"
        print(f"  [PASS] Successfully blocked voucher posting with fewer than 2 entries: {e}")
        passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 4: Balanced Voucher Creation, Posting & Automatic Immutability
    # ------------------------------------------------------------------------
    print("\nTEST 4: Balanced Voucher Posting & Immutability Trigger...")
    test_bal_id = f"test_jv_bal_{int(datetime.now().timestamp() * 1000)}"

    cur.execute("""
        INSERT INTO journal_vouchers (
            voucher_id, voucher_number, voucher_date, voucher_type, source_module,
            source_document_id, description, is_posted, is_immutable, posted_by_user_id, created_at
        ) VALUES (?, ?, '2026-11-11', 'STANDARD', 'GL', 'TEST-REF', 'Balanced cash injection test', 0, 0, 'usr_mgr1', ?)
    """, (test_bal_id, f"JV-BAL-{int(datetime.now().timestamp() * 1000)}", now))

    # Debit Cash 50,000 Paisa (Rs. 500.00), Credit Capital 50,000 Paisa (Rs. 500.00)
    cur.execute("""
        INSERT INTO financial_ledger_entries (entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, currency, memo, created_at)
        VALUES (?, ?, 'acc_1010', 'DEBIT', 50000, 0, 'PKR', 'Cash in', ?)
    """, (f"entry_bal_1_{test_bal_id}", test_bal_id, now))

    cur.execute("""
        INSERT INTO financial_ledger_entries (entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, currency, memo, created_at)
        VALUES (?, ?, 'acc_3010', 'CREDIT', 0, 50000, 'PKR', 'Capital injection', ?)
    """, (f"entry_bal_2_{test_bal_id}", test_bal_id, now))

    # Post
    cur.execute("UPDATE journal_vouchers SET is_posted = 1 WHERE voucher_id = ?", (test_bal_id,))
    conn.commit()

    cur.execute("SELECT is_posted, is_immutable FROM journal_vouchers WHERE voucher_id = ?", (test_bal_id,))
    row = cur.fetchone()
    assert row[0] == 1, f"Expected is_posted = 1, got {row[0]}"
    assert row[1] == 1, f"Expected is_immutable = 1 (set by trigger), got {row[1]}"

    print(f"  [PASS] Balanced voucher posted successfully and locked as immutable (is_posted=1, is_immutable=1).")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 5: Ledger Tamper Protection & Immutability Enforcement
    # ------------------------------------------------------------------------
    print("\nTEST 5: Immutability Tamper Protection (Triggers)...")

    # 5a. Attempt to update posted voucher
    try:
        cur.execute("UPDATE journal_vouchers SET description = 'Tampered' WHERE voucher_id = ?", (test_bal_id,))
        conn.commit()
        raise AssertionError("ERROR: Updating immutable voucher succeeded!")
    except sqlite3.DatabaseError as e:
        assert "immutable" in str(e).lower() or "violation" in str(e).lower()
        print(f"  [PASS] Update blocked: {e}")

    # 5b. Attempt to unpost voucher
    try:
        cur.execute("UPDATE journal_vouchers SET is_posted = 0 WHERE voucher_id = ?", (test_bal_id,))
        conn.commit()
        raise AssertionError("ERROR: Unposting immutable voucher succeeded!")
    except sqlite3.DatabaseError as e:
        assert "unposted" in str(e).lower() or "immutable" in str(e).lower() or "violation" in str(e).lower()
        print(f"  [PASS] Unposting blocked: {e}")

    # 5c. Attempt to delete voucher
    try:
        cur.execute("DELETE FROM journal_vouchers WHERE voucher_id = ?", (test_bal_id,))
        conn.commit()
        raise AssertionError("ERROR: Deleting voucher succeeded!")
    except sqlite3.DatabaseError as e:
        assert "strictly prohibited" in str(e).lower() or "cannot be deleted" in str(e).lower() or "violation" in str(e).lower()
        print(f"  [PASS] Deletion blocked: {e}")

    # 5d. Attempt to insert line into posted voucher
    try:
        cur.execute("""
            INSERT INTO financial_ledger_entries (entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, currency, memo, created_at)
            VALUES ('entry_tamper', ?, 'acc_1010', 'DEBIT', 5000, 0, 'PKR', 'Tamper', ?)
        """, (test_bal_id, now))
        conn.commit()
        raise AssertionError("ERROR: Inserting entry into posted voucher succeeded!")
    except sqlite3.DatabaseError as e:
        assert "already posted" in str(e).lower() or "violation" in str(e).lower()
        print(f"  [PASS] Entry insertion on posted voucher blocked: {e}")

    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 6: Trial Balance Invariant (Debits == Credits)
    # ------------------------------------------------------------------------
    print("\nTEST 6: Trial Balance Mathematical Equality Verification...")
    cur.execute("""
        SELECT 
            c.account_id,
            COALESCE(SUM(CASE WHEN jv.is_posted = 1 THEN le.debit_paisa ELSE 0 END), 0) AS total_debit,
            COALESCE(SUM(CASE WHEN jv.is_posted = 1 THEN le.credit_paisa ELSE 0 END), 0) AS total_credit
        FROM chart_of_accounts c
        LEFT JOIN financial_ledger_entries le ON c.account_id = le.account_id
        LEFT JOIN journal_vouchers jv ON le.voucher_id = jv.voucher_id
        WHERE c.is_active = 1
        GROUP BY c.account_id
    """)
    rows = cur.fetchall()

    grand_net_debit = 0
    grand_net_credit = 0

    for r in rows:
        tot_deb, tot_cred = r[1], r[2]
        if tot_deb > tot_cred:
            grand_net_debit += (tot_deb - tot_cred)
        elif tot_cred > tot_deb:
            grand_net_credit += (tot_cred - tot_deb)

    print(f"  Grand Net Debits:  Rs. {grand_net_debit / 100:,.2f} ({grand_net_debit} Paisa)")
    print(f"  Grand Net Credits: Rs. {grand_net_credit / 100:,.2f} ({grand_net_credit} Paisa)")
    assert grand_net_debit == grand_net_credit, f"Trial Balance Imbalance! Debits ({grand_net_debit}) != Credits ({grand_net_credit})"
    print(f"  [PASS] Trial balance is in 100% mathematical balance (Debits == Credits).")
    passed_count += 1

    # ------------------------------------------------------------------------
    # TEST 7: Financial Statements & Balance Sheet Equation Invariant
    # ------------------------------------------------------------------------
    print("\nTEST 7: Balance Sheet Equation (Assets = Liabilities + Equity)...")
    cur.execute("""
        SELECT 
            c.account_id, c.account_type, c.account_category,
            COALESCE(SUM(CASE WHEN jv.is_posted = 1 THEN le.debit_paisa ELSE 0 END), 0) AS total_debit,
            COALESCE(SUM(CASE WHEN jv.is_posted = 1 THEN le.credit_paisa ELSE 0 END), 0) AS total_credit
        FROM chart_of_accounts c
        LEFT JOIN financial_ledger_entries le ON c.account_id = le.account_id
        LEFT JOIN journal_vouchers jv ON le.voucher_id = jv.voucher_id
        WHERE c.is_active = 1
        GROUP BY c.account_id
    """)
    rows = cur.fetchall()

    total_assets = 0
    total_liabilities = 0
    total_equity = 0
    revenue_net = 0
    cogs_total = 0
    expenses_total = 0

    for r in rows:
        acc_type, acc_cat, deb, cred = r[1], r[2], r[3], r[4]
        if acc_type == "ASSET":
            total_assets += (deb - cred)
        elif acc_type == "LIABILITY":
            total_liabilities += (cred - deb)
        elif acc_type == "EQUITY":
            total_equity += (cred - deb)
        elif acc_type == "REVENUE":
            if acc_cat in ("SALES_RETURNS_ALLOWANCES", "DISCOUNT_GIVEN"):
                revenue_net -= (deb - cred)
            else:
                revenue_net += (cred - deb)
        elif acc_type == "EXPENSE":
            if acc_cat == "COST_OF_GOODS_SOLD":
                cogs_total += (deb - cred)
            else:
                expenses_total += (deb - cred)

    gross_profit = revenue_net - cogs_total
    net_operating_profit = gross_profit - expenses_total
    total_equity_with_earnings = total_equity + net_operating_profit
    total_liab_and_equity = total_liabilities + total_equity_with_earnings

    print(f"  Net Sales Revenue:        Rs. {revenue_net / 100:,.2f}")
    print(f"  COGS:                     Rs. {cogs_total / 100:,.2f}")
    print(f"  Gross Profit:             Rs. {gross_profit / 100:,.2f}")
    print(f"  Operating Expenses:       Rs. {expenses_total / 100:,.2f}")
    print(f"  Net Operating Profit:     Rs. {net_operating_profit / 100:,.2f}")
    print(f"  -------------------------------------------------------------")
    print(f"  Total Assets:             Rs. {total_assets / 100:,.2f} ({total_assets} Paisa)")
    print(f"  Total Liabilities:        Rs. {total_liabilities / 100:,.2f} ({total_liabilities} Paisa)")
    print(f"  Total Equity (+Earnings): Rs. {total_equity_with_earnings / 100:,.2f} ({total_equity_with_earnings} Paisa)")
    print(f"  Total Liab + Equity:      Rs. {total_liab_and_equity / 100:,.2f} ({total_liab_and_equity} Paisa)")

    variance = total_assets - total_liab_and_equity
    print(f"  Accounting Variance:      Rs. {variance / 100:,.2f} ({variance} Paisa)")

    assert variance == 0, f"Balance Sheet Equation Failed! Assets ({total_assets}) != Liabilities+Equity ({total_liab_and_equity})"
    print(f"  [PASS] Balance sheet equation verified: Total Assets == Total Liabilities + Total Equity.")
    passed_count += 1

    conn.close()

    print(f"\n=================================================================")
    print(f"ALL MILESTONE 10 ACCOUNTING TESTS PASSED: {passed_count}/{total_tests} (100% SUCCESS)")
    print(f"=================================================================")

if __name__ == "__main__":
    run_tests()
