# PowerShell script to dispatch and monitor audit workflow

param(
    [string]$Repo = "PURETASK/puretask-clean-with-confidence",
    [string]$WorkflowFile = "audit-autofix.yml",
    [string]$OutputDir = "audit-results"
)

Write-Host "=== PureTask Security Audit Workflow ===" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Yellow
Write-Host "Workflow: $WorkflowFile" -ForegroundColor Yellow

# Check if GitHub CLI is available
try {
    $null = gh --version 2>&1
    Write-Host "✓ GitHub CLI found" -ForegroundColor Green
} catch {
    Write-Host "✗ GitHub CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "  winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# Check authentication
Write-Host "`nChecking authentication..." -ForegroundColor Cyan
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Not authenticated. Please run: gh auth login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Authenticated" -ForegroundColor Green

# Dispatch workflow
Write-Host "`nDispatching workflow..." -ForegroundColor Cyan
try {
    gh workflow run $WorkflowFile --repo $Repo --ref main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Workflow dispatched successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to dispatch workflow" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error dispatching workflow: $_" -ForegroundColor Red
    Write-Host "`nMake sure workflow_dispatch trigger is added to the workflow file." -ForegroundColor Yellow
    Write-Host "Run: .\scripts\fix-frontend-workflow.ps1" -ForegroundColor Yellow
    exit 1
}

# Wait a bit for workflow to start
Write-Host "`nWaiting for workflow to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Get the latest run
Write-Host "Finding workflow run..." -ForegroundColor Cyan
$runs = gh run list --workflow $WorkflowFile --repo $Repo --limit 1 --json databaseId,status,conclusion,createdAt
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to list workflow runs" -ForegroundColor Red
    exit 1
}

$run = $runs | ConvertFrom-Json | Select-Object -First 1
if (-not $run) {
    Write-Host "✗ No workflow runs found" -ForegroundColor Red
    exit 1
}

$runId = $run.databaseId
Write-Host "✓ Found run: $runId" -ForegroundColor Green
Write-Host "  Status: $($run.status)" -ForegroundColor Yellow
Write-Host "  Created: $($run.createdAt)" -ForegroundColor Yellow

# Monitor workflow
Write-Host "`nMonitoring workflow execution..." -ForegroundColor Cyan
$maxWait = 300 # 5 minutes
$elapsed = 0
$checkInterval = 10

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds $checkInterval
    $elapsed += $checkInterval
    
    $currentRun = gh run view $runId --repo $Repo --json status,conclusion 2>&1 | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Error checking run status" -ForegroundColor Red
        break
    }
    
    Write-Host "  Status: $($currentRun.status)..." -ForegroundColor Gray
    
    if ($currentRun.status -eq "completed") {
        Write-Host "✓ Workflow completed: $($currentRun.conclusion)" -ForegroundColor $(if ($currentRun.conclusion -eq "success") { "Green" } else { "Yellow" })
        break
    }
}

if ($currentRun.conclusion -ne "success") {
    Write-Host "`n⚠ Workflow did not complete successfully" -ForegroundColor Yellow
    Write-Host "View logs: gh run view $runId --repo $Repo --log" -ForegroundColor Cyan
}

# Download artifacts
if ($currentRun.conclusion -eq "success") {
    Write-Host "`nDownloading artifacts..." -ForegroundColor Cyan
    
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir | Out-Null
    }
    
    Set-Location $OutputDir
    
    try {
        gh run download $runId --repo $Repo
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Artifacts downloaded to $OutputDir" -ForegroundColor Green
            
            # List downloaded files
            Write-Host "`nDownloaded files:" -ForegroundColor Cyan
            Get-ChildItem -Recurse | ForEach-Object {
                Write-Host "  $($_.FullName)" -ForegroundColor Gray
            }
            
            # Check for audit.json and triage.json
            $auditJson = Get-ChildItem -Recurse -Filter "audit.json" | Select-Object -First 1
            $triageJson = Get-ChildItem -Recurse -Filter "triage.json" | Select-Object -First 1
            
            if ($auditJson) {
                Write-Host "`n✓ Found audit.json" -ForegroundColor Green
            }
            if ($triageJson) {
                Write-Host "✓ Found triage.json" -ForegroundColor Green
            }
        } else {
            Write-Host "✗ Failed to download artifacts" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Error downloading artifacts: $_" -ForegroundColor Red
    } finally {
        Set-Location ..
    }
} else {
    Write-Host "`nSkipping artifact download (workflow did not succeed)" -ForegroundColor Yellow
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Run ID: $runId" -ForegroundColor White
Write-Host "Status: $($currentRun.status)" -ForegroundColor White
Write-Host "Conclusion: $($currentRun.conclusion)" -ForegroundColor White
Write-Host "`nView run: gh run view $runId --repo $Repo" -ForegroundColor Cyan
Write-Host "View logs: gh run view $runId --repo $Repo --log" -ForegroundColor Cyan
if ($currentRun.conclusion -eq "success") {
    Write-Host "Artifacts: $OutputDir\" -ForegroundColor Cyan
}

