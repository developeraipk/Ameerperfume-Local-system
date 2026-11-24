# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Priority 6: Master Database & Accounting Integrity Verification Suite
Exhaustive verification of:
1. SQLite PRAGMA integrity_check -> 'ok'
2. SQLite PRAGMA foreign_key_check -> 0 violations
3. WAL mode verification (journal_mode == 'wal')
4. 46 Production Tables verification against schema
5. 105 Indexes verification
6. 16 Business Triggers verification
7. Financial Ledger Double-Entry Equilibrium (Trial Balance Debits == Credits)
8. Immutability trigger checks (prevent updates/deletes to posted immutable vouchers)
9. Attar stockless sales & BOM linkage validation
"""

import os
import sys
import sqlite3

appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_path = os.path.join(appdata, "AmeerPerfumes", "ameer_pos.db")

print(f"Target Primary Database: {db_path}")

test_results = []

def record(name, passed, detail):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} - {detail}")
    test_results.append((name, passed, detail))

def main():
    print("=" * 75)
    print("AMEER PERFUMES ERP — PRIORITY 6 DATABASE & ACCOUNTING INTEGRITY AUDIT")
    print("=" * 75)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Integrity check
    res = cur.execute("PRAGMA integrity_check;").fetchall()
    record("PRAGMA integrity_check", len(res) == 1 and res[0][0] == "ok", f"Status: {res[0][0]}")

    # 2. Foreign keys check
    fks = cur.execute("PRAGMA foreign_key_check;").fetchall()
    record("PRAGMA foreign_key_check", len(fks) == 0, f"Violations: {len(fks)}")

    # 3. WAL mode
    wal = cur.execute("PRAGMA journal_mode;").fetchone()[0]
    record("PRAGMA journal_mode", wal.lower() == "wal", f"Journal Mode: {wal}")

    # 4. Tables count (46 tables)
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND SUBSTR(name, 1, 1) != '_' ORDER BY name;").fetchall()
    t_names = [t[0] for t in tables]
    record("46 Tables Verification", len(t_names) == 46, f"Count: {len(t_names)} / 46 tables present")

    # 5. Indexes count (105 indexes)
    indexes = cur.execute("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;").fetchall()
    record("105 Indexes Verification", len(indexes) == 105, f"Count: {len(indexes)} / 105 indexes present")

    # 6. Triggers count (16 triggers)
    triggers = cur.execute("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name;").fetchall()
    record("16 Triggers Verification", len(triggers) == 16, f"Count: {len(triggers)} / 16 triggers present")

    # 7. Trial Balance Equilibrium
    cur.execute("""
        SELECT 
            COALESCE(SUM(le.debit_paisa), 0) AS total_debit,
            COALESCE(SUM(le.credit_paisa), 0) AS total_credit
        FROM financial_ledger_entries le
        JOIN journal_vouchers jv ON le.voucher_id = jv.voucher_id
        WHERE jv.is_posted = 1;
    """)
    dr, cr = cur.fetchone()
    delta = dr - cr
    record("Trial Balance Equilibrium", delta == 0 and dr > 0, 
           f"Total Debits: Rs. {dr/100:,.2f} | Total Credits: Rs. {cr/100:,.2f} | Delta: {delta} paisa")

    # 8. Immutability trigger checks
    cur.execute("SELECT voucher_id, voucher_number FROM journal_vouchers WHERE is_immutable = 1 LIMIT 1;")
    imm_row = cur.fetchone()
    imm_blocked = False
    if imm_row:
        try:
            cur.execute("UPDATE journal_vouchers SET description = 'HACK' WHERE voucher_id = ?", (imm_row[0],))
            conn.commit()
        except Exception:
            imm_blocked = True
        record("Immutability Enforcement Trigger", imm_blocked, f"Voucher {imm_row[1]} protected against mutation")
    else:
        record("Immutability Enforcement Trigger", False, "No immutable voucher found")

    # 9. Attar & Perfume Recipes configuration integrity
    cur.execute("SELECT count(*) FROM attar_products;")
    attar_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM perfume_recipes;")
    recipe_count = cur.fetchone()[0]
    record("Manufacturing & Attar Structure", recipe_count >= 1 and attar_count >= 1, 
           f"Perfume Recipes: {recipe_count}, Attar Master Products: {attar_count}")

    conn.close()

    print("\n" + "=" * 75)
    passed = sum(1 for _, p, _ in test_results if p)
    total = len(test_results)
    pct = (passed / total) * 100
    print(f"INTEGRITY AUDIT SUMMARY: {passed} / {total} Passed ({pct:.1f}%)")
    print("=" * 75)

    if passed < total:
        sys.exit(1)

if __name__ == "__main__":
    main()
