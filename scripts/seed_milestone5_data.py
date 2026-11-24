# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Milestone 5 Procurement Seeding Script
Populates:
1. Certified Suppliers (Glassware, Aroma Chemicals, Packaging, Solvents)
2. Raw Material Catalog (French Glass Bottles, Pure Denatured Ethanol, Fragrance Oils, Caps, Pumps)
3. Initial Raw Material Inventory Stock & Movement Ledger
"""

import os
import sqlite3
import datetime

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")
print(f"Connecting to persistent database: {db_path}")

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

def seed_procurement():
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")

    with conn:
        # 1. Seed Suppliers
        suppliers = [
            (
                "sup_01",
                "Grasse Essence & Fragrance Oils",
                "Jean-Paul Laurent",
                "+33 4 93 36 00 00",
                "orders@grasse-essence.fr",
                "Route de Cannes, Grasse",
                "Grasse, France",
                0,
                1,
                now,
                now
            ),
            (
                "sup_02",
                "Al-Haramain Raw Attar Importers",
                "Sheikh Munir Al-Sabah",
                "+92 21 3456 7890",
                "munir@alharamain-oils.pk",
                "Plot 45, Saddar Commercial Area",
                "Karachi, Pakistan",
                0,
                1,
                now,
                now
            ),
            (
                "sup_03",
                "Crystal Luxury Glass & Packaging",
                "Rashid Mehmood",
                "+92 42 3765 4321",
                "sales@crystalluxury.com.pk",
                "Quaid-e-Azam Industrial Estate",
                "Lahore, Pakistan",
                0,
                1,
                now,
                now
            ),
            (
                "sup_04",
                "Punjab Pure Industrial Solvents Ltd",
                "Muhammad Naeem",
                "+92 41 8765 1234",
                "solvents@punjab-pure.com.pk",
                "Sheikhupura Road",
                "Faisalabad, Pakistan",
                0,
                1,
                now,
                now
            ),
        ]

        conn.executemany("""
            INSERT OR REPLACE INTO suppliers
            (supplier_id, company_name, contact_person, phone, email, address, city, current_balance_paisa, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, suppliers)
        print(f"[SEED] Seeded {len(suppliers)} raw material suppliers.")

        # 2. Seed Raw Materials
        # Enums:
        # material_type: 'EMPTY_BOTTLE', 'CAP', 'COLLAR', 'PUMP', 'BOX', 'AROMA_CHEMICAL', 'ETHANOL', 'PACKAGING'
        # unit_of_measure: 'PIECE', 'ML', 'GRAM', 'KG', 'LITER'
        materials = [
            (
                "RM-ETH-99",
                "RM-ETH-99",
                "Pure Cosmetic Grade Ethanol (99.9% Denatured)",
                "ETHANOL",
                "LITER",
                500.0,    # 500 Liters on hand
                45000,    # 450 PKR per liter (45,000 paisa)
                100.0,    # Reorder at 100L
                1,
                now,
                now
            ),
            (
                "RM-OIL-OUD-CAMB",
                "RM-OIL-OUD",
                "Aged Cambodian Pure Agarwood Oil (Dehn Al Oud)",
                "AROMA_CHEMICAL",
                "GRAM",
                2500.0,   # 2,500 Grams on hand
                350000,   # 3,500 PKR per gram (350,000 paisa)
                500.0,
                1,
                now,
                now
            ),
            (
                "RM-OIL-ROSE-TAIF",
                "RM-OIL-ROSE",
                "Pure Taif Mountain Rose Absolute",
                "AROMA_CHEMICAL",
                "GRAM",
                1800.0,   # 1,800 Grams on hand
                220000,   # 2,200 PKR per gram (220,000 paisa)
                400.0,
                1,
                now,
                now
            ),
            (
                "RM-OIL-AMBER-GREY",
                "RM-OIL-AMB",
                "Ambergris & Black Musk Accord",
                "AROMA_CHEMICAL",
                "GRAM",
                3000.0,
                180000,   # 1,800 PKR per gram (180,000 paisa)
                600.0,
                1,
                now,
                now
            ),
            (
                "RM-BOT-50ML-CLEAR",
                "RM-BOT-50",
                "Heavy-Base French Crystal Bottle 50ml",
                "EMPTY_BOTTLE",
                "PIECE",
                1200.0,   # 1,200 Bottles
                38000,    # 380 PKR per bottle (38,000 paisa)
                200.0,
                1,
                now,
                now
            ),
            (
                "RM-BOT-100ML-CLEAR",
                "RM-BOT-100",
                "Heavy-Base French Crystal Bottle 100ml",
                "EMPTY_BOTTLE",
                "PIECE",
                950.0,    # 950 Bottles
                52000,    # 520 PKR per bottle (52,000 paisa)
                200.0,
                1,
                now,
                now
            ),
            (
                "RM-CAP-MAG-GOLD",
                "RM-CAP-GOLD",
                "Magnetic Weighted Zinc Alloy Gold Cap",
                "CAP",
                "PIECE",
                2000.0,   # 2,000 Caps
                24000,    # 240 PKR per cap (24,000 paisa)
                400.0,
                1,
                now,
                now
            ),
            (
                "RM-PUMP-MIST-GOLD",
                "RM-PUMP-GOLD",
                "Micro-Mist Crimp Atomizer Pump (Gold)",
                "PUMP",
                "PIECE",
                2500.0,   # 2,500 Pumps
                16000,    # 160 PKR per pump (16,000 paisa)
                500.0,
                1,
                now,
                now
            ),
            (
                "RM-BOX-RIGID-LUX",
                "RM-BOX-LUX",
                "Handcrafted Velvet-Lined Rigid Magnetic Box",
                "BOX",
                "PIECE",
                1500.0,   # 1,500 Boxes
                45000,    # 450 PKR per box (45,000 paisa)
                300.0,
                1,
                now,
                now
            ),
        ]

        conn.executemany("""
            INSERT OR REPLACE INTO raw_materials
            (material_id, sku, name, material_type, unit_of_measure, current_stock_units, weighted_average_cost_paisa, reorder_threshold_units, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, materials)
        print(f"[SEED] Seeded {len(materials)} raw materials.")

        # 3. Seed Initial Raw Material Stock Movements in Stock Ledger
        for m in materials:
            m_id = m[0]
            m_stock = int(m[5])
            m_cost = m[6]
            mov_id = f"sm_init_rm_{m_id}"
            conn.execute("""
                INSERT OR REPLACE INTO stock_movements
                (movement_id, entity_type, material_id, finished_product_id, batch_id, movement_type, delta_quantity, unit_cost_paisa, running_balance_after, reference_document_type, reference_document_id, shortage_oversell_flag, notes, authorized_by_user_id, occurred_at, created_at)
                VALUES (?, 'RAW_MATERIAL', ?, NULL, NULL, 'OPENING_STOCK', ?, ?, ?, 'INITIAL_SETUP', 'M5_INIT', 0, 'Initial raw material inventory baseline', 'usr_admin', ?, ?);
            """, (mov_id, m_id, m_stock, m_cost, m_stock, now, now))
        print("[SEED] Recorded 9 baseline raw material stock movements in stock ledger.")

    conn.close()
    print("=== PROCUREMENT SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    seed_procurement()
