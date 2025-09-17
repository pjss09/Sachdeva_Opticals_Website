# Generate favicon PNG sizes and ICO from images/logo.png
# Usage: .\generate_favicons.ps1

$logoPath = Join-Path $PSScriptRoot "..\images\logo.png"
$outDir = Join-Path $PSScriptRoot "..\images"

if (-not (Test-Path $logoPath)) {
    Write-Error "Logo not found at $logoPath. Place your high-res logo at that path and re-run."
    exit 1
}

Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($logoPath)

$pngSizes = @(16,32,48,64,96,128,192,256)
foreach ($s in $pngSizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $s, $s)
    $out = Join-Path $outDir "favicon-$s.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Written $out"
}

# Create ICO (Windows): combine 16,32,48
$icoPath = Join-Path $outDir 'favicon.ico'
$iconSizes = @(16,32,48)
$icons = @()
foreach ($s in $iconSizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $s, $s)
    $icons += $bmp
    $g.Dispose()
}

# Save ICO using .NET interop
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header
$writer.Write([int16]0) # reserved
$writer.Write([int16]1) # image type 1 = icon
$writer.Write([int16]$icons.Count)

$offset = 6 + 16 * $icons.Count
$imageData = @()

foreach ($bmp in $icons) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $data = $ms.ToArray()
    $imageData += $data
    $width = if ($bmp.Width -lt 256) { [byte]$bmp.Width } else { 0 }
    $height = if ($bmp.Height -lt 256) { [byte]$bmp.Height } else { 0 }
    $writer.Write($width)
    $writer.Write($height)
    $writer.Write([byte]0) # colors
    $writer.Write([byte]0) # reserved
    $writer.Write([int16]0) # color planes
    $writer.Write([int16]32) # bits per pixel
    $writer.Write([int32]$data.Length)
    $writer.Write([int32]$offset)
    $offset += $data.Length
}

foreach ($data in $imageData) {
    $writer.Write($data)
}

$writer.Flush()
$writer.Close()
$fs.Close()

Write-Output "Written $icoPath"

$src.Dispose()
Write-Output "Done. You can reference icons/favicon-*.png and favicon.ico in your HTML."