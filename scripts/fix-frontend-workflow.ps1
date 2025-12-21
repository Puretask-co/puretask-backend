# PowerShell script to fix frontend workflow (add workflow_dispatch)
# This script attempts to modify the workflow file via GitHub API

param(
    [string]$Repo = "PURETASK/puretask-clean-with-confidence",
    [string]$Branch = "main",
    [string]$WorkflowPath = ".github/workflows/audit-autofix.yml"
)

Write-Host "=== Fix Frontend Workflow ===" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Yellow
Write-Host "Workflow: $WorkflowPath" -ForegroundColor Yellow

# Check if GitHub CLI is available
try {
    $ghVersion = gh --version 2>&1
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

# Get current workflow content
Write-Host "`nFetching current workflow file..." -ForegroundColor Cyan
try {
    $workflowContent = gh api "repos/$Repo/contents/$WorkflowPath" --jq '.content' | ConvertFrom-Base64
    Write-Host "✓ Workflow file retrieved" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to retrieve workflow file: $_" -ForegroundColor Red
    Write-Host "`nManual fix required:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/$Repo/blob/$Branch/$WorkflowPath" -ForegroundColor White
    Write-Host "2. Click 'Edit' (pencil icon)" -ForegroundColor White
    Write-Host "3. Add 'workflow_dispatch:' under 'on:' section" -ForegroundColor White
    Write-Host "4. Commit directly to main (or create PR)" -ForegroundColor White
    exit 1
}

# Check if workflow_dispatch already exists
if ($workflowContent -match "workflow_dispatch") {
    Write-Host "✓ workflow_dispatch already exists in workflow" -ForegroundColor Green
    Write-Host "Workflow is ready to use!" -ForegroundColor Green
    exit 0
}

# Add workflow_dispatch to on: section
Write-Host "`nAdding workflow_dispatch trigger..." -ForegroundColor Cyan

# Simple regex-based replacement (may need adjustment based on actual file format)
$lines = $workflowContent -split "`n"
$newLines = @()
$onSectionFound = $false
$workflowDispatchAdded = $false

foreach ($line in $lines) {
    $newLines += $line
    
    # Check if we're in the on: section
    if ($line -match "^\s*on:\s*$") {
        $onSectionFound = $true
        continue
    }
    
    # After on: section starts, check for existing triggers
    if ($onSectionFound -and -not $workflowDispatchAdded) {
        # If we hit another top-level key or empty line after on: section, add workflow_dispatch before it
        if ($line -match "^\s*[a-zA-Z]" -and $line -notmatch "^\s+") {
            $newLines[-1] = "  workflow_dispatch:"
            $newLines += $line
            $workflowDispatchAdded = $true
            continue
        }
        
        # If we find push: or other triggers, add workflow_dispatch before
        if ($line -match "^\s+(push|pull_request|schedule|workflow_call):") {
            $newLines = $newLines[0..($newLines.Length-2)]
            $newLines += "  workflow_dispatch:"
            $newLines += $line
            $workflowDispatchAdded = $true
            continue
        }
    }
}

if (-not $workflowDispatchAdded) {
    Write-Host "✗ Could not automatically add workflow_dispatch. Manual fix required." -ForegroundColor Red
    Write-Host "`nManual fix required:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/$Repo/blob/$Branch/$WorkflowPath" -ForegroundColor White
    Write-Host "2. Click 'Edit' (pencil icon)" -ForegroundColor White
    Write-Host "3. Under 'on:' section, add: 'workflow_dispatch:'" -ForegroundColor White
    Write-Host "4. Commit directly to main (or create PR)" -ForegroundColor White
    exit 1
}

$newContent = $newLines -join "`n"

# For now, we'll output the instructions since updating via API requires base64 encoding and SHA
Write-Host "`n=== Manual Fix Required ===" -ForegroundColor Yellow
Write-Host "The script detected that workflow_dispatch needs to be added." -ForegroundColor White
Write-Host "`nPlease manually edit the file:" -ForegroundColor White
Write-Host "1. Go to: https://github.com/$Repo/blob/$Branch/$WorkflowPath" -ForegroundColor Cyan
Write-Host "2. Click 'Edit' (pencil icon)" -ForegroundColor Cyan
Write-Host "3. Add 'workflow_dispatch:' under 'on:' section:" -ForegroundColor Cyan
Write-Host "`n   on:" -ForegroundColor Gray
Write-Host "     workflow_dispatch:  # ← ADD THIS LINE" -ForegroundColor Green
Write-Host "     push:" -ForegroundColor Gray
Write-Host "       branches: [main]" -ForegroundColor Gray
Write-Host "`n4. Commit directly to main (or create PR)" -ForegroundColor Cyan

Write-Host "`n=== Alternative: Use GitHub CLI to create PR ===" -ForegroundColor Yellow
Write-Host "You can also create a branch and PR:" -ForegroundColor White
Write-Host "  cd ../puretask-clean-with-confidence" -ForegroundColor Gray
Write-Host "  git checkout -b fix/add-workflow-dispatch" -ForegroundColor Gray
Write-Host "  # Edit .github/workflows/audit-autofix.yml" -ForegroundColor Gray
Write-Host "  git add .github/workflows/audit-autofix.yml" -ForegroundColor Gray
Write-Host "  git commit -m 'Add workflow_dispatch trigger to audit workflow'" -ForegroundColor Gray
Write-Host "  git push origin fix/add-workflow-dispatch" -ForegroundColor Gray
Write-Host "  gh pr create --title 'Add workflow_dispatch trigger' --body 'Enables manual workflow dispatch'" -ForegroundColor Gray

exit 0

