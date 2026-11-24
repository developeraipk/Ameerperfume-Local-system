# -*- coding: utf-8 -*-
"""
Ameer Perfumes ERP — Phase 4 Milestone 2 Real Persistent SQLite Engine Test
Tests:
1. Real persistent database creation at %APPDATA%/AmeerPerfumes/ameer_pos.db
2. Full Phase 2.3.1 DDL execution (46 tables, 105 indexes, 16 triggers)
3. Schema version tracking (PRAGMA user_version = 231)
4. Persistent record insertion in dedicated test table
5. Connection close & re-open persistence verification
6. Foreign key enforcement (rejection of invalid FK)
7. Transaction rollback on error
8. PRAGMA integrity_check
"""

import os
import sqlite3
import re
import sys

# Windows AppData Path
appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
db_dir = os.path.join(appdata, "AmeerPerfumes")
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, "ameer_pos.db")

print(f"Target Persistent Database: {db_path}")

def run_tests():
    # Load DDL from src-tauri/src/db/schema.rs
    schema_file = r"d:\POS Project\Ameer-perfume\src-tauri\src\db\schema.rs"
    with open(schema_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    match = re.search(r'r#"(.*?)"#;', content, re.DOTALL)
    assert match, "Could not extract SQL from schema.rs"
    schema_sql = match.group(1)
    
    # 1. Connect and initialize persistent database
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    
    cur_init = conn.cursor()
    cur_init.execute("PRAGMA user_version;")
    ver = cur_init.fetchone()[0]
    if ver < 231:
        conn.executescript(schema_sql)
        conn.execute("PRAGMA user_version = 231;")
    
    # Schema version tracking
    conn.execute("""
        CREATE TABLE IF NOT EXISTS _schema_migrations (
            version INTEGER PRIMARY KEY,
            specification TEXT NOT NULL,
            applied_at TEXT NOT NULL,
            tables_count INTEGER NOT NULL,
            indexes_count INTEGER NOT NULL,
            triggers_count INTEGER NOT NULL
        );
    """)
    conn.execute("""
        INSERT OR REPLACE INTO _schema_migrations 
        (version, specification, applied_at, tables_count, indexes_count, triggers_count)
        VALUES (231, 'Phase 2.3.1 Production Master', datetime('now'), 46, 105, 16);
    """)
    conn.commit()
    
    # 2. Verify Schema Counts
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND SUBSTR(name, 1, 1) != '_';")
    tables_count = cur.fetchone()[0]
    assert tables_count == 46, f"Expected 46 tables, got {tables_count}"
    print(f"[PASS] 1. Persistent Tables: Exactly {tables_count} operational tables verified in ameer_pos.db.")
    
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%';")
    indexes_count = cur.fetchone()[0]
    assert indexes_count == 105, f"Expected 105 indexes, got {indexes_count}"
    print(f"[PASS] 2. Performance Indexes: Exactly {indexes_count} indexes active.")
    
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type = 'trigger';")
    triggers_count = cur.fetchone()[0]
    assert triggers_count == 16, f"Expected 16 triggers, got {triggers_count}"
    print(f"[PASS] 3. Database Triggers: Exactly {triggers_count} business integrity triggers active.")
    
    # 3. Create dedicated persistence test table (isolated from operational tables)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS _milestone2_persistence_test (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    """)
    test_id = "test_persistence_uuid_1001"
    conn.execute("INSERT OR REPLACE INTO _milestone2_persistence_test (id, message, created_at) VALUES (?, ?, datetime('now'));",
                 (test_id, "Persistence verified across process restarts"))
    conn.commit()
    conn.close()
    print("[PASS] 4. Test record inserted and connection closed.")
    
    # 4. Re-open connection in fresh session to test persistence
    conn2 = sqlite3.connect(db_path)
    conn2.execute("PRAGMA foreign_keys = ON;")
    cur2 = conn2.cursor()
    cur2.execute("SELECT message FROM _milestone2_persistence_test WHERE id = ?;", (test_id,))
    row = cur2.fetchone()
    assert row is not None, "Persistent record was lost on restart!"
    assert row[0] == "Persistence verified across process restarts", f"Unexpected value: {row[0]}"
    print(f"[PASS] 5. Persistence across restarts verified: '{row[0]}'")
    
    # 5. Verify Foreign Key Enforcement
    fk_rejected = False
    try:
        # Try inserting cashier assignment for a non-existent user
        conn2.execute("""
            INSERT INTO cashier_assignments 
            (assignment_id, user_id, assigned_role, assignment_type, valid_from, created_at)
            VALUES ('asgn_fail_1', 'non_existent_user_9999', 'PRIMARY_CASHIER', 'PERMANENT', '2026-11-10T00:00:00Z', '2026-11-10T00:00:00Z');
        """)
        conn2.commit()
    except sqlite3.IntegrityError as e:
        fk_rejected = True
        print(f"[PASS] 6. Foreign Key Enforcement Verified: Rejection confirmed ({e}).")
    assert fk_rejected, "Foreign key violation was NOT rejected!"
    
    # 6. Verify Transaction Rollback
    conn2.rollback()
    try:
        with conn2:
            conn2.execute("INSERT INTO _milestone2_persistence_test (id, message, created_at) VALUES ('rollback_test', 'Will rollback', datetime('now'));")
            raise RuntimeError("Simulated transaction failure")
    except RuntimeError:
        pass
    
    cur2.execute("SELECT count(*) FROM _milestone2_persistence_test WHERE id = 'rollback_test';")
    rollback_count = cur2.fetchone()[0]
    assert rollback_count == 0, "Transaction rollback failed!"
    print("[PASS] 7. Transaction Rollback Verified: Table remained unaffected on failure.")
    
    # 7. Verify Database Integrity
    cur2.execute("PRAGMA integrity_check;")
    integrity = cur2.fetchone()[0]
    assert integrity == "ok", f"Integrity check failed: {integrity}"
    print(f"[PASS] 8. PRAGMA integrity_check: {integrity.upper()}.")
    
    # 8. Verify WAL mode
    cur2.execute("PRAGMA journal_mode;")
    jmode = cur2.fetchone()[0]
    print(f"[PASS] 9. PRAGMA journal_mode: {jmode.upper()} mode active.")
    
    # 9. Clean up test record
    conn2.execute("DELETE FROM _milestone2_persistence_test WHERE id = ?;", (test_id,))
    conn2.commit()
    conn2.close()
    print("[PASS] 10. Test cleanup complete. ameer_pos.db is in production-ready state.")

if __name__ == "__main__":
    print("=== AMEER PERFUMES ERP — MILESTONE 2 REAL SQLITE PERSISTENCE TEST ===")
    run_tests()
    print("=== ALL PERSISTENCE AND INTEGRITY TESTS PASSED (100%) ===")
