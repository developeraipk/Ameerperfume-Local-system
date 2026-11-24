$node = "C:\Users\Default.DESKTOP-QO1EVKV\AppData\Local\OpenAI\Codex\runtimes\cua_node\db1cc9e06a6c48d6\bin\node.exe"
$env:PATH = "C:\Users\Default.DESKTOP-QO1EVKV\AppData\Local\OpenAI\Codex\runtimes\cua_node\db1cc9e06a6c48d6\bin;C:\Users\Default.DESKTOP-QO1EVKV\.cargo\bin;$env:PATH"

Write-Output "Starting Tauri Build..."
& $node "node_modules\@tauri-apps\cli\tauri.js" build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Tauri build failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Output "Tauri build completed successfully!"

# Locate NSIS exe
$nsisExe = Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
# Locate MSI
$msiFile = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($nsisExe) {
    Write-Output "Found NSIS: $($nsisExe.FullName)"
    Copy-Item -Path $nsisExe.FullName -Destination "release\Ameer-Perfumes-ERP-Setup.exe" -Force
    Write-Output "Updated release\Ameer-Perfumes-ERP-Setup.exe ($((Get-Item 'release\Ameer-Perfumes-ERP-Setup.exe').Length) bytes)"
}

if ($msiFile) {
    Write-Output "Found MSI: $($msiFile.FullName)"
    Copy-Item -Path $msiFile.FullName -Destination "release\Ameer-Perfumes-ERP-Setup.msi" -Force
    Write-Output "Updated release\Ameer-Perfumes-ERP-Setup.msi ($((Get-Item 'release\Ameer-Perfumes-ERP-Setup.msi').Length) bytes)"
}
