$dir = Join-Path $PSScriptRoot "..\\.vscode"
$path = Join-Path $dir "settings.json"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$json = @"
{
  "search.exclude": {
    "**/docs/archive/**": true,
    "**/docs/_md_inventory/**": true
  },
  "files.watcherExclude": {
    "**/docs/archive/**": true,
    "**/docs/_md_inventory/**": true
  },
  "files.exclude": {
    "**/docs/archive/**": true
  }
}
"@
[System.IO.File]::WriteAllText($path, $json)
Write-Host "Wrote $path"
