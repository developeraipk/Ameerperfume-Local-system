import os
import shutil
import datetime
import sqlite3

timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
appdata = os.environ.get('APPDATA', '')
backup_root = os.path.join(appdata, 'AmeerPerfumes', 'pre_v410_backups')
os.makedirs(backup_root, exist_ok=True)

# 1. Atomic SQLite backup using VACUUM INTO
db_path = os.path.join(appdata, 'AmeerPerfumes', 'ameer_pos.db')
db_backup = os.path.join(backup_root, f'ameer_pos_pre_v410_{timestamp}.db')

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    clean_path = db_backup.replace('\\', '/')
    conn.execute(f"VACUUM INTO '{clean_path}'")
    conn.close()
    size = os.path.getsize(db_backup)
    print(f"Database backed up to: {db_backup} ({size} bytes)")
    
    # Verify backup integrity
    b_conn = sqlite3.connect(db_backup)
    res = b_conn.execute('PRAGMA integrity_check;').fetchone()[0]
    tables = b_conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND SUBSTR(name, 1, 1) != '_'").fetchone()[0]
    b_conn.close()
    print(f"Database backup integrity: {res}, Tables: {tables}")
else:
    print("Database file does not exist at:", db_path)

# 2. Workspace source files backup
src_backup_zip = os.path.join(backup_root, f'ameer_pos_src_backup_{timestamp}')
print(f"Archiving source code to: {src_backup_zip}.zip ...")
shutil.make_archive(src_backup_zip, 'zip', root_dir='.', base_dir='src')
print(f"Source backup complete: {src_backup_zip}.zip ({os.path.getsize(src_backup_zip + '.zip')} bytes)")
