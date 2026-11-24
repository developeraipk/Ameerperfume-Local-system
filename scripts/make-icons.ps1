Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path (Get-Location) 'Logos\Ameer-perfumes-logo.jpeg'
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($img, $width, $height) {
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $destImg.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
    $graphics = [System.Drawing.Graphics]::FromImage($destImg)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $wrapMode = New-Object System.Drawing.Imaging.ImageAttributes
    $wrapMode.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $graphics.DrawImage($img, $destRect, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $wrapMode)
    $graphics.Dispose()
    return $destImg
}

# Generate PNGs
$sizes = @(
    @{ w = 32; h = 32; name = 'src-tauri\icons\32x32.png' },
    @{ w = 64; h = 64; name = 'src-tauri\icons\64x64.png' },
    @{ w = 128; h = 128; name = 'src-tauri\icons\128x128.png' },
    @{ w = 256; h = 256; name = 'src-tauri\icons\128x128@2x.png' },
    @{ w = 512; h = 512; name = 'src-tauri\icons\icon.png' },
    @{ w = 30; h = 30; name = 'src-tauri\icons\Square30x30Logo.png' },
    @{ w = 44; h = 44; name = 'src-tauri\icons\Square44x44Logo.png' },
    @{ w = 71; h = 71; name = 'src-tauri\icons\Square71x71Logo.png' },
    @{ w = 89; h = 89; name = 'src-tauri\icons\Square89x89Logo.png' },
    @{ w = 107; h = 107; name = 'src-tauri\icons\Square107x107Logo.png' },
    @{ w = 142; h = 142; name = 'src-tauri\icons\Square142x142Logo.png' },
    @{ w = 150; h = 150; name = 'src-tauri\icons\Square150x150Logo.png' },
    @{ w = 284; h = 284; name = 'src-tauri\icons\Square284x284Logo.png' },
    @{ w = 310; h = 310; name = 'src-tauri\icons\Square310x310Logo.png' },
    @{ w = 50; h = 50; name = 'src-tauri\icons\StoreLogo.png' },
    @{ w = 512; h = 512; name = 'public\logo-square.png' },
    @{ w = 512; h = 512; name = 'src\assets\logo-square.png' }
)

foreach ($s in $sizes) {
    $resized = Resize-Image $srcImg $s.w $s.h
    $resized.Save($s.name, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host "Generated: $($s.name)"
}

# Generate 256x256 high-res ICO for Windows desktop shortcut & explorer
$iconBmp = Resize-Image $srcImg 256 256
$hIcon = $iconBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create((Join-Path (Get-Location) 'src-tauri\icons\icon.ico'))
$icon.Save($fs)
$fs.Close()
$fs.Dispose()

# Copy to public\favicon.ico
Copy-Item 'src-tauri\icons\icon.ico' 'public\favicon.ico' -Force
Copy-Item 'src-tauri\icons\icon.ico' 'src-tauri\icons\icon1.ico' -Force

$srcImg.Dispose()
Write-Host "All icons generated successfully from Ameer-perfumes-logo.jpeg!"
