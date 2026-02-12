<#
  classify-md.ps1
  ----------------
  Scans repo for Markdown files and classifies them into:
    - iterative_logs (bloat)
    - reference_docs (merge-worthy)
    - experiments (keep raw)
    - uncategorized

  Outputs inventory to docs/_md_inventory/
  Optional move into docs/archive/raw/<category>/ via -Move switch.

  Usage:
    pwsh -File scripts/classify-md.ps1
    pwsh -File scripts/classify-md.ps1 -IncludeArchive   # full inventory including archive (report-only)
    pwsh -File scripts/classify-md.ps1 -Move
    pwsh -File scripts/classify-md.ps1 -Move -WhatIf
#>

param(
  [switch]$Move,
  [switch]$WhatIf,
  [switch]$IncludeArchive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Repo root (assumes script is in scripts/)
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRootStr = $repoRoot.ToString().TrimEnd('\', '/')
Set-Location $repoRoot

# --- Output folders
$inventoryDir = Join-Path $repoRoot "docs\_md_inventory"
$null = New-Item -ItemType Directory -Force -Path $inventoryDir

# --- Archive target root (only used if -Move)
$archiveRoot = Join-Path $repoRoot "docs\archive\raw"
$null = New-Item -ItemType Directory -Force -Path $archiveRoot

# --- Ignore directories (keeps scan fast)
$ignoreDirRegex = @(
  "\\\.git\\",
  "\\node_modules\\",
  "\\dist\\",
  "\\build\\",
  "\\coverage\\",
  "\\\.next\\",
  "\\\.cache\\",
  "\\\.cursor\\"
) -join "|"

# --- Helper: scored classification (reduces uncategorized)
function Get-MdCategory {
  param(
    [string]$FullName,
    [string]$Name,
    [string]$ContentHead
  )

  $upper = $Name.ToUpperInvariant()
  $text = if ($ContentHead) { $ContentHead } else { "" }

  # Hard rules first (high confidence)
  if ($upper -match "^(FIX|COMPLETE|PROGRESS|DAY|IMPLEMENT)[\-_]") { return "iterative_logs" }

  # Keyword scoring (medium confidence)
  $score = @{
    iterative_logs = 0
    reference_docs = 0
    experiments    = 0
  }

  # Filename signals
  if ($upper -match "(FIX|COMPLETE|PROGRESS|STATUS|CHANGELOG|PATCH|FINAL_|_FINAL|RUNBOOK_EXECUTION|BUILD_FIX|MIGRATION_FIX|DAILY|CURRENT_PROGRESS)") { $score.iterative_logs += 4 }
  if ($upper -match "(README|SETUP|INSTALL|STARTUP|ONBOARD|DEPLOY|DEPLOYMENT|RUNBOOK|ARCHITECTURE|TROUBLESHOOT|SCHEMA|MIGRATION|ENV|CONFIG)") { $score.reference_docs += 4 }
  if ($upper -match "(DRAFT|IDEA|BRAINSTORM|WIP|SCRATCH|TEMP|OLD|BACKUP|NOTES|RANDOM)") { $score.experiments += 4 }

  # Content signals (strong)
  if ($text -match "(?i)\b(prerequisites|installation|environment variables|dotenv|how to run|local dev)\b") { $score.reference_docs += 5 }
  if ($text -match "(?i)\b(deploy|deployment|railway|build command|start command|rollback|production)\b") { $score.reference_docs += 5 }
  if ($text -match "(?i)\b(database schema|migrations|ddl|postgres|neon)\b") { $score.reference_docs += 4 }
  if ($text -match "(?i)\b(runbook|incident|oncall|health check|/health|debug)\b") { $score.reference_docs += 4 }

  if ($text -match "(?i)\b(today|yesterday|progress|status update|fixed|worklog|notes from)\b") { $score.iterative_logs += 3 }
  if ($text -match "(?i)\b(brainstorm|rough notes|idea dump|maybe we should|what if)\b") { $score.experiments += 3 }

  # Decide winner
  $winner = $score.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1

  # Confidence threshold: if everything is weak, mark uncategorized
  if ($winner.Value -lt 4) { return "uncategorized" }

  return $winner.Key
}

# --- Gather markdown files (exclude archive unless -IncludeArchive for full report)
$mdFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Filter "*.md" |
  Where-Object { $_.FullName -notmatch $ignoreDirRegex }
if (-not $IncludeArchive) {
  $archiveSegment = 'docs' + [IO.Path]::DirectorySeparatorChar + 'archive' + [IO.Path]::DirectorySeparatorChar + 'raw'
  $mdFiles = $mdFiles | Where-Object {
    $norm = $_.FullName.Replace('/', [IO.Path]::DirectorySeparatorChar)
    $norm.IndexOf($archiveSegment, [StringComparison]::OrdinalIgnoreCase) -lt 0
  }
}

$results = @()

foreach ($f in $mdFiles) {
  # Read a small chunk only (fast)
  $head = ""
  try {
    $head = (Get-Content -Path $f.FullName -TotalCount 40 -ErrorAction Stop) -join "`n"
  } catch {
    $head = ""
  }

  $category = Get-MdCategory -FullName $f.FullName -Name $f.Name -ContentHead $head

  $fullPath = $f.FullName
  $dirPath  = $f.DirectoryName
  $baseLen  = $repoRootStr.Length
  $relPath  = if ($fullPath.StartsWith($repoRootStr)) { $fullPath.Substring([Math]::Min($baseLen + 1, $fullPath.Length)).TrimStart('\', '/') } else { $f.Name }
  $relDir   = if ($dirPath.StartsWith($repoRootStr)) { $dirPath.Substring([Math]::Min($baseLen + 1, $dirPath.Length)).TrimStart('\', '/') } else { $relPath }

  $results += [pscustomobject]@{
    category = $category
    name     = $f.Name
    rel_path = $relPath
    dir      = $relDir
    size_kb  = [math]::Round(($f.Length / 1KB), 2)
    modified = $f.LastWriteTime.ToString("s")
  }
}

# --- Write CSV + JSON
$csvPath  = Join-Path $inventoryDir "md_inventory.csv"
$jsonPath = Join-Path $inventoryDir "md_inventory.json"
$mdPath   = Join-Path $inventoryDir "md_report.md"

$results | Sort-Object category, rel_path | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $csvPath
$results | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $jsonPath

# --- Summary counts
$counts = $results | Group-Object category | Sort-Object Name

# --- Build markdown report
$lines = @()
$lines += "# Markdown Inventory Report"
$lines += ""
$lines += "Scanned: **$($results.Count)** markdown files (excluding docs/archive/raw and ignored build folders)."
$lines += ""
$lines += "## Category counts"
foreach ($c in $counts) {
  $lines += "- **$($c.Name)**: $($c.Count)"
}
$lines += ""
$lines += "## Top 25 largest markdown files"
$lines += ""
$lines += "| Size (KB) | Category | Path |"
$lines += "|---:|---|---|"
$results | Sort-Object size_kb -Descending | Select-Object -First 25 | ForEach-Object {
  $lines += "| $($_.size_kb) | $($_.category) | $($_.rel_path) |"
}
$lines += ""
$lines += "## Uncategorized (needs manual glance)"
$lines += ""
$unc = @($results | Where-Object category -eq "uncategorized")
if ($unc.Count -eq 0) {
  $lines += "_None 🎉_"
} else {
  $lines += "| Category | Path |"
  $lines += "|---|---|"
  $unc | Sort-Object rel_path | ForEach-Object {
    $lines += "| $($_.category) | $($_.rel_path) |"
  }
}

$lines -join "`n" | Set-Content -Encoding UTF8 -Path $mdPath

Write-Host "`n=== MD CLASSIFICATION DONE ===" -ForegroundColor Cyan
if ($IncludeArchive) { Write-Host "(Full inventory including docs/archive/raw; report only, no move)" -ForegroundColor Gray }
Write-Host "Total scanned: $($results.Count)" -ForegroundColor Green
foreach ($c in $counts) {
  Write-Host ("{0,-16} {1,6}" -f $c.Name, $c.Count) -ForegroundColor Green
}
Write-Host "`nInventory CSV:  $csvPath" -ForegroundColor Yellow
Write-Host "Inventory JSON: $jsonPath" -ForegroundColor Yellow
Write-Host "Report MD:      $mdPath" -ForegroundColor Yellow

# --- Optional move
if ($Move) {
  Write-Host "`n=== MOVE MODE ENABLED ===" -ForegroundColor Cyan
  Write-Host "Moving files into docs/archive/raw/<category>/ (keeping filenames same)." -ForegroundColor Yellow
  Write-Host "TIP: Run with -WhatIf first to preview." -ForegroundColor Yellow

  foreach ($r in $results) {
    # Skip files already in archive (e.g. when -IncludeArchive was used for report-only)
    if ($r.rel_path -match '^docs[\\/]archive[\\/]raw[\\/]') { continue }
    # Only move non-canonical stuff: iterative_logs, experiments, uncategorized
    if ($r.category -in @("iterative_logs", "experiments", "uncategorized")) {
      $src = Join-Path $repoRoot $r.rel_path
      $destDir = Join-Path $archiveRoot $r.category
      $null = New-Item -ItemType Directory -Force -Path $destDir

      $dest = Join-Path $destDir $r.name

      if ($WhatIf) {
        $relDest = $dest
        if ($dest.StartsWith($repoRootStr)) {
          $relDest = $dest.Substring($repoRootStr.Length).TrimStart('\', '/')
        }
        Write-Host "[WhatIf] Move $($r.rel_path) -> $relDest"
      } else {
        # Prevent overwrite collision by prefixing with folder if needed
        if (Test-Path $dest) {
          $safeName = ($r.dir -replace "[\\\/:]", "_") + "__" + $r.name
          $dest = Join-Path $destDir $safeName
        }
        Move-Item -Path $src -Destination $dest -Force
      }
    }
  }

  if (-not $WhatIf) {
    Write-Host "`n[OK] Move complete. Raw history preserved in docs/archive/raw/." -ForegroundColor Green
  } else {
    Write-Host "`n[OK] Preview complete (no files moved)." -ForegroundColor Green
  }
}
