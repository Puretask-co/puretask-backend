# Setup pre-commit hooks for secret scanning (PowerShell)

Write-Host "Setting up pre-commit hooks..." -ForegroundColor Cyan

# Create .git/hooks directory if it doesn't exist
if (-not (Test-Path ".git\hooks")) {
    New-Item -ItemType Directory -Path ".git\hooks" -Force | Out-Null
}

# Copy pre-commit script
if (Test-Path "scripts\pre-commit-secret-scan.ps1") {
    Copy-Item "scripts\pre-commit-secret-scan.ps1" ".git\hooks\pre-commit.ps1" -Force
    
    # Create wrapper script for git (bash script that calls PowerShell)
    $wrapperContent = "#!/bin/sh`npowershell.exe -ExecutionPolicy Bypass -File .git/hooks/pre-commit.ps1`n"
    $hookPath = Join-Path $PWD ".git\hooks\pre-commit"
    [System.IO.File]::WriteAllText($hookPath, $wrapperContent)
    
    Write-Host "Pre-commit hook installed" -ForegroundColor Green
} else {
    Write-Host "Pre-commit script not found" -ForegroundColor Red
    exit 1
}

Write-Host "Pre-commit hooks configured" -ForegroundColor Green
Write-Host ""
Write-Host "The hook will now scan for secrets before each commit." -ForegroundColor Cyan
Write-Host "To bypass (NOT RECOMMENDED): git commit --no-verify" -ForegroundColor Yellow
