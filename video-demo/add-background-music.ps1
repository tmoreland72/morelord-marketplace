param(
    [string]$Video = (Join-Path $PSScriptRoot "MorelordMarketplace-GMDemo-Branded.mp4"),
    [string]$Music = (Join-Path $PSScriptRoot "music\TownTheme.mp3"),
    [string]$Output = (Join-Path $PSScriptRoot "MorelordMarketplace-GMDemo-Branded-TownTheme-v2.mp4")
)

$ErrorActionPreference = "Stop"
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source

# Three copies are joined with musical crossfades, then trimmed to the video.
# The roughly -25 dB average mix leaves headroom for future narration.
$filter = @"
[1:a]asplit=3[m1][m2][m3];
[m1]atrim=0:97.35,asetpts=PTS-STARTPTS[a1];
[m2]atrim=0:97.35,asetpts=PTS-STARTPTS[a2];
[m3]atrim=0:97.35,asetpts=PTS-STARTPTS[a3];
[a1][a2]acrossfade=d=3:c1=tri:c2=tri[x1];
[x1][a3]acrossfade=d=3:c1=tri:c2=tri,
atrim=0:202.366,volume=0.34,
afade=t=in:st=0:d=3,afade=t=out:st=196.366:d=6[music]
"@

& $ffmpeg -hide_banner -loglevel warning -y `
    -i $Video -i $Music `
    -filter_complex $filter `
    -map 0:v:0 -map "[music]" `
    -c:v copy -c:a aac -b:a 192k -ac 2 -ar 48000 -shortest -movflags +faststart $Output

if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed with exit code $LASTEXITCODE." }
Write-Host "Created $Output"
