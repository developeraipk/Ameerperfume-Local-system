#!/usr/bin/env python3
"""
Seed Milestone 7: Wholesale Customers & Baseline Balances
Workspace: Ameer Perfumes ERP
Target Database: %APPDATA%/AmeerPerfumes/ameer_pos.db
"""

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def seed_wholesale():
    print(f"Connecting to database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")
    
    timestamp = now_iso()
    
    customers = [
        {
            "customer_id": "WC-LHR-001",
            "business_name": "Al-Rehab Luxury Perfumes Lahore",
            "contact_person": "Sheikh Tariq Mehmood",
            "phone": "+92 300 8472910",
            "city": "Lahore",
            "credit_limit_paisa": 100000000, # Rs. 1,000,000 credit limit
            "current_balance_paisa": 0,
        },
        {
            "customer_id": "WC-KHI-002",
            "business_name": "Arabian Nights Fragrance Boutique",
            "contact_person": "Mustafa Al-Hashmi",
            "phone": "+92 321 9876543",
            "city": "Karachi",
            "credit_limit_paisa": 150000000, # Rs. 1,500,000 credit limit
            "current_balance_paisa": 0,
        },
        {
            "customer_id": "WC-ISB-003",
            "business_name": "Sultana Attar & Oud Palace",
            "contact_person": "Haji Abdul Rasheed",
            "phone": "+92 333 5551234",
            "city": "Islamabad",
            "credit_limit_paisa": 75000000, # Rs. 750,000 credit limit
            "current_balance_paisa": 0,
        },
        {
            "customer_id": "WC-PEW-004",
            "business_name": "Balkh & Bukhara Merchants",
            "contact_person": "Mirwais Khan Durrani",
            "phone": "+92 345 7778899",
            "city": "Peshawar",
            "credit_limit_paisa": 50000000, # Rs. 500,000 credit limit
            "current_balance_paisa": 0,
        }
    ]
    
    print("\n--- Seeding Wholesale B2B Customers ---")
    for c in customers:
        cur.execute("""
            INSERT INTO wholesale_customers (
                customer_id, business_name, contact_person, phone, city,
                credit_limit_paisa, current_balance_paisa, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(customer_id) DO UPDATE SET
                business_name = excluded.business_name,
                contact_person = excluded.contact_person,
                phone = excluded.phone,
                city = excluded.city,
                credit_limit_paisa = excluded.credit_limit_paisa,
                updated_at = excluded.updated_at;
        """, (
            c["customer_id"], c["business_name"], c["contact_person"],
            c["phone"], c["city"], c["credit_limit_paisa"],
            c["current_balance_paisa"], timestamp, timestamp
        ))
        print(f"  [+] Wholesale Customer: {c['business_name']} ({c['city']}) | Limit: Rs. {c['credit_limit_paisa']/100:,.2f}")
        
    conn.commit()
    conn.close()
    print("\n[SUCCESS] Milestone 7 Wholesale customer data seeded successfully!")

if __name__ == "__main__":
    seed_wholesale()
