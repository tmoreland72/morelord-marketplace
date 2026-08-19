param(
    [string]$Output = (Join-Path $PSScriptRoot "morelord-marketplace-demo.mp4")
)

$ErrorActionPreference = "Stop"

$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$assets = Join-Path $PSScriptRoot "..\docs\assets"
$work = Join-Path $PSScriptRoot ".render"

New-Item -ItemType Directory -Force -Path $work | Out-Null

$width = 1920
$height = 1080
$fps = 30
$gold = "0xE8CFA5"
$paper = "0xF7F0E5"
$ink = "0x090810"
$fontTitle = "C\:/Windows/Fonts/georgiab.ttf"
$fontBody = "C\:/Windows/Fonts/arial.ttf"

function Invoke-FFmpeg([string[]]$Arguments) {
    & $ffmpeg @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "FFmpeg failed with exit code $LASTEXITCODE."
    }
}

function Escape-DrawText([string]$Text) {
    return $Text.Replace("\", "\\").Replace(":", "\:").Replace("'", "’")
}

function New-TitleCard {
    param(
        [string]$Path,
        [string]$Title,
        [string]$Subtitle,
        [double]$Duration
    )

    $safeTitle = Escape-DrawText $Title
    $safeSubtitle = Escape-DrawText $Subtitle
    $filter = "drawbox=x=0:y=0:w=iw:h=ih:color=${ink}:t=fill," +
        "drawbox=x=160:y=260:w=12:h=560:color=${gold}:t=fill," +
        "drawtext=fontfile='$fontTitle':text='$safeTitle':fontcolor=${paper}:fontsize=82:x=220:y=360," +
        "drawtext=fontfile='$fontBody':text='$safeSubtitle':fontcolor=${gold}:fontsize=34:x=225:y=500," +
        "drawtext=fontfile='$fontBody':text='MORELORD GAMING':fontcolor=0x9E9187:fontsize=24:x=225:y=720," +
        "fade=t=in:st=0:d=0.6,fade=t=out:st=$($Duration - 0.7):d=0.7"

    Invoke-FFmpeg @("-y", "-f", "lavfi", "-i", "color=c=${ink}:s=${width}x${height}:r=${fps}:d=${Duration}", "-vf", $filter,
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "$fps", $Path)
}

function New-ScreenshotClip {
    param(
        [string]$Path,
        [string]$Image,
        [string]$Heading,
        [string]$Caption,
        [double]$Duration = 7
    )

    $safeHeading = Escape-DrawText $Heading
    $safeCaption = Escape-DrawText $Caption
    $frames = [int]($Duration * $fps)
    $fadeOut = $Duration - 0.6
    $filter = "scale=2100:-2,crop=${width}:${height}:x='(iw-ow)/2':y='(ih-oh)/2'," +
        "zoompan=z='min(zoom+0.00035,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=$fps," +
        "drawbox=x=0:y=800:w=iw:h=280:color=0x090810@0.90:t=fill," +
        "drawbox=x=112:y=846:w=8:h=142:color=${gold}:t=fill," +
        "drawtext=fontfile='$fontTitle':text='$safeHeading':fontcolor=${paper}:fontsize=48:x=150:y=842," +
        "drawtext=fontfile='$fontBody':text='$safeCaption':fontcolor=${gold}:fontsize=27:x=154:y=922," +
        "fade=t=in:st=0:d=0.45,fade=t=out:st=${fadeOut}:d=0.6"

    Invoke-FFmpeg @("-y", "-loop", "1", "-i", $Image, "-vf", $filter, "-t", "$Duration", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "$fps", $Path)
}

$segments = @()

$title = Join-Path $work "00-title.mp4"
New-TitleCard -Path $title -Title "MORELORD MARKETPLACE" -Subtitle "Buy, sell, and manage adventuring gear in Foundry VTT" -Duration 5
$segments += $title

$slides = @(
    @{ Image = "global-marketplace-overview.png"; Heading = "A marketplace built into your world"; Caption = "Browse, buy, or sell with the active player character." },
    @{ Image = "global-buy-filters.png"; Heading = "Find exactly what the party needs"; Caption = "Search, affordability, rarity, source, weapon, and tri-state filters." },
    @{ Image = "player-shop-overview.png"; Heading = "Turn scene vendors into real shops"; Caption = "Distinct inventory, stock, pricing, reputation, and actor funding." },
    @{ Image = "shop-cart.png"; Heading = "A cart that understands adventuring parties"; Caption = "Choose who receives the gear and which character or group pays." },
    @{ Image = "shop-manager-overview.png"; Heading = "Build vendors in minutes"; Caption = "Start from a prefab, customize access and pricing, then place on scene." },
    @{ Image = "shop-manager-products-stock.png"; Heading = "Control every shelf"; Caption = "Configure products, rarity, limited stock, and automatic restocking." },
    @{ Image = "gm-approval-card.png"; Heading = "Keep the GM in control"; Caption = "Optional approval workflows make player transactions easy to review." }
)

$index = 1
foreach ($slide in $slides) {
    $segment = Join-Path $work ("{0:D2}-slide.mp4" -f $index)
    New-ScreenshotClip -Path $segment -Image (Join-Path $assets $slide.Image) -Heading $slide.Heading -Caption $slide.Caption
    $segments += $segment
    $index++
}

$outro = Join-Path $work "99-outro.mp4"
New-TitleCard -Path $outro -Title "ADVENTURE HAS A PRICE" -Subtitle "Morelord Marketplace for Foundry Virtual Tabletop" -Duration 6
$segments += $outro

$concat = Join-Path $work "concat.txt"
$segments | ForEach-Object { "file '$($_.Replace("'", "''"))'" } | Set-Content -Encoding ascii $concat

Invoke-FFmpeg @("-y", "-f", "concat", "-safe", "0", "-i", $concat, "-c", "copy", $Output)

Write-Host "Created $Output"
