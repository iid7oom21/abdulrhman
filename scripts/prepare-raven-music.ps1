# RAVEN soundtrack migration: conversion only. Does not push, publish or delete anything.
# Run from PowerShell: .\scripts\prepare-raven-music.ps1 -SourceFolder "C:\path\to\your\mp4s"
param(
  [Parameter(Mandatory=$true)]
  [string]$SourceFolder
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'raven/music-replacement/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$source = (Resolve-Path -LiteralPath $SourceFolder).Path
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw 'ffmpeg not installed. Install FFmpeg first, then rerun this script.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  throw 'ffprobe not installed. FFmpeg installation must include ffprobe.'
}
$missing = @()
foreach ($track in $manifest.tracks) {
  $mp4 = Join-Path $source $track.source_mp4
  if (-not (Test-Path -LiteralPath $mp4 -PathType Leaf)) {
    $missing += $track.source_mp4
  }
}
if ($missing.Count -gt 0) {
  throw ('Missing source videos: ' + ($missing -join ', ') + '. No conversion has started.')
}
# Check sound streams before creating any files.
foreach ($track in $manifest.tracks) {
  $mp4 = Join-Path $source $track.source_mp4
  $codec = & ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of 'default=noprint_wrappers=1:nokey=1' $mp4
  if ($LASTEXITCODE -ne 0 -or -not $codec) {
    throw ('No readable audio in: ' + $track.source_mp4 + '. No conversion has started.')
  }
}
$targetDir = Join-Path $root 'assets/audio/raven-replacement'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
$seen = @{}
$report = @()
foreach ($track in $manifest.tracks) {
  $mp4 = Join-Path $source $track.source_mp4
  $output = Join-Path $root $track.target_m4a
  Write-Host ('Extracting without re-encoding ' + $track.source_mp4 + ' -> ' + $track.target_m4a)
  & ffmpeg -nostdin -hide_banner -loglevel error -y -i $mp4 -map 0:a:0 -vn -c:a copy -movflags +faststart -metadata ('title=' + $track.display_title) $output
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
    throw ('Audio extraction failed: ' + $track.source_mp4)
  }
  $duration = (& ffprobe -v error -show_entries format=duration -of 'default=noprint_wrappers=1:nokey=1' $output).Trim()
  if ($LASTEXITCODE -ne 0 -or [double]::Parse($duration, [System.Globalization.CultureInfo]::InvariantCulture) -le 0) {
    throw ('Invalid converted audio: ' + $output)
  }
  # Decode to raw PCM before hashing, so different video containers with the same sound are detected.
  $fingerprint = (& ffmpeg -nostdin -v error -i $mp4 -map 0:a:0 -vn -c:a pcm_s16le -f hash -hash SHA256 -).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $fingerprint.StartsWith('SHA256=')) {
    throw ('Audio fingerprint failed: ' + $track.source_mp4)
  }
  if ($seen.ContainsKey($fingerprint)) {
    Write-Warning ('POSSIBLE DUPLICATE AUDIO: ' + $track.source_mp4 + ' and ' + $seen[$fingerprint])
  } else {
    $seen[$fingerprint] = $track.source_mp4
  }
  $report += [pscustomobject]@{
    source = $track.source_mp4
    output = $track.target_m4a
    duration_seconds = $duration
    sha256_pcm = $fingerprint.Replace('SHA256=', '')
    bytes = (Get-Item -LiteralPath $output).Length
  }
}
$reportPath = Join-Path $root 'raven/music-replacement/conversion-report.json'
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ('Converted ' + $report.Count + ' M4A files. Report: ' + $reportPath)
Write-Host 'The live site has NOT been changed. Review duplicates and upload audio to the draft branch before merging.'
