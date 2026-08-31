param(
    [string]$Source = "E:\obs-studio-videos\MorelordMarketplace-GMDemo.mp4",
    [string]$Output = (Join-Path $PSScriptRoot "MorelordMarketplace-GMDemo-Branded.mp4")
)

$ErrorActionPreference = "Stop"
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$work = Join-Path $PSScriptRoot ".gm-render"
New-Item -ItemType Directory -Force -Path $work | Out-Null

$fps = 30
$ink = "0x120e0b"
$gold = "0xe5a512"
$goldLight = "0xffd85c"
$parchment = "0xead7ad"
$crimson = "0x991f1f"
$fontTitle = "C\:/Windows/Fonts/georgiab.ttf"
$fontBody = "C\:/Windows/Fonts/arial.ttf"

function Invoke-FFmpeg([string[]]$Arguments) {
    & $ffmpeg -hide_banner -loglevel warning @Arguments
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed with exit code $LASTEXITCODE." }
}

function Escape-DrawText([string]$Text) {
    return $Text.Replace("\", "\\").Replace(":", "\:").Replace("'", "’")
}

function New-BrandCard {
    param(
        [string]$Path,
        [string]$Title,
        [string]$Subtitle,
        [double]$Duration = 4,
        [switch]$Final
    )

    $safeTitle = Escape-DrawText $Title
    $safeSubtitle = Escape-DrawText $Subtitle
    $fadeOut = $Duration - 0.65
    $finalLine = if ($Final) {
        "drawtext=fontfile='$fontBody':text='MORELORDGAMING.COM':fontcolor=${goldLight}:fontsize=25:x=190:y=760,"
    } else { "" }

    $filter = "drawbox=x=0:y=0:w=iw:h=ih:color=${ink}:t=fill," +
        "drawbox=x=0:y=0:w=22:h=ih:color=${crimson}:t=fill," +
        "drawbox=x=22:y=0:w=8:h=ih:color=${gold}:t=fill," +
        "drawtext=fontfile='$fontTitle':text='$safeTitle':fontcolor=${parchment}:fontsize=74:x=190:y=430," +
        "drawtext=fontfile='$fontBody':text='$safeSubtitle':fontcolor=${goldLight}:fontsize=31:x=194:y=545," +
        $finalLine +
        "fade=t=in:st=0:d=0.55,fade=t=out:st=${fadeOut}:d=0.65[out]"

    Invoke-FFmpeg @("-y", "-f", "lavfi", "-i", "color=c=${ink}:s=1920x1080:r=${fps}:d=${Duration}",
        "-filter_complex", $filter, "-map", "[out]", "-an", "-r", "$fps",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", $Path)
}

function New-DemoClip {
    param(
        [string]$Path,
        [double]$Start,
        [double]$End,
        [double]$Speed = 1,
        [string]$Label
    )

    $duration = ($End - $Start) / $Speed
    $fadeOut = $duration - 0.35
    $safeLabel = Escape-DrawText $Label
    $filter = "[0:v]trim=start=${Start}:end=${End},setpts=(PTS-STARTPTS)/${Speed}," +
        "crop=1920:920:0:100,scale=1920:920,pad=1920:1080:0:80:color=${ink}," +
        "drawbox=x=0:y=0:w=iw:h=80:color=${ink}:t=fill," +
        "drawbox=x=0:y=1000:w=iw:h=80:color=${ink}:t=fill," +
        "drawbox=x=32:y=1000:w=7:h=80:color=${crimson}:t=fill," +
        "drawtext=fontfile='$fontBody':text='$safeLabel':fontcolor=${parchment}:fontsize=22:x=55:y=1027," +
        "fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeOut}:d=0.35[out]"

    Invoke-FFmpeg @("-y", "-i", $Source, "-filter_complex", $filter, "-map", "[out]", "-an",
        "-r", "$fps", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", $Path)
}

$segments = @()

$path = Join-Path $work "00-title.mp4"
New-BrandCard -Path $path -Title "MORELORD MARKETPLACE" -Subtitle "A Game Master's Guide to Better Foundry VTT Shops" -Duration 5
$segments += $path

$edits = @(
    @{ Start = 8.8; End = 25.0; Speed = 1.0; Label = "01  CONFIGURE THE GLOBAL MARKETPLACE" },
    @{ Start = 46.8; End = 90.0; Speed = 1.25; Label = "02  BROWSE, FILTER, BUY, AND SELL" }
)

$i = 1
foreach ($edit in $edits) {
    $path = Join-Path $work ("{0:D2}-clip.mp4" -f $i)
    New-DemoClip -Path $path -Start $edit.Start -End $edit.End -Speed $edit.Speed -Label $edit.Label
    $segments += $path
    $i++
}

$path = Join-Path $work "03-manager-card.mp4"
New-BrandCard -Path $path -Title "BUILD DISTINCTIVE VENDORS" -Subtitle "Inventory, pricing, reputation, stock, and restocking" -Duration 3
$segments += $path

$edits = @(
    @{ Start = 115.1; End = 145.0; Speed = 1.0; Label = "03  START WITH A SHOP PREFAB" },
    @{ Start = 165.0; End = 216.1; Speed = 1.35; Label = "04  CUSTOMIZE PRODUCTS AND STOCK" }
)

foreach ($edit in $edits) {
    $path = Join-Path $work ("{0:D2}-clip.mp4" -f $i)
    New-DemoClip -Path $path -Start $edit.Start -End $edit.End -Speed $edit.Speed -Label $edit.Label
    $segments += $path
    $i++
}

$path = Join-Path $work "06-player-card.mp4"
New-BrandCard -Path $path -Title "BRING THE SHOP TO THE TABLE" -Subtitle "Place the vendor, choose funding, and start shopping" -Duration 3
$segments += $path

$edits = @(
    @{ Start = 216.1; End = 260.0; Speed = 1.15; Label = "05  SHOP IN CHARACTER" },
    @{ Start = 272.0; End = 300.5; Speed = 1.0; Label = "06  COMPLETE THE PURCHASE" }
)

foreach ($edit in $edits) {
    $path = Join-Path $work ("{0:D2}-clip.mp4" -f $i)
    New-DemoClip -Path $path -Start $edit.Start -End $edit.End -Speed $edit.Speed -Label $edit.Label
    $segments += $path
    $i++
}

$path = Join-Path $work "99-outro.mp4"
New-BrandCard -Path $path -Title "ADVENTURE HAS A PRICE" -Subtitle "Morelord Marketplace for Foundry Virtual Tabletop" -Duration 6 -Final
$segments += $path

$concat = Join-Path $work "concat.txt"
$segments | ForEach-Object { "file '$($_.Replace("'", "''"))'" } | Set-Content -Encoding ascii $concat
Invoke-FFmpeg @("-y", "-f", "concat", "-safe", "0", "-i", $concat, "-c", "copy", "-movflags", "+faststart", $Output)

Write-Host "Created $Output"
