#!/usr/bin/env python3
"""
Seed Milestone 6: Manufacturing BOM Recipes & Initial Batches
Workspace: Ameer Perfumes ERP
Target Database: %APPDATA%/AmeerPerfumes/ameer_pos.db
"""

import sqlite3
import os
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.expandvars(r"%APPDATA%\AmeerPerfumes\ameer_pos.db")

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def seed_manufacturing():
    print(f"Connecting to database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")
    
    timestamp = now_iso()
    
    # 1. Seed Perfume Recipes
    recipes = [
        {
            "recipe_id": "RCP-OUD-50",
            "finished_product_id": "FP-OUD-ROYAL-50",
            "recipe_version": 1,
            "batch_output_units": 100,
            "instructions": "Blend aged Cambodian Oud with Ambergris accord at 18°C. Macerate with 99.9% denatured cosmetic ethanol for 21 days before chilling to 4°C, multi-stage filtration, and bottling into 50ml French crystal bottles.",
            "items": [
                ("RM-BOT-50ML-CLEAR", 100.0),
                ("RM-CAP-MAG-GOLD", 100.0),
                ("RM-PUMP-MIST-GOLD", 100.0),
                ("RM-BOX-RIGID-LUX", 100.0),
                ("RM-OIL-OUD-CAMB", 750.0),
                ("RM-OIL-AMBER-GREY", 250.0),
                ("RM-ETH-99", 4.0),
            ]
        },
        {
            "recipe_id": "RCP-ROSE-50",
            "finished_product_id": "FP-ROSE-TAIF-50",
            "recipe_version": 1,
            "batch_output_units": 100,
            "instructions": "Dissolve pure Taif mountain rose absolute gently in cosmetic ethanol. Macerate for 14 days under dark climate-controlled conditions. Filter and package into 50ml French crystal bottles.",
            "items": [
                ("RM-BOT-50ML-CLEAR", 100.0),
                ("RM-CAP-MAG-GOLD", 100.0),
                ("RM-PUMP-MIST-GOLD", 100.0),
                ("RM-BOX-RIGID-LUX", 100.0),
                ("RM-OIL-ROSE-TAIF", 1000.0),
                ("RM-ETH-99", 4.0),
            ]
        },
        {
            "recipe_id": "RCP-OUD-100",
            "finished_product_id": "FP-OUD-ROYAL-100",
            "recipe_version": 1,
            "batch_output_units": 50,
            "instructions": "Scale formulation for 100ml luxury bottles. 15g Cambodian Oud per bottle macerated with ambergris accord and ethanol. Cold filtered and hand filled.",
            "items": [
                ("RM-BOT-100ML-CLEAR", 50.0),
                ("RM-CAP-MAG-GOLD", 50.0),
                ("RM-PUMP-MIST-GOLD", 50.0),
                ("RM-BOX-RIGID-LUX", 50.0),
                ("RM-OIL-OUD-CAMB", 750.0),
                ("RM-OIL-AMBER-GREY", 250.0),
                ("RM-ETH-99", 4.0),
            ]
        }
    ]
    
    print("\n--- Seeding Perfume Recipes & BOM Items ---")
    for r in recipes:
        cur.execute("""
            INSERT INTO perfume_recipes (
                recipe_id, finished_product_id, recipe_version, batch_output_units,
                instructions, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(recipe_id) DO UPDATE SET
                instructions = excluded.instructions,
                batch_output_units = excluded.batch_output_units,
                updated_at = excluded.updated_at
        """, (r["recipe_id"], r["finished_product_id"], r["recipe_version"], r["batch_output_units"], r["instructions"], timestamp, timestamp))
        
        for mat_id, qty in r["items"]:
            item_id = f"RCI-{r['recipe_id']}-{mat_id}"
            cur.execute("""
                INSERT INTO perfume_recipe_items (
                    item_id, recipe_id, raw_material_id, quantity_required, created_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(recipe_id, raw_material_id) DO UPDATE SET
                    quantity_required = excluded.quantity_required
            """, (item_id, r["recipe_id"], mat_id, qty, timestamp))
            
        print(f"  [+] Recipe seeded: {r['recipe_id']} for {r['finished_product_id']} ({len(r['items'])} BOM items)")

    # 2. Seed an initial planned batch
    cur.execute("SELECT user_id FROM users WHERE username = 'admin' LIMIT 1")
    admin_user = cur.fetchone()[0]
    
    sample_batch_id = "BATCH-2026-001"
    cur.execute("""
        INSERT INTO manufacturing_batches (
            batch_id, batch_number, recipe_id, finished_product_id,
            planned_units, produced_units, total_cost_paisa, cost_per_unit_paisa,
            status, production_date, created_by_user_id, notes,
            created_at, updated_at
        ) VALUES (
            ?, 'B-2026-001', 'RCP-OUD-50', 'FP-OUD-ROYAL-50',
            100, 0, 0, 0,
            'PLANNED', '2026-11-10', ?, 'Master initial production run of Oud Royal 50ml EDP',
            ?, ?
        )
        ON CONFLICT(batch_id) DO NOTHING
    """, (sample_batch_id, admin_user, timestamp, timestamp))
    
    conn.commit()
    conn.close()
    print("\n[SUCCESS] Milestone 6 Manufacturing seed data applied successfully!")

if __name__ == "__main__":
    seed_manufacturing()
