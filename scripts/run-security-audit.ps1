# Security Audit Workflow Dispatch Script
# This script dispatches the security audit workflow for the frontend repository

Write-Host "=== Security Audit Workflow Dispatch ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check authentication
Write-Host "Step 1: Checking GitHub CLI authentication..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated. Please run: gh auth login" -ForegroundColor Red
    Write-Host ""
    Write-Host "Starting authentication process..." -ForegroundColor Yellow
    gh auth login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Authentication failed. Please try again." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Authenticated" -ForegroundColor Green
}

Write-Host ""

# Step 2: Dispatch workflow
Write-Host "Step 2: Dispatching 'Audit Auto-Fix & Triage' workflow..." -ForegroundColor Yellow
$repo = "PURETASK/puretask-clean-with-confidence"
$workflow = "Audit Auto-Fix & Triage"

gh workflow run "$workflow" --repo $repo --ref main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Workflow dispatched successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Wait a moment and check status
    Write-Host "Step 3: Waiting 5 seconds for workflow to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Step 4: List recent runs
    Write-Host ""
    Write-Host "Step 4: Recent workflow runs:" -ForegroundColor Yellow
    gh run list --workflow "$workflow" --repo $repo --limit 5
    
    Write-Host ""
    Write-Host "=== Next Steps ===" -ForegroundColor Cyan
    Write-Host "1. Wait for the workflow to complete (check status above)"
    Write-Host "2. Download artifacts with: gh run download <run-id> --repo $repo"
    Write-Host "3. View logs with: gh run view <run-id> --repo $repo --log"
    Write-Host ""
    Write-Host "Or visit: https://github.com/$repo/actions" -ForegroundColor Cyan
    
} else {
    Write-Host "❌ Failed to dispatch workflow" -ForegroundColor Red
    Write-Host "Error: $($LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

