# Remove **/*RUNBOOK*.md from .cursorignore so docs/active/RUNBOOK.md is indexed
$path = Join-Path $PSScriptRoot "..\.cursorignore"
$lines = Get-Content $path -Encoding UTF8
$filtered = $lines | Where-Object { $_ -ne "**/*RUNBOOK*.md" }
$filtered | Set-Content $path -Encoding UTF8
Write-Host "Removed **/*RUNBOOK*.md from .cursorignore"
