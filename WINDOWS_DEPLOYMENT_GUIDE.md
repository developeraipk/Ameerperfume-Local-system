# AMEER PERFUMES ERP — WINDOWS 11 DEPLOYMENT & INSTALLATION GUIDE
**Release Target:** v4.1.0-PRODUCTION  
**Workspace:** `D:\POS Project\Ameer-perfume`  
**Target OS:** Windows 11 Pro 64-bit (Build 22H2 / 23H2 or newer)  
**Target Hardware Architecture:** Single Shop, Exactly Two POS Workstations (`POS-01` and `POS-02`)  
**Date of Guide:** November 11, 2026  
**Auditor / Deployment Engineer:** Windows Desktop Deployment Engineer  

---

## 1. HARDWARE ARCHITECTURE & SHOP TOPOLOGY

Ameer Perfumes ERP is engineered strictly for a single-shop luxury boutique architecture with exactly two physical POS terminals (Owner Decision C):

```
                        +----------------------------+
                        |   HYBRID CLOUD (NestJS)   |
                        |   REST API (Port 3000)     |
                        +--------------^-------------+
                                       |
                   Internet (HTTPS / Bearer Token)
                                       |
  ============================= LOCAL SHOP LAN =============================
               |                                            |
  +------------v------------+                  +------------v------------+
  |  TERMINAL POS-01        |                  |  TERMINAL POS-02        |
  |  IP: 192.168.1.101      |  TCP Mesh (7878) |  IP: 192.168.1.102      |
  |  Role: Primary Station  |<================>|  Role: Secondary Station|
  |  - Persistent SQLite    |                  |  - Persistent SQLite    |
  |  - 80mm ESC/POS Printer |                  |  - 80mm ESC/POS Printer |
  |  - 24V Cash Drawer      |                  |  - 24V Cash Drawer      |
  |  - 2x20 VFD Pole Display|                  |  - 2x20 VFD Pole Display|
  |  - USB Barcode Scanner  |                  |  - USB Barcode Scanner  |
  +-------------------------+                  +-------------------------+
```

---

## 2. PREREQUISITES & SYSTEM REQUIREMENTS

### 2.1 Hardware Requirements
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher (x64 architecture).
- **RAM:** Minimum 8 GB (16 GB recommended for smooth multi-tasking).
- **Storage:** Solid-State Drive (SSD) with at least 20 GB free space.
- **Display:** $1920 \times 1080$ Full HD touch-enabled screen or standard display.

### 2.2 Operating System Prerequisites
1. **Windows 11 Pro 64-bit** (Updated to Version 22H2 or higher).
2. **Microsoft Edge WebView2 Evergreen Runtime** (Pre-installed on Windows 11).
3. **Microsoft Visual C++ Redistributable 2015–2022 (x64)** (Required for native desktop subsystem).

---

## 3. PRODUCTION PACKAGING & BUILD COMMANDS

### 3.1 Frontend Production Build
The React 18 + TypeScript + Tailwind CSS user interface compiles into static optimized assets:
```powershell
cd "D:\POS Project\Ameer-perfume"
npm run build
```
- Output directory: `dist/` (Includes `index.html`, minified JS bundle, CSS stylesheets, luxury icons).
- Verified Build Time: **5.25 seconds**, 0 TypeScript errors.

### 3.2 Native Tauri Desktop Executable Packaging
```powershell
# Set production environment flags
$env:TAURI_ENV = "production"

# Build production executable via Cargo Tauri
cargo tauri build --target x86_64-pc-windows-msvc
```
- Standard binary output path:  
  `src-tauri\target\release\ameer-perfumes-erp.exe`
- Installer bundles generated:
  - NSIS Standalone Installer: `src-tauri\target\release\bundle\nsis\AmeerPerfumesERP_4.1.0_x64-setup.exe`
  - WiX MSI Package: `src-tauri\target\release\bundle\msi\AmeerPerfumesERP_4.1.0_x64_en-US.msi`

### 3.3 Linker Prerequisites Note
To execute the native MSVC build from source, Microsoft C++ Build Tools (specifically `link.exe` from Visual Studio 2022 Build Tools) must be installed with the "Desktop development with C++" workload:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools"
```

---

## 4. DIRECTORY & FILE LOCATIONS ON POS TERMINALS

When deployed, the application adheres to standard Windows paths:

| Path | Purpose |
| :--- | :--- |
| `C:\Program Files\AmeerPerfumes\` | Application binaries (`AmeerPerfumesERP.exe`, resources) |
| `%APPDATA%\AmeerPerfumes\ameer_pos.db` | Primary persistent SQLite database |
| `%APPDATA%\AmeerPerfumes\ameer_pos.db-wal` | SQLite Write-Ahead Logging active transaction journal |
| `%APPDATA%\AmeerPerfumes\ameer_pos.db-shm` | Shared memory index cache |
| `%APPDATA%\AmeerPerfumes\backups\` | Automated and manual hot backup `.db` snapshots |
| `%APPDATA%\AmeerPerfumes\logs\` | Application crash dumps, sync traces, and hardware logs |

---

## 5. NETWORK CONFIGURATION (LAN TCP MESH)

To allow `POS-01` and `POS-02` to synchronize on port 7878, configure the Windows Defender Firewall on both machines:

### 5.1 Open Port 7878 Inbound (Administrator PowerShell)
```powershell
New-NetFirewallRule -DisplayName "Ameer Perfumes LAN Sync Port 7878" `
                    -Direction Inbound `
                    -LocalPort 7878 `
                    -Protocol TCP `
                    -Action Allow `
                    -Profile Private
```

### 5.2 Set Static IP Addresses
- **Terminal 1 (`POS-01`):** `192.168.1.101` (Subnet: `255.255.255.0`, Gateway: `192.168.1.1`)
- **Terminal 2 (`POS-02`):** `192.168.1.102` (Subnet: `255.255.255.0`, Gateway: `192.168.1.1`)

---

## 6. PERIPHERAL HARDWARE SETUP & DRIVER CONFIGURATION

### 6.1 80mm ESC/POS Thermal Receipt Printer
1. Connect via USB cable.
2. Install standard POS-80 Windows driver.
3. In Windows **Settings > Bluetooth & devices > Printers & scanners**, name the printer `POS-80-Thermal`.
4. Ensure default paper size is set to **80mm x Receipt**.

### 6.2 24V RJ11 Solenoid Cash Drawer
1. Connect RJ11 cable from drawer into the `DK` (Drawer Kick) port of the receipt printer.
2. The drawer automatically receives the `1B 70 00 19 FA` pulse transmitted through the printer spooler upon cash sale completion or shift reconciliation.

### 6.3 Customer 2x20 VFD Pole Display
1. Connect via RS-232 COM port or USB-to-Serial adapter.
2. In **Device Manager**, note the COM port number (e.g., `COM1`).
3. Set Baud rate: `9600`, Data bits: `8`, Parity: `None`, Stop bits: `1`.
4. Select `COM1` in `SCR-CFG-01_HardwarePeripherals.tsx`.

### 6.4 USB Barcode Scanner
1. Plug into any USB port.
2. Scanner operates in USB HID keyboard wedge mode automatically. No custom driver required.
3. Verify test scan of `8964000100101` in POS billing screen.

---

## 7. DISASTER RECOVERY RESTORATION PROCEDURE

In the event of physical hardware failure:
1. Provision replacement Windows 11 machine.
2. Install Ameer Perfumes ERP installer.
3. Copy the latest verified backup file (e.g., `ameer_pos_backup_YYYYMMDD_HHMMSS.db`) from external storage or secondary station.
4. Rename backup file to `ameer_pos.db` and place in:
   `%APPDATA%\AmeerPerfumes\ameer_pos.db`
5. Run integrity check drill:
   ```powershell
   python scripts/test_backup_restore.py
   ```
6. Launch application; all 46 tables, general ledger entries, inventory stock levels, and user accounts are instantly restored.
