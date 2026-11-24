# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Master Regression Test Battery Runner
Executes all 22 automated test suites covering all 17 milestones and v4.1.0 production priorities.
"""

import sys
import os
import subprocess
import time

SUITES = [
    ("Milestone 2: Persistent SQLite Engine", "scripts/test_persistent_sqlite.py"),
    ("Milestone 3: POS Billing Engine", "scripts/test_pos_billing.py"),
    ("Milestone 4: Procurement & AP", "scripts/test_procurement.py"),
    ("Milestone 5: Manufacturing & BOM", "scripts/test_manufacturing.py"),
    ("Milestone 6: Wholesale & AR", "scripts/test_wholesale.py"),
    ("Milestone 7: Returns & Quarantine", "scripts/test_returns_and_credits.py"),
    ("Milestone 8: Attar Stockless Sales", "scripts/test_attar.py"),
    ("Milestone 9: Shifts & Cash Expenses", "scripts/test_shifts_and_expenses.py"),
    ("Milestone 10: Double-Entry GL Accounting", "scripts/test_accounting.py"),
    ("Milestone 11: Real-Time Reporting", "scripts/test_reporting.py"),
    ("Milestone 12: LAN Sync Engine", "scripts/test_sync.py"),
    ("Milestone 13: Cloud Backend & Auth", "scripts/test_cloud_backend.py"),
    ("Milestone 14: Hot Backup Engine", "scripts/test_backup.py"),
    ("Milestone 15: Hardware Peripherals", "scripts/test_hardware.py"),
    ("Priority 1: Blind Cash Reconciliation", "scripts/test_blind_reconciliation.py"),
    ("Priority 2: Physical LAN TCP Mesh Sync", "scripts/test_lan_tcp_mesh.py"),
    ("Priority 3: Native Cloud HTTP Sync Client", "scripts/test_cloud_http_sync.py"),
    ("Priority 4: Real Windows Spooler & COM HW", "scripts/test_hardware_real.py"),
    ("Priority 5: Salted PIN & Rate Limiting", "scripts/test_auth_security.py"),
    ("Priority 6: Master Database & GL Integrity", "scripts/test_database_integrity_master.py"),
    ("Priority 7: Backup Disaster Recovery Drill", "scripts/test_backup_restore.py"),
    ("Milestone 17: End-to-End Workflows", "scripts/verify_real_world_workflows.py"),
]

def main():
    print("=" * 80)
    print("AMEER PERFUMES ERP — MASTER PRODUCTION REGRESSION BATTERY (v4.1.0)")
    print("=" * 80)
    print(f"Start Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total Test Suites to Run: {len(SUITES)}")
    print("=" * 80 + "\n")

    results = []
    start_total = time.time()

    for idx, (title, script_path) in enumerate(SUITES, 1):
        if not os.path.exists(script_path):
            print(f"[{idx:02d}/{len(SUITES)}] [SKIP] {title} - File not found: {script_path}")
            results.append((title, "SKIPPED", 0.0, "File not found"))
            continue

        print(f"[{idx:02d}/{len(SUITES)}] RUNNING: {title} ({script_path})...", end=" ", flush=True)
        t0 = time.time()
        
        proc = subprocess.run([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        duration = time.time() - t0

        if proc.returncode == 0:
            print(f"[PASS] ({duration:.2f}s)")
            results.append((title, "PASS", duration, proc.stdout))
        else:
            print(f"[FAIL] ({duration:.2f}s)")
            print(f"--- STDERR ---\n{proc.stderr}\n--- STDOUT ---\n{proc.stdout}")
            results.append((title, "FAIL", duration, proc.stderr or proc.stdout))

    total_duration = time.time() - start_total

    print("\n" + "=" * 80)
    print("MASTER REGRESSION BATTERY SCORECARD")
    print("=" * 80)
    
    passed_count = sum(1 for _, st, _, _ in results if st == "PASS")
    failed_count = sum(1 for _, st, _, _ in results if st == "FAIL")
    skipped_count = sum(1 for _, st, _, _ in results if st == "SKIPPED")
    total_count = len(results)

    for idx, (title, st, dur, _) in enumerate(results, 1):
        status_str = f"[{st}]".ljust(10)
        print(f"  {idx:02d}. {status_str} {title:<45} ({dur:.2f}s)")

    print("-" * 80)
    print(f"TOTAL RESULTS: {passed_count} PASSED | {failed_count} FAILED | {skipped_count} SKIPPED | TOTAL: {total_count}")
    pass_pct = (passed_count / total_count) * 100 if total_count > 0 else 0
    print(f"SUCCESS RATE : {pass_pct:.1f}%")
    print(f"TOTAL TIME   : {total_duration:.2f}s")
    print("=" * 80)

    if failed_count > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
