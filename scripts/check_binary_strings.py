with open(r'd:\POS Project\Ameer-perfume\src-tauri\target\release\ameer-perfumes-erp.exe', 'rb') as f:
    content = f.read()

print("Contains 'New Dokandar':", b"New Dokandar" in content)
print("Contains 'Edit Dokandar':", b"Edit Dokandar" in content)
print("Contains 'Delete Oil':", b"Delete Oil" in content)
print("Contains 'Order Source':", b"Order Source" in content)
