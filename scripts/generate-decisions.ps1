<#
  generate-decisions.ps1
  ----------------------
  Scans docs/archive/raw (or anywhere you point it) for "decision-like" lines,
  groups them by date (from filename if present), and writes docs/active/DECISIONS.md

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\generate-decisions.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRootStr = $repoRoot.ToString().TrimEnd('\', '/')
Set-Location $repoRoot

$sourceRoot = Join-Path $repoRoot "docs\archive\raw"
$outFile = Join-Path $repoRoot "docs\active\DECISIONS.md"
New-Item -ItemType Directory -Force -Path (Split-Path $outFile) | Out-Null

# Decision-ish patterns (tune as needed)
$patterns = @(
  "(?i)\bdecision\b\s*[:\-]",
  "(?i)\bwe decided\b",
  "(?i)\bwe chose\b",
  "(?i)\bswitched to\b",
  "(?i)\bstandardized\b",
  "(?i)\badopted\b",
  "(?i)\buse n8n\b",
  "(?i)\buse neon\b",
  "(?i)\brailway\b",
  "(?i)\bhealth\b.*\b/health\b",
  "(?i)\bidempotenc(y|e)\b",
  "(?i)\bretry\b.*\bpolicy\b",
  "(?i)\bsource of truth\b",
  "(?i)\bfinal\b.*\bapproach\b",
  "(?i)\barchitecture\b.*\bdecision\b"
)

function Get-DateHintFromName([string]$name) {
  if ($name -match "(\d{4}-\d{2}-\d{2})") { return $Matches[1] }
  if ($name -match "(\d{4})(\d{2})(\d{2})") { return "$($Matches[1])-$($Matches[2])-$($Matches[3])" }
  return "undated"
}

$mdFiles = @()
if (Test-Path $sourceRoot) {
  $mdFiles = Get-ChildItem -Path $sourceRoot -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue
}

$found = New-Object System.Collections.Generic.List[Object]

foreach ($f in $mdFiles) {
  $dateHint = Get-DateHintFromName $f.Name

  $linesRaw = Get-Content -Path $f.FullName -ErrorAction SilentlyContinue
  if (-not $linesRaw) { continue }
  $lines = @($linesRaw)
  $baseLen = $repoRootStr.Length
  $relPath = if ($f.FullName.StartsWith($repoRootStr)) { $f.FullName.Substring([Math]::Min($baseLen + 1, $f.FullName.Length)).TrimStart('\', '/') } else { $f.Name }

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].Trim()
    if ($line.Length -lt 12) { continue }

    foreach ($p in $patterns) {
      if ($line -match $p) {
        $found.Add([pscustomobject]@{
          date = $dateHint
          file = $relPath
          text = $line
        })
        break
      }
    }
  }
}

# De-dup similar lines
$unique = $found | Sort-Object date, file, text | Select-Object -Unique date, file, text

# Group by date
$grouped = $unique | Group-Object date | Sort-Object Name

# Write DECISIONS.md
$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Decisions")
$md.Add("")
$md.Add("> Canonical record of architectural/product decisions extracted from historical logs.")
$md.Add("> If a decision changes, add a new entry and mark the old one as superseded.")
$md.Add("")

if ($unique.Count -eq 0) {
  $md.Add("_No decisions detected yet. Add lines containing ""Decision: …"", ""We chose …"", ""Switched to …"", etc._")
} else {
  foreach ($g in $grouped) {
    $md.Add("## $($g.Name)")
    $md.Add("")
    foreach ($item in $g.Group) {
      $md.Add("- **$($item.text)** _(source: ``$($item.file)``)_")
    }
    $md.Add("")
  }
}

$md -join "`n" | Set-Content -Encoding UTF8 -Path $outFile

Write-Host "`n✅ Wrote $outFile" -ForegroundColor Green
Write-Host "Decisions extracted: $($unique.Count)" -ForegroundColor Cyan
