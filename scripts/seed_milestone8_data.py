#!/usr/bin/env python3
"""
Seed Milestone 8: Attar Products (Stockless Decants)
Workspace: Ameer Perfumes ERP
Target Database: %APPDATA%/AmeerPerfumes/ameer_pos.db
"""

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def seed_attars():
    print(f"Connecting to database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")
    
    timestamp = now_iso()
    
    attars = [
        {
            "attar_id": "ATR-OUD-CAMB",
            "sku": "ATR-OUD-CAMB",
            "name": "Dehn Al Oud Cambodi Special (Pure Aged)",
            "origin_country": "Cambodia",
            "density_grams_per_ml": 1050, # 1.050 g/ml
            "cost_per_tola_paisa": 3500000,
            "selling_price_per_tola_paisa": 5500000,
            "cost_per_half_tola_paisa": 1800000,
            "selling_price_half_tola_paisa": 2900000,
            "cost_per_quarter_tola_paisa": 950000,
            "selling_price_quarter_tola_paisa": 1550000,
            "cost_per_ml_paisa": 300000,
            "selling_price_per_ml_paisa": 500000,
            "cost_per_gram_paisa": 310000,
            "selling_price_per_gram_paisa": 520000,
            "cost_per_bottle_paisa": 50000,
            "selling_price_bottle_paisa": 100000,
        },
        {
            "attar_id": "ATR-ROSE-TAIF",
            "sku": "ATR-ROSE-TAIF",
            "name": "Taif Rose Royal Absolute (Wardh Taifi)",
            "origin_country": "Saudi Arabia",
            "density_grams_per_ml": 980, # 0.980 g/ml
            "cost_per_tola_paisa": 2500000,
            "selling_price_per_tola_paisa": 4200000,
            "cost_per_half_tola_paisa": 1300000,
            "selling_price_half_tola_paisa": 2200000,
            "cost_per_quarter_tola_paisa": 700000,
            "selling_price_quarter_tola_paisa": 1200000,
            "cost_per_ml_paisa": 220000,
            "selling_price_per_ml_paisa": 380000,
            "cost_per_gram_paisa": 230000,
            "selling_price_per_gram_paisa": 400000,
            "cost_per_bottle_paisa": 50000,
            "selling_price_bottle_paisa": 100000,
        },
        {
            "attar_id": "ATR-MUSK-GHAZAL",
            "sku": "ATR-MUSK-GHAZAL",
            "name": "Musk Ghazal Pure Wild Deer Musk Accord",
            "origin_country": "Kashmir",
            "density_grams_per_ml": 1020, # 1.020 g/ml
            "cost_per_tola_paisa": 4500000,
            "selling_price_per_tola_paisa": 7500000,
            "cost_per_half_tola_paisa": 2350000,
            "selling_price_half_tola_paisa": 3950000,
            "cost_per_quarter_tola_paisa": 1200000,
            "selling_price_quarter_tola_paisa": 2100000,
            "cost_per_ml_paisa": 390000,
            "selling_price_per_ml_paisa": 650000,
            "cost_per_gram_paisa": 400000,
            "selling_price_per_gram_paisa": 680000,
            "cost_per_bottle_paisa": 50000,
            "selling_price_bottle_paisa": 100000,
        },
        {
            "attar_id": "ATR-RUH-KHUS",
            "sku": "ATR-RUH-KHUS",
            "name": "Ruh Al Khus (Pure Wild Vetiver Root)",
            "origin_country": "India",
            "density_grams_per_ml": 1010, # 1.010 g/ml
            "cost_per_tola_paisa": 1200000,
            "selling_price_per_tola_paisa": 2200000,
            "cost_per_half_tola_paisa": 650000,
            "selling_price_half_tola_paisa": 1200000,
            "cost_per_quarter_tola_paisa": 350000,
            "selling_price_quarter_tola_paisa": 650000,
            "cost_per_ml_paisa": 110000,
            "selling_price_per_ml_paisa": 200000,
            "cost_per_gram_paisa": 115000,
            "selling_price_per_gram_paisa": 210000,
            "cost_per_bottle_paisa": 50000,
            "selling_price_bottle_paisa": 100000,
        }
    ]
    
    print("\n--- Seeding Luxury Stockless Attars ---")
    for a in attars:
        cur.execute("""
            INSERT INTO attar_products (
                attar_id, sku, name, origin_country, density_grams_per_ml,
                cost_per_tola_paisa, selling_price_per_tola_paisa,
                cost_per_half_tola_paisa, selling_price_half_tola_paisa,
                cost_per_quarter_tola_paisa, selling_price_quarter_tola_paisa,
                cost_per_ml_paisa, selling_price_per_ml_paisa,
                cost_per_gram_paisa, selling_price_per_gram_paisa,
                cost_per_bottle_paisa, selling_price_bottle_paisa,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(attar_id) DO UPDATE SET
                name = excluded.name,
                origin_country = excluded.origin_country,
                density_grams_per_ml = excluded.density_grams_per_ml,
                cost_per_tola_paisa = excluded.cost_per_tola_paisa,
                selling_price_per_tola_paisa = excluded.selling_price_per_tola_paisa,
                cost_per_half_tola_paisa = excluded.cost_per_half_tola_paisa,
                selling_price_half_tola_paisa = excluded.selling_price_half_tola_paisa,
                cost_per_quarter_tola_paisa = excluded.cost_per_quarter_tola_paisa,
                selling_price_quarter_tola_paisa = excluded.selling_price_quarter_tola_paisa,
                cost_per_ml_paisa = excluded.cost_per_ml_paisa,
                selling_price_per_ml_paisa = excluded.selling_price_per_ml_paisa,
                updated_at = excluded.updated_at;
        """, (
            a["attar_id"], a["sku"], a["name"], a["origin_country"], a["density_grams_per_ml"],
            a["cost_per_tola_paisa"], a["selling_price_per_tola_paisa"],
            a["cost_per_half_tola_paisa"], a["selling_price_half_tola_paisa"],
            a["cost_per_quarter_tola_paisa"], a["selling_price_quarter_tola_paisa"],
            a["cost_per_ml_paisa"], a["selling_price_per_ml_paisa"],
            a["cost_per_gram_paisa"], a["selling_price_per_gram_paisa"],
            a["cost_per_bottle_paisa"], a["selling_price_bottle_paisa"],
            timestamp, timestamp
        ))
        print(f"  [+] Attar: {a['name']} ({a['origin_country']}) | Density: {a['density_grams_per_ml']/1000:.3f} g/ml | Tola: Rs. {a['selling_price_per_tola_paisa']/100:,.2f}")
        
    conn.commit()
    conn.close()
    print("\n[SUCCESS] Milestone 8 Attar seed data applied successfully!")

if __name__ == "__main__":
    seed_attars()
