"""
Ameer Perfumes ERP — Milestone 10 Seed Data Script
Chart of Accounts & General Ledger Opening Balances
"""

import sqlite3
import os
from datetime import datetime, timezone

def get_db_path():
    appdata = os.getenv("APPDATA") or os.path.expanduser("~")
    return os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

def seed_milestone10():
    db_path = get_db_path()
    print(f"Connecting to SQLite database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    now = datetime.now(timezone.utc).isoformat()

    # 1. Standard Chart of Accounts
    accounts = [
        # Assets
        ("acc_1010", "1010", "Cash in Hand (Counter Float)", "ASSET", "CASH", "DEBIT", None),
        ("acc_1020", "1020", "Bank & Raast Digital Clearing", "ASSET", "BANK", "DEBIT", None),
        ("acc_1110", "1110", "Accounts Receivable (Wholesale Debtors)", "ASSET", "ACCOUNTS_RECEIVABLE", "DEBIT", None),
        ("acc_1200", "1200", "Raw Materials Inventory", "ASSET", "INVENTORY_RAW_MATERIALS", "DEBIT", None),
        ("acc_1205", "1205", "Work-in-Progress Inventory", "ASSET", "INVENTORY_WIP", "DEBIT", None),
        ("acc_1210", "1210", "Finished Goods Inventory (Perfumes)", "ASSET", "INVENTORY_FINISHED_GOODS", "DEBIT", None),
        ("acc_1510", "1510", "Shop Fixtures & Decanting Equipment", "ASSET", "EQUIPMENT_ASSETS", "DEBIT", None),
        # Liabilities
        ("acc_2010", "2010", "Accounts Payable (Suppliers)", "LIABILITY", "ACCOUNTS_PAYABLE", "CREDIT", None),
        ("acc_2020", "2020", "Customer Store Credit Liability", "LIABILITY", "CUSTOMER_STORE_CREDIT_LIABILITY", "CREDIT", None),
        # Equity
        ("acc_3010", "3010", "Owner Capital & Equity", "EQUITY", "CAPITAL", "CREDIT", None),
        # Revenues
        ("acc_4010", "4010", "Retail Perfume Sales Revenue", "REVENUE", "SALES_REVENUE", "CREDIT", None),
        ("acc_4020", "4020", "Wholesale Sales Revenue", "REVENUE", "SALES_REVENUE", "CREDIT", None),
        ("acc_4030", "4030", "Attar Decant Sales Revenue", "REVENUE", "SALES_REVENUE", "CREDIT", None),
        ("acc_4110", "4110", "Sales Returns & Allowances", "REVENUE", "SALES_RETURNS_ALLOWANCES", "DEBIT", None),
        ("acc_4120", "4120", "Customer Discounts Given", "REVENUE", "DISCOUNT_GIVEN", "DEBIT", None),
        # Expenses
        ("acc_5010", "5010", "Cost of Goods Sold - Perfumes", "EXPENSE", "COST_OF_GOODS_SOLD", "DEBIT", None),
        ("acc_6010", "6010", "Shop Operating & Petty Expenses", "EXPENSE", "SHOP_EXPENSE", "DEBIT", None),
        ("acc_6020", "6020", "Staff Salaries & Commissions", "EXPENSE", "SALARIES_COMMISSIONS", "DEBIT", None),
        ("acc_6030", "6030", "Inventory Shrinkage & Adjustment Expense", "EXPENSE", "INVENTORY_ADJUSTMENT_EXPENSE", "DEBIT", None),
    ]

    for acc in accounts:
        cur.execute("""
            INSERT INTO chart_of_accounts (
                account_id, account_code, account_name, account_type, account_category, 
                normal_balance, parent_account_id, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                account_code = excluded.account_code,
                account_name = excluded.account_name,
                account_type = excluded.account_type,
                account_category = excluded.account_category,
                normal_balance = excluded.normal_balance,
                updated_at = excluded.updated_at
        """, (acc[0], acc[1], acc[2], acc[3], acc[4], acc[5], acc[6], now, now))

    print(f"Seeded/Updated {len(accounts)} accounts in chart_of_accounts.")

    # 2. Seed Opening Balance Voucher if not present
    cur.execute("SELECT COUNT(*) FROM journal_vouchers WHERE voucher_number = 'JV-2026-OPENING'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO journal_vouchers (
                voucher_id, voucher_number, voucher_date, voucher_type, source_module, 
                source_document_id, description, is_posted, is_immutable, posted_by_user_id, created_at
            ) VALUES (
                'jv_opening_2026', 'JV-2026-OPENING', '2026-01-01', 'STANDARD', 'GL',
                'DOC-OPENING-01', 'Initial Opening Balance & Capital Allocation FY2026',
                0, 0, 'usr_mgr1', ?
            )
        """, (now,))

        opening_entries = [
            # Debits (Assets) = 3,000,000 PKR = 300,000,000 Paisa
            ("entry_op_1", "jv_opening_2026", "acc_1010", "DEBIT", 20000000, 0, "Cash Float"),
            ("entry_op_2", "jv_opening_2026", "acc_1020", "DEBIT", 100000000, 0, "Bank Balance"),
            ("entry_op_3", "jv_opening_2026", "acc_1200", "DEBIT", 50000000, 0, "Raw Materials Stock"),
            ("entry_op_4", "jv_opening_2026", "acc_1210", "DEBIT", 80000000, 0, "Finished Perfumes Stock"),
            ("entry_op_5", "jv_opening_2026", "acc_1510", "DEBIT", 50000000, 0, "Decanting Equipment"),
            # Credits (Liabilities + Equity) = 3,000,000 PKR = 300,000,000 Paisa
            ("entry_op_6", "jv_opening_2026", "acc_2010", "CREDIT", 0, 50000000, "Opening Accounts Payable"),
            ("entry_op_7", "jv_opening_2026", "acc_3010", "CREDIT", 0, 250000000, "Owner Contributed Capital"),
        ]

        for e in opening_entries:
            cur.execute("""
                INSERT INTO financial_ledger_entries (
                    entry_id, voucher_id, account_id, entry_side, debit_paisa, credit_paisa, 
                    currency, memo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'PKR', ?, ?)
            """, (e[0], e[1], e[2], e[3], e[4], e[5], e[6], now))

        # Post the opening voucher (fires balance check & sets immutable)
        cur.execute("UPDATE journal_vouchers SET is_posted = 1 WHERE voucher_id = 'jv_opening_2026'")
        print("Created and posted Opening Balance Journal Voucher (JV-2026-OPENING) with 7 balanced lines.")

    conn.commit()
    conn.close()
    print("Milestone 10 Seed Completed Successfully.")

if __name__ == "__main__":
    seed_milestone10()
