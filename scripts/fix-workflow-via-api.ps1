# PowerShell script to fix frontend workflow via GitHub API
# This attempts to modify the workflow file via GitHub API

param(
    [string]$Repo = "PURETASK/puretask-clean-with-confidence",
    [string]$Branch = "main",
    [string]$WorkflowPath = ".github/workflows/audit-autofix.yml"
)

Write-Host "=== Fix Frontend Workflow via GitHub API ===" -ForegroundColor Cyan

# Check if workflow file exists
Write-Host "Checking if workflow file exists..." -ForegroundColor Cyan
try {
    $fileInfo = gh api "repos/$Repo/contents/$WorkflowPath" --jq '{sha: .sha, content: .content}' 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Workflow file not found or not accessible" -ForegroundColor Red
        Write-Host "Error: $fileInfo" -ForegroundColor Yellow
        Write-Host "`nManual fix required:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://github.com/$Repo/blob/$Branch/$WorkflowPath" -ForegroundColor White
        Write-Host "2. Click 'Edit' (pencil icon)" -ForegroundColor White
        Write-Host "3. Add 'workflow_dispatch:' under 'on:' section" -ForegroundColor White
        Write-Host "4. Commit and push" -ForegroundColor White
        exit 1
    }
    
    $fileData = $fileInfo | ConvertFrom-Json
    Write-Host "✓ Workflow file found" -ForegroundColor Green
    
    # Decode base64 content
    $contentBytes = [System.Convert]::FromBase64String($fileData.content)
    $content = [System.Text.Encoding]::UTF8.GetString($contentBytes)
    
    # Check if workflow_dispatch already exists
    if ($content -match "workflow_dispatch") {
        Write-Host "✓ workflow_dispatch already exists in workflow" -ForegroundColor Green
        Write-Host "Workflow is ready to use!" -ForegroundColor Green
        exit 0
    }
    
    # Add workflow_dispatch
    Write-Host "`nAttempting to add workflow_dispatch..." -ForegroundColor Cyan
    
    # Find the on: section and add workflow_dispatch
    $lines = $content -split "`n"
    $newLines = @()
    $onFound = $false
    $added = $false
    
    foreach ($line in $lines) {
        if ($line -match "^\s*on:\s*$" -or $line -match "^\s*on:\s*#") {
            $onFound = $true
            $newLines += $line
            $newLines += "  workflow_dispatch:"
            $added = $true
            continue
        }
        
        # If we hit another top-level key after on: section, stop
        if ($onFound -and -not $added -and $line -match "^\s*[a-zA-Z]" -and $line -notmatch "^\s+") {
            $newLines += "  workflow_dispatch:"
            $newLines += $line
            $added = $true
            continue
        }
        
        $newLines += $line
    }
    
    if (-not $added) {
        Write-Host "✗ Could not automatically determine where to add workflow_dispatch" -ForegroundColor Red
        Write-Host "`nManual fix required (see instructions above)" -ForegroundColor Yellow
        exit 1
    }
    
    $newContent = ($newLines -join "`n") + "`n"
    
    # Encode to base64
    $contentBytes = [System.Text.Encoding]::UTF8.GetBytes($newContent)
    $encodedContent = [System.Convert]::ToBase64String($contentBytes)
    
    # Prepare commit message
    $commitMessage = "Add workflow_dispatch trigger to audit workflow"
    
    # Create commit via API
    Write-Host "`nCreating commit..." -ForegroundColor Cyan
    $commitBody = @{
        message = $commitMessage
        content = $encodedContent
        sha = $fileData.sha
        branch = $Branch
    } | ConvertTo-Json
    
    try {
        $result = gh api "repos/$Repo/contents/$WorkflowPath" -X PUT -f "message=$commitMessage" -f "content=$encodedContent" -f "sha=$($fileData.sha)" -f "branch=$Branch" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Workflow updated successfully!" -ForegroundColor Green
            Write-Host "You can now dispatch the workflow manually" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to update workflow: $result" -ForegroundColor Red
            Write-Host "`nManual fix required (see instructions above)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ Error updating workflow: $_" -ForegroundColor Red
        Write-Host "`nManual fix required (see instructions above)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    Write-Host "`nManual fix required:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/$Repo/blob/$Branch/$WorkflowPath" -ForegroundColor White
    Write-Host "2. Click 'Edit' (pencil icon)" -ForegroundColor White
    Write-Host "3. Add 'workflow_dispatch:' under 'on:' section" -ForegroundColor White
    Write-Host "4. Commit and push" -ForegroundColor White
    exit 1
}

