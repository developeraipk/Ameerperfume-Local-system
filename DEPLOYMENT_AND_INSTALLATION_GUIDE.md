# AMEER PERFUMES ERP — DEPLOYMENT & INSTALLATION GUIDE
**Document Version:** 4.0.0 — Production Final Master  
**Target Environment:** Windows 11 Professional x64 (Single-Shop Topology)  
**Workstations:** POS-01 (Primary Server Terminal) & POS-02 (Secondary Workstation)  
**Release Package:** Ameer Perfumes ERP v1.0.0 Windows Installer  

---

## 1. PRE-INSTALLATION HARDWARE & NETWORK PROFILE

### 1.1 Hardware Specifications per Workstation
- **Operating System:** Windows 11 Professional 64-bit (Version 23H2 or later).
- **Processor:** Intel Core i5 (8th Gen or higher) / AMD Ryzen 5.
- **System Memory:** 16 GB DDR4/DDR5 RAM.
- **Storage:** 256 GB NVMe SSD (minimum 20 GB free space for database & WAL growth).
- **Interface Ports:** Minimum 4 USB 3.0 Type-A ports, 1 Gigabit RJ45 Ethernet LAN port.

### 1.2 Fixed Local Area Network (LAN) Configuration
Both workstations must reside on a dedicated POS subnet isolated from public guest Wi-Fi.

| Terminal ID | Hostname | Static IP Address | Subnet Mask | Default Gateway | Mesh Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POS-01** | `AMEER-POS01` | `192.168.1.100` | `255.255.255.0` | `192.168.1.1` | **Primary Server & Database Host** |
| **POS-02** | `AMEER-POS02` | `192.168.1.101` | `255.255.255.0` | `192.168.1.1` | **Secondary Workstation & Mesh Peer** |

#### Windows Firewall Port Rule (Execute on POS-01):
Open an elevated PowerShell prompt on `POS-01` to allow peer synchronization traffic:
```powershell
New-NetFirewallRule -DisplayName "AmeerPerfumes-Mesh-Sync" -Direction Inbound -LocalPort 7878 -Protocol TCP -Action Allow
```

---

## 2. STEP-BY-STEP WORKSTATION INSTALLATION

### 2.1 Installing POS-01 (Primary Server Terminal)
1. Log into Windows as an administrator.
2. Copy `Ameer Perfumes ERP_1.0.0_x64-setup.exe` to `C:\Deploy\`.
3. Run the installer and accept the default installation path:
   `C:\Program Files\Ameer Perfumes ERP\`
4. Launch the application from the desktop shortcut.
5. On initial launch, the system automatically creates the persistent database directory:
   `C:\Users\<User>\AppData\Roaming\AmeerPerfumes\`
6. Verify database files are created:
   - `ameer_pos.db` (Primary SQLite database)
   - `ameer_pos.db-wal` (Write-Ahead Log)
   - `ameer_pos.db-shm` (Shared memory index)
7. Log into `SCR-SET-01 (Hardware Settings)` using Admin PIN (`1111`).
8. Under **Workstation Topology**, confirm:
   - Station ID: `POS-01`
   - Role: `PRIMARY_SERVER`
   - P2P Mesh Port: `7878`

### 2.2 Installing POS-02 (Secondary Workstation)
1. Run the installer `Ameer Perfumes ERP_1.0.0_x64-setup.exe` on `POS-02`.
2. Launch the application and enter Admin PIN (`1111`).
3. Open `SCR-SET-01 (Hardware Settings)`:
   - Station ID: `POS-02`
   - Role: `SECONDARY_CLIENT`
   - Primary Server Host IP: `192.168.1.100`
   - Port: `7878`
4. Click **Test Peer Connection**. Verify the status indicator turns green (*Peer Connected*).

---

## 3. PERIPHERAL HARDWARE SETUP & DIAGNOSTICS

### 3.1 80mm ESC/POS Thermal Receipt Printer
- **Connection:** USB Type-B or Virtual COM.
- **Baud Rate:** `9600` or `115200` (8 Data bits, 1 Stop bit, No Parity).
- **Diagnostics:**
  1. Navigate to `SCR-SET-01 -> Peripherals -> Receipt Printer`.
  2. Click **Print Test Ticket**.
  3. Verify the ticket feeds cleanly, cuts automatically, and displays:
     - Header: *Ameer Perfumes Luxury Fragrances*
     - NTN: `5123456-7`
     - **Verification of Decision A:** Confirm NO cashier or salesperson names appear anywhere on the customer ticket.

### 3.2 24V Solenoid Cash Drawer
- **Connection:** RJ12 modular cable connected directly to the `DK` (Drawer Kick) port on the rear of the 80mm thermal receipt printer.
- **Pulse Command:** `\x1B\x70\x00\x19\xFA` (50ms kick pulse to Pin 2).
- **Diagnostics:**
  1. In `SCR-SET-01 -> Cash Drawer`, click **Trigger Test Kick Pulse**.
  2. Verify the cash drawer pops open smoothly without delay.

### 3.3 1D / 2D Barcode Scanner
- **Connection:** USB HID Cable.
- **Configuration:** Ensure scanner is in **USB Keyboard Wedge** mode with a carriage return suffix (`[CR]` / `Enter`).
- **Diagnostics:**
  1. Open `SCR-POS-01 (Retail Billing)`.
  2. Scan product barcode `8964000100101` (*Oud Royal EDP 50ml*).
  3. Verify the item is instantly added to the active sales cart in $< 50\text{ms}$.

### 3.4 2x20 VFD Customer Pole Display
- **Connection:** USB Virtual COM Port (e.g., `COM3`).
- **Baud Rate:** `9600 bps`, 8-N-1.
- **Diagnostics:**
  1. In `SCR-SET-01 -> Pole Display`, click **Test Display**.
  2. Verify the screen clears (`\x0C`) and renders:
     ```
     Line 1: Ameer Perfumes
     Line 2: Welcome!
     ```

---

## 4. HYBRID CLOUD BACKEND INTEGRATION (OWNER DECISION B)

1. Open `SCR-SNC-01 (Sync Center)`.
2. Confirm the hybrid cloud synchronization credentials:
   - Supabase URL: `https://ameer-perfumes-prod.supabase.co`
   - API Key: Encrypted in Windows Credential Manager.
3. Verify the sync scheduler:
   - Periodic Background Sync: Every **15 minutes**.
   - Immediate Event Push: Triggers on **Shift Close**, **Manufacturing Batch Completion**, and **EOD Cash Drop**.

---

## 5. BACKUP & DISASTER RECOVERY DRILL PROCEDURE

### 5.1 Manual Atomic Hot Backup Execution
1. Open `SCR-BAK-01 (Backup & Disaster Recovery)` using Admin or Accountant credentials.
2. Click **Create Immediate Hot Backup**.
3. The engine invokes `VACUUM INTO` on the live SQLite database, creating a timestamped snapshot:
   `%APPDATA%\AmeerPerfumes\backups\ameer_pos_backup_YYYYMMDD_HHMMSS.db`
4. The system automatically executes `PRAGMA integrity_check;` on the generated file and logs the verification in `system_backups_metadata`.

### 5.2 Offsite Backup Replication
Configure Windows Task Scheduler to mirror the backup directory to an external encrypted USB drive or secure network share daily at 23:30:
```powershell
robocopy "C:\Users\<User>\AppData\Roaming\AmeerPerfumes\backups" "E:\AmeerBackups" *.db /MIR /R:2 /W:5
```

### 5.3 Disaster Recovery Restoration Drill
In the unlikely event of hardware failure:
1. Provision a replacement workstation with Windows 11.
2. Install Ameer Perfumes ERP v1.0.0.
3. Stop the application service.
4. Copy the latest verified backup file (e.g., `ameer_pos_backup_20261111_120000.db`) to:
   `%APPDATA%\AmeerPerfumes\ameer_pos.db`
5. Launch the application. The system immediately reads the restored database and resumes operations with 100% data integrity.
