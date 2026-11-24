Add-Type -AssemblyName System.Drawing

$src = "D:\POS Project\Ameer-perfume\Logos\Ameer-perfumes-logo.jpeg"
$img = [System.Drawing.Image]::FromFile($src)

function Create-Square-Icon($sourceImg, $size, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $padding = [int]($size * 0.05)
    $targetW = $size - (2 * $padding)
    $targetH = $size - (2 * $padding)
    
    $scaleW = $targetW / $sourceImg.Width
    $scaleH = $targetH / $sourceImg.Height
    $scale = [Math]::Min($scaleW, $scaleH)
    
    $drawW = [int]($sourceImg.Width * $scale)
    $drawH = [int]($sourceImg.Height * $scale)
    $drawX = [int](($size - $drawW) / 2)
    $drawY = [int](($size - $drawH) / 2)
    
    $g.DrawImage($sourceImg, $drawX, $drawY, $drawW, $drawH)
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $destPath"
}

# Square PNGs for Tauri
Create-Square-Icon $img 512 "D:\POS Project\Ameer-perfume\src-tauri\icons\icon.png"
Create-Square-Icon $img 256 "D:\POS Project\Ameer-perfume\src-tauri\icons\128x128@2x.png"
Create-Square-Icon $img 128 "D:\POS Project\Ameer-perfume\src-tauri\icons\128x128.png"
Create-Square-Icon $img 64 "D:\POS Project\Ameer-perfume\src-tauri\icons\64x64.png"
Create-Square-Icon $img 32 "D:\POS Project\Ameer-perfume\src-tauri\icons\32x32.png"
Create-Square-Icon $img 512 "D:\POS Project\Ameer-perfume\public\logo-square.png"
Create-Square-Icon $img 512 "D:\POS Project\Ameer-perfume\src\assets\logo-square.png"

# Windows UWP / Store logos
Create-Square-Icon $img 30 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square30x30Logo.png"
Create-Square-Icon $img 44 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square44x44Logo.png"
Create-Square-Icon $img 71 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square71x71Logo.png"
Create-Square-Icon $img 89 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square89x89Logo.png"
Create-Square-Icon $img 107 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square107x107Logo.png"
Create-Square-Icon $img 142 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square142x142Logo.png"
Create-Square-Icon $img 150 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square150x150Logo.png"
Create-Square-Icon $img 284 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square284x284Logo.png"
Create-Square-Icon $img 310 "D:\POS Project\Ameer-perfume\src-tauri\icons\Square310x310Logo.png"
Create-Square-Icon $img 50 "D:\POS Project\Ameer-perfume\src-tauri\icons\StoreLogo.png"

# Windows .ico generation
$bmp256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp256)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$scaleW = 240 / $img.Width
$scaleH = 240 / $img.Height
$scale = [Math]::Min($scaleW, $scaleH)
$w = [int]($img.Width * $scale)
$h = [int]($img.Height * $scale)
$x = [int]((256 - $w) / 2)
$y = [int]((256 - $h) / 2)

$g.DrawImage($img, $x, $y, $w, $h)
$g.Dispose()

$hIcon = $bmp256.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::OpenWrite("D:\POS Project\Ameer-perfume\src-tauri\icons\icon.ico")
$ico.Save($fs)
$fs.Close()
Copy-Item "D:\POS Project\Ameer-perfume\src-tauri\icons\icon.ico" "D:\POS Project\Ameer-perfume\public\favicon.ico" -Force

$ico.Dispose()
$bmp256.Dispose()
$img.Dispose()
Write-Host "Icons generation complete from Navbarlogo!"
