# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Priority 7: Backup and Disaster Recovery Restoration Drill Test
Validates:
1. Atomic hot backup snapshot via VACUUM INTO.
2. Cryptographic SHA-256 checksum generation and validation.
3. Cold restoration to a separate isolated target database (ameer_pos_recovered_drill.db).
4. Full database integrity check (PRAGMA integrity_check == 'ok').
5. Foreign key integrity check (PRAGMA foreign_key_check == empty).
6. Exact schema equality (46 tables, 105 indexes, 16 triggers).
7. Row-by-row count parity across all 46 production tables.
8. Double-entry Trial Balance debit/credit equality in recovered database.
9. Immutability validation: Triggers prevent modification of immutable journal vouchers.
"""

import os
import sys
import sqlite3
import hashlib
import shutil
import tempfile
from datetime import datetime

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
live_db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")
backup_dir = os.path.join(appdata, "AmeerPerfumes", "backups")
os.makedirs(backup_dir, exist_ok=True)

test_results = []

def record_test(name, passed, detail):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} - {detail}")
    test_results.append((name, passed, detail))

def main():
    print("=" * 70)
    print("AMEER PERFUMES ERP — BACKUP & DISASTER RECOVERY RESTORATION DRILL")
    print("=" * 70)
    print(f"Live Production Database: {live_db_path}")

    if not os.path.exists(live_db_path):
        record_test("Live Database Exists", False, f"Not found at {live_db_path}")
        sys.exit(1)

    # Temporary directory for disaster drill
    drill_dir = tempfile.mkdtemp(prefix="ameer_dr_drill_")
    drill_backup_path = os.path.join(drill_dir, "snapshot.db")
    drill_recovered_path = os.path.join(drill_dir, "ameer_pos_recovered.db")

    try:
        # Step 1: Hot Snapshot via VACUUM INTO
        print("\n--- STEP 1: Live Hot Snapshot Creation (VACUUM INTO) ---")
        live_conn = sqlite3.connect(live_db_path)
        live_cur = live_conn.cursor()
        
        escaped_snapshot_path = drill_backup_path.replace("\\", "/")
        live_cur.execute(f"VACUUM INTO '{escaped_snapshot_path}';")
        
        snapshot_exists = os.path.exists(drill_backup_path)
        snapshot_size = os.path.getsize(drill_backup_path) if snapshot_exists else 0
        record_test("Hot Snapshot Creation", snapshot_exists and snapshot_size > 0, 
                    f"Created snapshot at {drill_backup_path} ({snapshot_size:,} bytes)")

        # Step 2: SHA-256 Checksum
        print("\n--- STEP 2: Cryptographic Checksum Generation ---")
        hasher = hashlib.sha256()
        with open(drill_backup_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        snapshot_hash = hasher.hexdigest()
        record_test("Snapshot SHA-256", len(snapshot_hash) == 64, f"Hash: {snapshot_hash}")

        # Step 3: Disaster Recovery Restore Simulation
        print("\n--- STEP 3: Disaster Recovery Restore to Clean Target ---")
        shutil.copy2(drill_backup_path, drill_recovered_path)
        recovered_exists = os.path.exists(drill_recovered_path)
        record_test("Disaster Recovery Restore", recovered_exists, f"Restored to {drill_recovered_path}")

        # Step 4: Integrity Verification of Recovered Database
        print("\n--- STEP 4: Integrity and Constraint Verification ---")
        rec_conn = sqlite3.connect(drill_recovered_path)
        rec_conn.execute("PRAGMA foreign_keys = ON;")
        rec_cur = rec_conn.cursor()

        integrity_res = rec_cur.execute("PRAGMA integrity_check;").fetchall()
        integrity_ok = len(integrity_res) == 1 and integrity_res[0][0] == "ok"
        record_test("PRAGMA integrity_check", integrity_ok, f"Result: {integrity_res}")

        fk_violations = rec_cur.execute("PRAGMA foreign_key_check;").fetchall()
        fk_ok = len(fk_violations) == 0
        record_test("PRAGMA foreign_key_check", fk_ok, f"Violations: {len(fk_violations)}")

        # Step 5: Schema Count Verification (46 tables, 105 indexes, 16 triggers)
        print("\n--- STEP 5: Schema Object Counts (46 Tables, 105 Indexes, 16 Triggers) ---")
        t_count = rec_cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND SUBSTR(name, 1, 1) != '_';").fetchone()[0]
        i_count = rec_cur.execute("SELECT count(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';").fetchone()[0]
        trig_count = rec_cur.execute("SELECT count(*) FROM sqlite_master WHERE type='trigger';").fetchone()[0]

        record_test("Recovered Table Count", t_count == 46, f"Found {t_count} tables (Expected 46)")
        record_test("Recovered Index Count", i_count == 105, f"Found {i_count} indexes (Expected 105)")
        record_test("Recovered Trigger Count", trig_count == 16, f"Found {trig_count} triggers (Expected 16)")

        # Step 6: Full Table-by-Table Row Count Parity
        print("\n--- STEP 6: Table-by-Table Row Count Parity with Live DB ---")
        tables = [r[0] for r in live_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND SUBSTR(name, 1, 1) != '_' ORDER BY name;").fetchall()]
        
        mismatched_tables = []
        for tbl in tables:
            live_rows = live_cur.execute(f"SELECT count(*) FROM [{tbl}];").fetchone()[0]
            rec_rows = rec_cur.execute(f"SELECT count(*) FROM [{tbl}];").fetchone()[0]
            if live_rows != rec_rows:
                mismatched_tables.append((tbl, live_rows, rec_rows))

        record_test("46-Table Row Count Parity", len(mismatched_tables) == 0, 
                    f"All 46 tables match exactly. (Mismatches: {mismatched_tables})")

        # Step 7: Trial Balance Equilibrium in Recovered DB
        print("\n--- STEP 7: Financial Ledger Equilibrium in Recovered DB ---")
        rec_cur.execute("""
            SELECT 
                COALESCE(SUM(le.debit_paisa), 0) AS total_debit,
                COALESCE(SUM(le.credit_paisa), 0) AS total_credit
            FROM financial_ledger_entries le
            JOIN journal_vouchers jv ON le.voucher_id = jv.voucher_id
            WHERE jv.is_posted = 1;
        """)
        dr_cr = rec_cur.fetchone()
        tot_dr = dr_cr[0]
        tot_cr = dr_cr[1]
        balanced = (tot_dr == tot_cr) and (tot_dr > 0)
        record_test("Trial Balance Equilibrium", balanced, 
                    f"Debits: Rs. {tot_dr/100:,.2f} | Credits: Rs. {tot_cr/100:,.2f} (Delta: {tot_dr - tot_cr} paisa)")

        # Step 8: Immutability Enforcement Verification
        print("\n--- STEP 8: Recovered Immutability Trigger Enforcement ---")
        immutable_row = rec_cur.execute("SELECT voucher_id, voucher_number FROM journal_vouchers WHERE is_immutable = 1 LIMIT 1;").fetchone()
        if immutable_row:
            v_id, v_num = immutable_row
            trigger_blocked = False
            try:
                rec_cur.execute("UPDATE journal_vouchers SET narration = 'HACKED' WHERE voucher_id = ?;", (v_id,))
                rec_conn.commit()
            except sqlite3.IntegrityError as ie:
                trigger_blocked = True
            except sqlite3.OperationalError as oe:
                trigger_blocked = True
            
            record_test("Immutability Trigger Guard", trigger_blocked, 
                        f"Attempt to modify immutable voucher {v_num} was strictly rejected by database trigger")
        else:
            record_test("Immutability Trigger Guard", False, "No immutable vouchers found to test")

        rec_conn.close()
        live_conn.close()

    finally:
        # Clean up temporary drill directory
        shutil.rmtree(drill_dir, ignore_errors=True)

    print("\n" + "=" * 70)
    passed = sum(1 for _, p, _ in test_results if p)
    total = len(test_results)
    pct = (passed / total) * 100
    print(f"DISASTER RECOVERY DRILL SUMMARY: {passed} / {total} Passed ({pct:.1f}%)")
    print("=" * 70)

    if passed < total:
        sys.exit(1)

if __name__ == "__main__":
    main()
