with open(r'd:\POS Project\Ameer-perfume\src-tauri\target\release\ameer-perfumes-erp.exe', 'rb') as f:
    content = f.read()

# Check for index.html or tauri
print("Contains 'ameer':", b"ameer" in content.lower())
print("Contains 'index-BQ_Bifsw':", b"index-BQ_Bifsw" in content)
print("Contains 'ERP 4.1':", b"ERP 4.1" in content)
