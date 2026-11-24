@echo off
title Ameer Perfumes ERP - Auto Configure Hotspot & LAN Sharing
color 0a

echo ================================================================
echo   AMEER PERFUMES ERP - 1-CLICK HOTSPOT & LAN SHARING SETUP
echo ================================================================
echo.
echo [1/4] Setting Wi-Fi / Hotspot network to Private mode...
powershell -NoProfile -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private"
if %errorlevel% neq 0 (
    echo [NOTE] If this showed an error, please ensure you ran this file as Administrator.
)

echo.
echo [2/4] Enabling Windows Firewall for File and Printer Sharing...
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes

echo.
echo [3/4] Sharing AmeerPerfumes Database folder over LAN...
net share AmeerPerfumes="%APPDATA%\AmeerPerfumes" /grant:Everyone,FULL

echo.
echo [4/4] Granting Full Access security permissions to Everyone...
icacls "%APPDATA%\AmeerPerfumes" /grant Everyone:(OI)(CI)F /T

echo.
echo ================================================================
echo   SUCCESS! AmeerPerfumes folder is now fully shared on Hotspot!
echo.
echo   Now on PC-2 (Counter 2):
echo   1. Open Ameer Perfumes ERP -> Admin -> Sync Center
echo   2. Select 'Secondary Terminal (PC-2)'
echo   3. Enter path:  \\10.75.221.6\AmeerPerfumes\ameer_pos.db
echo   4. Click 'Test LAN Connection' and 'Save & Connect Station'
echo ================================================================
echo.
pause
