$node = "C:\Users\Default.DESKTOP-QO1EVKV\AppData\Local\OpenAI\Codex\runtimes\cua_node\db1cc9e06a6c48d6\bin\node.exe"
Write-Output "Running tsc..."
& $node "node_modules\typescript\bin\tsc" -b
if ($LASTEXITCODE -ne 0) {
    Write-Error "TSC failed"
    exit 1
}
Write-Output "Running vite build..."
& $node "node_modules\vite\bin\vite.js" build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Vite build failed"
    exit 1
}
Write-Output "Vite build succeeded!"
