# Morelord Marketplace release script - corrected manifest property handling v2
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$CommitMessage,

    [Parameter(Mandatory = $false)]
    [switch]$Prerelease,

    [Parameter(Mandatory = $false)]
    [switch]$Draft,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$ModuleId = "morelord-marketplace"
$ModuleTitle = "Morelord Marketplace"
$GitHubOwner = "tmoreland72"
$GitHubRepo = "morelord-marketplace"
$ReleaseBranch = "main"

$ArchiveName = "$ModuleId.zip"
$ArchivePath = Join-Path $ProjectRoot $ArchiveName
$ManifestPath = Join-Path $ProjectRoot "module.json"

$StagingPath = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    ("{0}-release-{1}" -f $ModuleId, [guid]::NewGuid().ToString("N"))

$DryRunArchivePath = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    ("{0}-dry-run-{1}.zip" -f $ModuleId, [guid]::NewGuid().ToString("N"))

$OriginalManifestText = $null
$ManifestWasModified = $false
$CommitWasCreated = $false
$TagWasCreated = $false

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)


function Show-Usage {
    Write-Host ""
    Write-Host "$ModuleTitle - Release Script" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Syntax:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  .\release.ps1 -Version <version> [options]"
    Write-Host ""

    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  -CommitMessage <message>  Override the default release commit message."
    Write-Host "  -Prerelease               Mark the GitHub Release as a prerelease."
    Write-Host "  -Draft                    Create the GitHub Release as a draft."
    Write-Host "  -DryRun                   Validate and package without modifying Git or GitHub."
    Write-Host ""

    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  .\release.ps1 -Version 0.1.0'
    Write-Host '  .\release.ps1 -Version 0.2.0 -Prerelease'
    Write-Host '  .\release.ps1 -Version 1.0.0 -Draft'
    Write-Host '  .\release.ps1 -Version 0.2.0 -DryRun'
    Write-Host '  .\release.ps1 -Version 0.1.1 -CommitMessage "Release v0.1.1"'
    Write-Host ""

    Write-Host "The script will:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Verify Git, GitHub CLI authentication, branch, remote, and repository state."
    Write-Host "  2. Validate module.json and require a version greater than the current version."
    Write-Host "  3. Update the manifest version and permanent release URLs."
    Write-Host "  4. Stage only the files required by Foundry."
    Write-Host "  5. Build and thoroughly validate the release ZIP."
    Write-Host "  6. Commit the manifest change and create an annotated Git tag."
    Write-Host "  7. Push the release commit and tag together."
    Write-Host "  8. Create a GitHub Release with generated release notes and upload the ZIP."
    Write-Host ""
}


function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host $Message -ForegroundColor Cyan
}


function Assert-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command '$Command' was not found."
    }
}


function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}


function Get-GitOutput {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    $Output = & $Command

    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }

    return ($Output | Out-String).Trim()
}


function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    [System.IO.File]::WriteAllText(
        $Path,
        $Text,
        $Utf8NoBom
    )
}



function Set-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Object,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $false)]
        $Value
    )

    if ($Object.PSObject.Properties.Name -contains $Name) {
        $Object.$Name = $Value
    }
    else {
        $Object |
            Add-Member `
                -MemberType NoteProperty `
                -Name $Name `
                -Value $Value
    }
}


function Assert-Utf8JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $Bytes = [System.IO.File]::ReadAllBytes($Path)

    if ($Bytes.Length -eq 0) {
        throw "JSON file '$Path' is empty."
    }

    $HasBom =
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xEF -and
        $Bytes[1] -eq 0xBB -and
        $Bytes[2] -eq 0xBF

    if ($HasBom) {
        throw "JSON file '$Path' contains a UTF-8 BOM."
    }

    if ($Bytes[0] -ne 0x7B) {
        throw "JSON file '$Path' does not begin with '{'."
    }

    try {
        Get-Content -Path $Path -Raw |
            ConvertFrom-Json |
            Out-Null
    }
    catch {
        throw "JSON file '$Path' is invalid: $($_.Exception.Message)"
    }
}


function Assert-Manifest {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Manifest
    )

    $RequiredProperties = @(
        "id",
        "title",
        "version",
        "compatibility"
    )

    foreach ($Property in $RequiredProperties) {
        if ($Manifest.PSObject.Properties.Name -notcontains $Property) {
            throw "module.json is missing required property '$Property'."
        }
    }

    if ($Manifest.id -ne $ModuleId) {
        throw "module.json id '$($Manifest.id)' does not match expected module id '$ModuleId'."
    }

    if ([string]::IsNullOrWhiteSpace([string]$Manifest.title)) {
        throw "module.json title is empty."
    }

    if ([string]::IsNullOrWhiteSpace([string]$Manifest.version)) {
        throw "module.json version is empty."
    }

    if ($Manifest.version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Current module.json version '$($Manifest.version)' is not a supported semantic version."
    }

    if (-not $Manifest.compatibility) {
        throw "module.json compatibility block is missing."
    }

    if (-not $Manifest.compatibility.minimum) {
        throw "module.json compatibility.minimum is missing."
    }

    $MinimumCompatibility = 0

    if (-not [int]::TryParse(
        [string]$Manifest.compatibility.minimum,
        [ref]$MinimumCompatibility
    )) {
        throw "module.json compatibility.minimum '$($Manifest.compatibility.minimum)' is not numeric."
    }

    if ($MinimumCompatibility -lt 14) {
        throw "$ModuleTitle must require Foundry VTT v14 or later."
    }
}


function Test-RemoteTagExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Tag
    )

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"

    try {
        git ls-remote `
            --exit-code `
            --tags `
            origin `
            "refs/tags/$Tag" `
            *> $null

        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }
}


function Test-GitHubReleaseExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Tag
    )

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"

    try {
        gh release view $Tag `
            --repo "$GitHubOwner/$GitHubRepo" `
            *> $null

        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }
}


function Copy-ReleaseContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $RequiredPaths = @(
        "module.json",
        "README.md",
        "scripts",
        "styles",
        "templates"
    )

    $OptionalPaths = @(
        "assets",
        "lang",
        "LICENSE",
        "LICENSE.md",
        "CHANGELOG.md"
    )

    foreach ($Path in $RequiredPaths) {
        $SourcePath = Join-Path $ProjectRoot $Path

        if (-not (Test-Path $SourcePath)) {
            throw "Required release path '$Path' was not found."
        }
    }

    New-Item `
        -ItemType Directory `
        -Path $Destination `
        -Force |
        Out-Null

    foreach ($Path in $RequiredPaths) {
        Copy-Item `
            -Path (Join-Path $ProjectRoot $Path) `
            -Destination $Destination `
            -Recurse `
            -Force
    }

    foreach ($Path in $OptionalPaths) {
        $SourcePath = Join-Path $ProjectRoot $Path

        if (Test-Path $SourcePath) {
            Copy-Item `
                -Path $SourcePath `
                -Destination $Destination `
                -Recurse `
                -Force
        }
    }
}


function Update-ManifestFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$ReleaseVersion,

        [Parameter(Mandatory = $true)]
        [string]$ReleaseDownloadUrl
    )

    $Manifest =
        Get-Content `
            -Path $Path `
            -Raw |
        ConvertFrom-Json

    Assert-Manifest -Manifest $Manifest

    Set-JsonProperty `
        -Object $Manifest `
        -Name "version" `
        -Value $ReleaseVersion

    Set-JsonProperty `
        -Object $Manifest `
        -Name "download" `
        -Value $ReleaseDownloadUrl

    Set-JsonProperty `
        -Object $Manifest `
        -Name "url" `
        -Value "https://github.com/$GitHubOwner/$GitHubRepo"

    Set-JsonProperty `
        -Object $Manifest `
        -Name "manifest" `
        -Value "https://raw.githubusercontent.com/$GitHubOwner/$GitHubRepo/$ReleaseBranch/module.json"

    $ManifestJson =
        $Manifest |
        ConvertTo-Json -Depth 100

    Write-Utf8NoBom `
        -Path $Path `
        -Text $ManifestJson

    Assert-Utf8JsonFile -Path $Path
}


function Build-Archive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory,

        [Parameter(Mandatory = $true)]
        [string]$DestinationArchive
    )

    if (Test-Path $DestinationArchive) {
        Remove-Item `
            -Path $DestinationArchive `
            -Force
    }

    Compress-Archive `
        -Path (Join-Path $SourceDirectory "*") `
        -DestinationPath $DestinationArchive `
        -CompressionLevel Optimal `
        -Force
}


function Assert-Archive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedDownloadUrl
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $Zip = [System.IO.Compression.ZipFile]::OpenRead($Path)

    try {
        $EntryNames = @(
            $Zip.Entries |
                ForEach-Object {
                    $_.FullName.Replace("\", "/")
                }
        )

        $RequiredRootEntries = @(
            "module.json",
            "README.md"
        )

        foreach ($EntryName in $RequiredRootEntries) {
            if ($EntryNames -notcontains $EntryName) {
                throw "Required archive entry '$EntryName' was not found at the ZIP root."
            }
        }

        $RequiredFolders = @(
            "scripts/",
            "styles/",
            "templates/"
        )

        foreach ($Folder in $RequiredFolders) {
            $FoundFolderContent =
                $EntryNames |
                Where-Object {
                    $_.StartsWith(
                        $Folder,
                        [System.StringComparison]::OrdinalIgnoreCase
                    )
                }

            if (-not $FoundFolderContent) {
                throw "Required archive folder '$Folder' was not found."
            }
        }

        $ForbiddenPatterns = @(
            '^\.git/',
            '^\.github/',
            '^\.vscode/',
            '^node_modules/',
            '^\.release-staging/',
            '(^|/)release\.ps1$',
            '\.zip$',
            '\.log$',
            '(^|/)\.DS_Store$',
            '(^|/)Thumbs\.db$'
        )

        foreach ($EntryName in $EntryNames) {
            foreach ($Pattern in $ForbiddenPatterns) {
                if ($EntryName -match $Pattern) {
                    throw "Forbidden archive entry '$EntryName' matched pattern '$Pattern'."
                }
            }
        }

        $ManifestEntry =
            $Zip.Entries |
            Where-Object {
                $_.FullName.Replace("\", "/") -eq "module.json"
            } |
            Select-Object -First 1

        if (-not $ManifestEntry) {
            throw "module.json is not located at the ZIP root."
        }

        $ManifestStream = $ManifestEntry.Open()

        try {
            $FirstByte = $ManifestStream.ReadByte()

            if ($FirstByte -ne 0x7B) {
                throw "ZIP module.json does not begin with '{'. Possible BOM or invalid encoding."
            }
        }
        finally {
            $ManifestStream.Dispose()
        }

        $Reader = New-Object System.IO.StreamReader($ManifestEntry.Open())

        try {
            $ZippedManifestText = $Reader.ReadToEnd()
            $ZippedManifest = $ZippedManifestText | ConvertFrom-Json
        }
        finally {
            $Reader.Dispose()
        }

        Assert-Manifest -Manifest $ZippedManifest

        if ($ZippedManifest.version -ne $ExpectedVersion) {
            throw "ZIP module.json version '$($ZippedManifest.version)' does not match '$ExpectedVersion'."
        }

        if ($ZippedManifest.download -ne $ExpectedDownloadUrl) {
            throw "ZIP module.json download URL does not match the expected release URL."
        }

        Write-Host "  module.json found at ZIP root"
        Write-Host "  README.md found at ZIP root"
        Write-Host "  required folders verified"
        Write-Host "  forbidden entries check passed"
        Write-Host "  version: $($ZippedManifest.version)"
        Write-Host "  download URL verified"
        Write-Host "  UTF-8 BOM check passed"
    }
    finally {
        $Zip.Dispose()
    }
}


if ([string]::IsNullOrWhiteSpace($Version)) {
    Show-Usage
    exit 0
}


$Tag = "v$Version"

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $CommitMessage = "Release $Tag"
}

$DownloadUrl =
    "https://github.com/$GitHubOwner/$GitHubRepo/releases/download/$Tag/$ArchiveName"

$ManifestUrl =
    "https://raw.githubusercontent.com/$GitHubOwner/$GitHubRepo/$ReleaseBranch/module.json"

$GitHubReleaseUrl =
    "https://github.com/$GitHubOwner/$GitHubRepo/releases/tag/$Tag"


Set-Location $ProjectRoot

Write-Host ""
Write-Host "Preparing $ModuleTitle release $Tag..." -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "DRY RUN: Git and GitHub will not be modified." -ForegroundColor Yellow
}


try {
    Write-Step "Checking prerequisites..."

    Assert-CommandExists "git"

    if (-not $DryRun) {
        Assert-CommandExists "gh"
    }

    git rev-parse --is-inside-work-tree 2>$null |
        Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "This directory is not a Git repository."
    }

    if (-not (Test-Path $ManifestPath)) {
        throw "module.json was not found at '$ManifestPath'."
    }


    Write-Step "Checking repository identity and state..."

    $CurrentBranch = Get-GitOutput `
        -Command { git branch --show-current } `
        -FailureMessage "Unable to determine the current Git branch."

    if ($CurrentBranch -ne $ReleaseBranch) {
        throw "Releases must be created from '$ReleaseBranch'. Current branch: '$CurrentBranch'."
    }

    $OriginUrl = Get-GitOutput `
        -Command { git remote get-url origin } `
        -FailureMessage "Git remote 'origin' was not found."

    $ExpectedRepositoryPattern =
        [regex]::Escape("$GitHubOwner/$GitHubRepo")

    if ($OriginUrl -notmatch $ExpectedRepositoryPattern) {
        throw "Git remote 'origin' does not point to $GitHubOwner/$GitHubRepo. Current value: $OriginUrl"
    }

    $InitialGitStatus = Get-GitOutput `
        -Command { git status --porcelain } `
        -FailureMessage "Unable to inspect the Git working tree."

    if (-not [string]::IsNullOrWhiteSpace($InitialGitStatus)) {
        throw @"
The working tree contains uncommitted or untracked changes.

Commit or stash them before creating a release:

$InitialGitStatus
"@
    }

    Invoke-NativeCommand `
        -Command { git fetch origin --tags --prune } `
        -FailureMessage "Unable to fetch the latest repository state from origin."

    git rev-parse --verify "origin/$ReleaseBranch" *> $null

    if ($LASTEXITCODE -ne 0) {
        throw "Remote branch 'origin/$ReleaseBranch' was not found."
    }

    $BehindCountText = Get-GitOutput `
        -Command {
            git rev-list `
                --count `
                "HEAD..origin/$ReleaseBranch"
        } `
        -FailureMessage "Unable to compare the local branch with origin/$ReleaseBranch."

    $BehindCount = [int]$BehindCountText

    if ($BehindCount -gt 0) {
        throw "Local '$ReleaseBranch' is $BehindCount commit(s) behind origin/$ReleaseBranch. Pull before releasing."
    }


    Write-Step "Checking GitHub CLI and release identifiers..."

    if (-not $DryRun) {
        Invoke-NativeCommand `
            -Command { gh auth status } `
            -FailureMessage "GitHub CLI is not authenticated. Run 'gh auth login' first."
    }

    $ExistingLocalTag = git tag --list $Tag

    if ($ExistingLocalTag) {
        throw "Git tag '$Tag' already exists locally."
    }

    if (Test-RemoteTagExists -Tag $Tag) {
        throw "Git tag '$Tag' already exists on origin."
    }

    if (-not $DryRun) {
        if (Test-GitHubReleaseExists -Tag $Tag) {
            throw "GitHub Release '$Tag' already exists."
        }
    }


    Write-Step "Validating module.json..."

    Assert-Utf8JsonFile -Path $ManifestPath

    $Manifest =
        Get-Content `
            -Path $ManifestPath `
            -Raw |
        ConvertFrom-Json

    Assert-Manifest -Manifest $Manifest

    $CurrentVersionObject = [version]$Manifest.version
    $ReleaseVersionObject = [version]$Version

    if ($ReleaseVersionObject -lt $CurrentVersionObject) {
        throw "Release version $Version cannot be lower than current version $($Manifest.version)."
    }

    if ($ReleaseVersionObject -eq $CurrentVersionObject) {
        Write-Host "  Version note    : module.json is already set to the requested release version." -ForegroundColor Yellow
    }

    Write-Host "  Module ID       : $($Manifest.id)"
    Write-Host "  Current version : $($Manifest.version)"
    Write-Host "  Release version : $Version"
    Write-Host "  Branch          : $CurrentBranch"
    Write-Host "  Origin          : $OriginUrl"
    Write-Host "  Download URL    : $DownloadUrl"


    Write-Step "Preparing release staging directory..."

    Copy-ReleaseContent -Destination $StagingPath

    $StagedManifestPath = Join-Path $StagingPath "module.json"

    Update-ManifestFile `
        -Path $StagedManifestPath `
        -ReleaseVersion $Version `
        -ReleaseDownloadUrl $DownloadUrl

    if (-not $DryRun) {
        $OriginalManifestText =
            Get-Content `
                -Path $ManifestPath `
                -Raw

        Update-ManifestFile `
            -Path $ManifestPath `
            -ReleaseVersion $Version `
            -ReleaseDownloadUrl $DownloadUrl

        $ManifestWasModified = $true

        Copy-Item `
            -Path $ManifestPath `
            -Destination $StagedManifestPath `
            -Force
    }


    Write-Step "Building release archive..."

    $OutputArchivePath =
        if ($DryRun) {
            $DryRunArchivePath
        }
        else {
            $ArchivePath
        }

    Build-Archive `
        -SourceDirectory $StagingPath `
        -DestinationArchive $OutputArchivePath

    Write-Host "  Archive: $OutputArchivePath"


    Write-Step "Verifying release archive..."

    Assert-Archive `
        -Path $OutputArchivePath `
        -ExpectedVersion $Version `
        -ExpectedDownloadUrl $DownloadUrl

    Write-Host ""
    Write-Host "Archive verification successful." -ForegroundColor Green


    if ($DryRun) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Dry run for $Tag completed successfully." -ForegroundColor Green
        Write-Host "No project files, Git history, tags, or GitHub releases were changed." -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        exit 0
    }


    Write-Step "Staging release manifest..."

    Invoke-NativeCommand `
        -Command { git add -- module.json } `
        -FailureMessage "git add failed."

    git diff --cached --quiet

    if ($LASTEXITCODE -eq 0) {
        throw "No staged release changes were detected."
    }

    git diff --cached --check

    if ($LASTEXITCODE -ne 0) {
        throw "Staged changes contain whitespace errors."
    }

    Write-Host ""
    git status --short


    Write-Step "Creating release commit..."

    Write-Host "  $CommitMessage"

    Invoke-NativeCommand `
        -Command {
            git commit `
                -m $CommitMessage
        } `
        -FailureMessage "git commit failed."

    $CommitWasCreated = $true


    Write-Step "Creating annotated Git tag $Tag..."

    Invoke-NativeCommand `
        -Command {
            git tag `
                -a $Tag `
                -m "$ModuleTitle $Tag"
        } `
        -FailureMessage "Failed to create Git tag '$Tag'."

    $TagWasCreated = $true


    Write-Step "Pushing release commit and tag..."

    Invoke-NativeCommand `
        -Command {
            git push `
                origin `
                $ReleaseBranch `
                $Tag
        } `
        -FailureMessage "Failed to push the release commit and tag."


    Write-Step "Creating GitHub Release..."

    $ReleaseTitle = "$Tag - $ModuleTitle"

    $ReleaseArguments = @(
        "release",
        "create",
        $Tag,
        $ArchivePath,
        "--repo",
        "$GitHubOwner/$GitHubRepo",
        "--title",
        $ReleaseTitle,
        "--generate-notes",
        "--verify-tag"
    )

    if ($Prerelease) {
        $ReleaseArguments += "--prerelease"
    }

    if ($Draft) {
        $ReleaseArguments += "--draft"
    }

    & gh @ReleaseArguments

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create GitHub Release '$Tag'."
    }


    Write-Step "Verifying GitHub Release..."

    Invoke-NativeCommand `
        -Command {
            gh release view `
                $Tag `
                --repo "$GitHubOwner/$GitHubRepo"
        } `
        -FailureMessage "GitHub Release verification failed."


    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Release $Tag completed successfully." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    Write-Host "Foundry Manifest URL:" -ForegroundColor Yellow
    Write-Host $ManifestUrl
    Write-Host ""

    Write-Host "Release download URL:" -ForegroundColor Yellow
    Write-Host $DownloadUrl
    Write-Host ""

    Write-Host "GitHub Release:" -ForegroundColor Yellow
    Write-Host $GitHubReleaseUrl
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "RELEASE FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""

    if (
        $ManifestWasModified -and
        -not $CommitWasCreated -and
        $null -ne $OriginalManifestText
    ) {
        Write-Host "Restoring the original module.json..." -ForegroundColor Yellow

        Write-Utf8NoBom `
            -Path $ManifestPath `
            -Text $OriginalManifestText

        $ManifestWasModified = $false
    }

    if ($TagWasCreated -and -not $CommitWasCreated) {
        git tag -d $Tag *> $null
    }

    if ($CommitWasCreated) {
        Write-Host "The release commit was created before the failure." -ForegroundColor Yellow
        Write-Host "The script did not automatically rewrite Git history." -ForegroundColor Yellow
    }

    if ($TagWasCreated) {
        Write-Host "The local tag '$Tag' may exist and should be inspected before retrying." -ForegroundColor Yellow
    }

    exit 1
}
finally {
    if (Test-Path $StagingPath) {
        Remove-Item `
            -Path $StagingPath `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }

    if ($DryRun -and (Test-Path $DryRunArchivePath)) {
        Remove-Item `
            -Path $DryRunArchivePath `
            -Force `
            -ErrorAction SilentlyContinue
    }
}
