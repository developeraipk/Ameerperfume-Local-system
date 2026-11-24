# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Milestone 3 Database Seeding Script
Populates the persistent SQLite database at %APPDATA%/AmeerPerfumes/ameer_pos.db with:
1. System Users (Super Admin, Shop Manager, Cashier, Owner)
2. Salespersons (Counter staff)
3. Chart of Accounts (Cash, Inventory, Revenue, COGS)
4. Active Cash Register Shift (for POS-01)
5. Finished Perfume Catalog (7 luxury artisanal fragrances matching Phase 2.3.1 enum)
6. Initial Stock Ledger Movements
"""

import os
import sqlite3
import datetime

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

print(f"Connecting to persistent database: {db_path}")

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

def seed_database():
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")

    with conn:
        # 1. Seed Users
        users = [
            ("usr_admin", "admin", "hash_admin_placeholder", "hash_pin_1111", "Muhammad Adnan (Super Admin)", "SUPER_ADMIN", 1, now, now),
            ("usr_mgr", "manager", "hash_mgr_placeholder", "hash_pin_2222", "Tariq Mahmood (Shop Manager)", "SHOP_MANAGER", 1, now, now),
            ("usr_cashier1", "cashier1", "hash_cashier1_placeholder", "hash_pin_3333", "Counter Operator 1", "CASHIER_OPERATOR", 1, now, now),
            ("usr_owner", "owner", "hash_owner_placeholder", "hash_pin_4444", "Ameer Hamza (Owner)", "OWNER", 1, now, now),
        ]
        conn.executemany("""
            INSERT OR REPLACE INTO users 
            (user_id, username, password_hash, pin_salt_hash, full_name, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, users)
        print(f"[SEED] Seeded {len(users)} system users.")

        # 2. Seed Salespersons (Internal counter staff attribution)
        salespersons = [
            ("sp_01", "EMP-101", "Bilal Ahmed", "+92 300 1234567", 1, now, now),
            ("sp_02", "EMP-102", "Zainab Bibi", "+92 301 2345678", 1, now, now),
            ("sp_03", "EMP-103", "Hamza Ali", "+92 302 3456789", 1, now, now),
        ]
        conn.executemany("""
            INSERT OR REPLACE INTO salespersons
            (salesperson_id, employee_code, full_name, phone, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, salespersons)
        print(f"[SEED] Seeded {len(salespersons)} salespersons.")

        # 3. Seed Chart of Accounts
        accounts = [
            ("acc_1010", "1010", "Cash in Hand (Counter Float)", "ASSET", "CASH", "DEBIT", None, 1, now, now),
            ("acc_1020", "1020", "Bank & Raast Digital Clearing", "ASSET", "BANK", "DEBIT", None, 1, now, now),
            ("acc_1210", "1210", "Finished Goods Inventory (Perfumes)", "ASSET", "INVENTORY_FINISHED_GOODS", "DEBIT", None, 1, now, now),
            ("acc_2010", "2010", "Accounts Payable (Suppliers)", "LIABILITY", "ACCOUNTS_PAYABLE", "CREDIT", None, 1, now, now),
            ("acc_2020", "2020", "Customer Store Credit Liability", "LIABILITY", "CUSTOMER_STORE_CREDIT_LIABILITY", "CREDIT", None, 1, now, now),
            ("acc_4010", "4010", "Retail Perfume Sales Revenue", "REVENUE", "SALES_REVENUE", "CREDIT", None, 1, now, now),
            ("acc_4020", "4020", "Wholesale Sales Revenue", "REVENUE", "SALES_REVENUE", "CREDIT", None, 1, now, now),
            ("acc_5010", "5010", "Cost of Goods Sold - Perfumes", "EXPENSE", "COST_OF_GOODS_SOLD", "DEBIT", None, 1, now, now),
            ("acc_6010", "6010", "Shop Operating & Petty Expenses", "EXPENSE", "SHOP_EXPENSE", "DEBIT", None, 1, now, now),
        ]
        conn.executemany("""
            INSERT OR REPLACE INTO chart_of_accounts
            (account_id, account_code, account_name, account_type, account_category, normal_balance, parent_account_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, accounts)
        print(f"[SEED] Seeded {len(accounts)} core Chart of Accounts headers.")

        # 4. Seed Active Cash Register Shift for POS-01
        conn.execute("""
            INSERT OR REPLACE INTO cash_register_shifts
            (shift_id, cashier_user_id, terminal_id, opened_at, opening_cash_float_paisa, closed_at, system_expected_cash_paisa, actual_counted_cash_paisa, shift_status, created_at)
            VALUES ('shift_pos01_active', 'usr_cashier1', 'POS-01', ?, 5000000, NULL, 5000000, NULL, 'OPEN', ?);
        """, (now, now))
        print("[SEED] Active cash register shift 'shift_pos01_active' opened for POS-01.")

        # 5. Seed Finished Products Catalog (Using approved enum: 'MENS', 'WOMENS', 'UNISEX', 'ORIENTAL_LUXURY', 'LIMITED_EDITION')
        products = [
            (
                "FP-OUD-ROYAL-50",
                "PR-OUD-50",
                "8964000100101",
                "Oud Royal Eau de Parfum 50ml",
                "Ameer Perfumes",
                50,
                "ORIENTAL_LUXURY",
                25,        # Current Stock Units
                1850000,   # Retail: 18,500 PKR
                1450000,   # Wholesale: 14,500 PKR
                750000,    # Cost: 7,500 PKR
                5,         # Reorder Threshold
                1,
                now,
                now
            ),
            (
                "FP-OUD-ROYAL-100",
                "PR-OUD-100",
                "8964000100102",
                "Oud Royal Eau de Parfum 100ml",
                "Ameer Perfumes",
                100,
                "ORIENTAL_LUXURY",
                18,
                3200000,   # Retail: 32,000 PKR
                2500000,   # Wholesale: 25,000 PKR
                1280000,   # Cost: 12,800 PKR
                4,
                1,
                now,
                now
            ),
            (
                "FP-ROSE-TAIF-50",
                "PR-ROSE-50",
                "8964000100201",
                "Taif Rose Extrait de Parfum 50ml",
                "Ameer Perfumes",
                50,
                "WOMENS",
                30,
                1400000,   # Retail: 14,000 PKR
                1100000,   # Wholesale: 11,000 PKR
                540000,    # Cost: 5,400 PKR
                8,
                1,
                now,
                now
            ),
            (
                "FP-AMBER-NOIR-100",
                "PR-AMB-100",
                "8964000100301",
                "Amber Noir Eau de Parfum 100ml",
                "Ameer Perfumes",
                100,
                "ORIENTAL_LUXURY",
                15,
                2450000,   # Retail: 24,500 PKR
                1900000,   # Wholesale: 19,000 PKR
                960000,    # Cost: 9,600 PKR
                5,
                1,
                now,
                now
            ),
            (
                "FP-MUSK-KASHMIR-50",
                "PR-MUSK-50",
                "8964000100401",
                "Musk Kashmir Cologne 50ml",
                "Ameer Perfumes",
                50,
                "UNISEX",
                40,
                950000,    # Retail: 9,500 PKR
                720000,    # Wholesale: 7,200 PKR
                380000,    # Cost: 3,800 PKR
                10,
                1,
                now,
                now
            ),
            (
                "FP-SAFFRON-GOLD-100",
                "PR-SAF-100",
                "8964000100501",
                "Saffron Gold Eau de Parfum 100ml",
                "Ameer Perfumes",
                100,
                "LIMITED_EDITION",
                12,
                2800000,   # Retail: 28,000 PKR
                2200000,   # Wholesale: 22,000 PKR
                1120000,   # Cost: 11,200 PKR
                3,
                1,
                now,
                now
            ),
            (
                "FP-JASMINE-VELVET-50",
                "PR-JAS-50",
                "8964000100601",
                "Jasmine Velvet Extrait 50ml",
                "Ameer Perfumes",
                50,
                "WOMENS",
                22,
                1250000,   # Retail: 12,500 PKR
                980000,    # Wholesale: 9,800 PKR
                490000,    # Cost: 4,900 PKR
                6,
                1,
                now,
                now
            ),
        ]

        conn.executemany("""
            INSERT OR REPLACE INTO finished_products
            (product_id, sku, barcode, name, brand, size_ml, category, current_stock_units, retail_price_paisa, wholesale_price_paisa, latest_batch_cost_paisa, reorder_threshold_units, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, products)
        print(f"[SEED] Seeded {len(products)} luxury perfume items in product catalog.")

        # 6. Seed Initial Stock Movement Ledger
        for p in products:
            p_id = p[0]
            p_stock = p[7]
            p_cost = p[10]
            mov_id = f"sm_init_{p_id}"
            conn.execute("""
                INSERT OR REPLACE INTO stock_movements
                (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
                VALUES (?, 'FINISHED_PERFUME', NULL, ?, NULL, 'OPENING_STOCK', ?, ?, ?, 'INITIAL_SETUP', 'M3_INIT', 0, 'Initial store inventory baseline', 'usr_admin', ?, ?);
            """, (mov_id, p_id, p_stock, p_cost, p_stock, now, now))
        print("[SEED] Recorded 7 baseline stock movements in stock ledger.")

    conn.close()
    print("=== SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    seed_database()
