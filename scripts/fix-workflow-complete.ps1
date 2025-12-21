# Complete script to fix frontend workflow by cloning, editing, and pushing

param(
    [string]$Repo = "PURETASK/puretask-clean-with-confidence",
    [string]$Branch = "main",
    [string]$WorkflowPath = ".github/workflows/audit-autofix.yml",
    [string]$TempDir = "$env:TEMP/puretask-workflow-fix"
)

Write-Host "=== Fix Frontend Workflow (Complete) ===" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Yellow
Write-Host "Branch: $Branch" -ForegroundColor Yellow

# Check GitHub CLI
try {
    $null = gh --version 2>&1
    Write-Host "✓ GitHub CLI found" -ForegroundColor Green
} catch {
    Write-Host "✗ GitHub CLI not found" -ForegroundColor Red
    exit 1
}

# Check authentication
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Not authenticated. Run: gh auth login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Authenticated" -ForegroundColor Green

# Cleanup temp directory
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Clone repository
Write-Host "`nCloning repository..." -ForegroundColor Cyan
Set-Location $TempDir
git clone "https://github.com/$Repo.git" repo 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to clone repository" -ForegroundColor Red
    exit 1
}

Set-Location repo
Write-Host "✓ Repository cloned" -ForegroundColor Green

# Checkout target branch
Write-Host "`nChecking out branch: $Branch" -ForegroundColor Cyan
git checkout $Branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to checkout branch" -ForegroundColor Red
    exit 1
}

# Check if workflow file exists
if (-not (Test-Path $WorkflowPath)) {
    Write-Host "✗ Workflow file not found: $WorkflowPath" -ForegroundColor Red
    Write-Host "Available workflow files:" -ForegroundColor Yellow
    if (Test-Path ".github/workflows") {
        Get-ChildItem ".github/workflows" -Filter "*.yml" | ForEach-Object { Write-Host "  - $($_.Name)" }
    }
    exit 1
}

# Read workflow file
Write-Host "`nReading workflow file..." -ForegroundColor Cyan
$content = Get-Content $WorkflowPath -Raw

# Check if workflow_dispatch already exists
if ($content -match "workflow_dispatch") {
    Write-Host "✓ workflow_dispatch already exists" -ForegroundColor Green
    Write-Host "Workflow is ready to use!" -ForegroundColor Green
    exit 0
}

# Add workflow_dispatch
Write-Host "Adding workflow_dispatch trigger..." -ForegroundColor Cyan

# Split into lines
$lines = $content -split "`n"
$newLines = @()
$added = $false
$inOnSection = $false

foreach ($line in $lines) {
    # Check if we're in the on: section
    if ($line -match "^\s*on:\s*$" -or $line -match "^\s*on:\s*#") {
        $inOnSection = $true
        $newLines += $line
        # Add workflow_dispatch right after on:
        $newLines += "  workflow_dispatch:"
        $added = $true
        continue
    }
    
    # If we hit another top-level key after on: section and haven't added yet
    if ($inOnSection -and -not $added -and $line -match "^\s*[a-zA-Z]" -and $line -notmatch "^\s+") {
        $newLines += "  workflow_dispatch:"
        $newLines += $line
        $added = $true
        $inOnSection = $false
        continue
    }
    
    # If we see push: or other triggers after on:, add workflow_dispatch before it
    if ($inOnSection -and -not $added -and $line -match "^\s+(push|pull_request|schedule|workflow_call):") {
        $newLines += "  workflow_dispatch:"
        $newLines += $line
        $added = $true
        continue
    }
    
    # Check if we're leaving the on: section
    if ($inOnSection -and $line -match "^\s*[a-zA-Z]" -and $line -notmatch "^\s+") {
        $inOnSection = $false
    }
    
    $newLines += $line
}

if (-not $added) {
    Write-Host "✗ Could not automatically add workflow_dispatch" -ForegroundColor Red
    Write-Host "Manual fix required - see docs/WORKFLOW_FIX_AUDIT_AUTOFIX.md" -ForegroundColor Yellow
    exit 1
}

# Write updated content
$newContent = ($newLines -join "`n") + "`n"
Set-Content -Path $WorkflowPath -Value $newContent -NoNewline

Write-Host "✓ workflow_dispatch added to workflow file" -ForegroundColor Green

# Show diff
Write-Host "`nChanges:" -ForegroundColor Cyan
git diff $WorkflowPath | Select-Object -First 20

# Create commit
Write-Host "`nCreating commit..." -ForegroundColor Cyan
git add $WorkflowPath
git commit -m "Add workflow_dispatch trigger to audit workflow" 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to create commit" -ForegroundColor Red
    exit 1
}

# Push to repository
Write-Host "Pushing to repository..." -ForegroundColor Cyan
$pushOutput = git push origin $Branch 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully pushed to $Branch" -ForegroundColor Green
    Write-Host "`nWorkflow is now ready to use!" -ForegroundColor Green
    Write-Host "You can now dispatch it with:" -ForegroundColor Cyan
    Write-Host "  gh workflow run audit-autofix.yml --repo $Repo --ref $Branch" -ForegroundColor White
} else {
    Write-Host "✗ Failed to push: $pushOutput" -ForegroundColor Red
    Write-Host "`nChanges are in: $TempDir/repo" -ForegroundColor Yellow
    Write-Host "You can manually push from there or create a PR" -ForegroundColor Yellow
}

# Cleanup
Set-Location $env:TEMP
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue

