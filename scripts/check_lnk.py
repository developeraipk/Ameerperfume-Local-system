import os
with open(r'C:\Users\Default.DESKTOP-QO1EVKV\Desktop\Ameer Perfumes ERP.lnk', 'rb') as f:
    content = f.read()

import re
matches = re.findall(rb'[A-Za-z]:\\[^:\*\?"<>\|\r\n]+\.exe', content)
print("Matches in lnk:")
for m in matches:
    print(m.decode('latin1', errors='ignore'))
