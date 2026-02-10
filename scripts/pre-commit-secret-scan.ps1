# Pre-commit hook for secret scanning (PowerShell version)
# This script scans staged files for potential secrets before allowing commit

$ErrorActionPreference = "Stop"

Write-Host "Running pre-commit secret scan..." -ForegroundColor Cyan

$foundSecrets = $false

# Get list of staged files
$stagedFiles = git diff --cached --name-only --diff-filter=ACM

if (-not $stagedFiles) {
    Write-Host "No files staged, skipping secret scan" -ForegroundColor Green
    exit 0
}

# Patterns to detect (common secret formats)
$patterns = @(
    "sk_live_[a-zA-Z0-9]{24,}",           # Stripe live keys
    "sk_test_[a-zA-Z0-9]{24,}",           # Stripe test keys
    "whsec_[a-zA-Z0-9]{32,}",             # Stripe webhook secrets
    "SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}",  # SendGrid API keys
    "AC[a-z0-9]{32}",                     # Twilio Account SID
    "sk-[a-zA-Z0-9]{32,}",                # OpenAI API keys
    "AIza[0-9A-Za-z\-_]{35}",            # Google API keys
    "ya29\.[0-9A-Za-z\-_]+"              # Google OAuth tokens
)

# Secret variable names
$secretVars = @(
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "N8N_WEBHOOK_SECRET",
    "SENDGRID_API_KEY",
    "TWILIO_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "GOOGLE_CLIENT_SECRET",
    "FACEBOOK_APP_SECRET"
)

foreach ($file in $stagedFiles) {
    # Skip if file doesn't exist (deleted)
    if (-not (Test-Path $file)) {
        continue
    }
    
    # Skip node_modules, dist, .git
    if ($file -match "node_modules|dist|\.git") {
        continue
    }
    
    # Skip .env.example (allowed)
    if ($file -match "\.env\.example") {
        continue
    }
    
    # Skip all documentation files (may contain examples)
    if ($file -match "^docs/") {
        continue
    }
    
    # Skip package-lock.json (contains hashes that look like secrets)
    if ($file -match "package-lock\.json") {
        continue
    }
    
    # Skip test.env files (test environment files)
    if ($file -match "test\.env|\.test\.env") {
        continue
    }
    
    # Check for .env files (should never be committed)
    if ($file -match "\.env" -and $file -notmatch "\.env\.example") {
        Write-Host "ERROR: .env file detected: $file" -ForegroundColor Red
        Write-Host "   .env files should never be committed!" -ForegroundColor Red
        $foundSecrets = $true
        continue
    }
    
    # Get staged content
    $content = git show ":$file" 2>$null
    
    if (-not $content) {
        continue
    }
    
    # Check for secret patterns
    foreach ($pattern in $patterns) {
        $matches = $content | Select-String -Pattern $pattern | Where-Object {
            $_.Line -notmatch "YOUR_|REPLACE|example|placeholder"
        }
        
        if ($matches) {
            Write-Host "Potential secret detected in: $file" -ForegroundColor Red
            Write-Host "   Pattern: $pattern" -ForegroundColor Yellow
            $matches | Select-Object -First 5 | ForEach-Object { Write-Host "   $($_.Line)" -ForegroundColor Red }
            $foundSecrets = $true
        }
    }
    
    # Check for secret variable names with actual values
    foreach ($var in $secretVars) {
        $matches = $content | Select-String -Pattern "^$var=[^=YOURREPLACEexampleplaceholder]" | Where-Object {
            $_.Line -notmatch "^\s*#"
        }
        
        if ($matches) {
            Write-Host "Potential secret variable with value in: $file" -ForegroundColor Red
            $matches | Select-Object -First 5 | ForEach-Object { Write-Host "   $($_.Line)" -ForegroundColor Red }
            $foundSecrets = $true
        }
    }
}

if ($foundSecrets) {
    Write-Host ""
    Write-Host "Secret scan failed!" -ForegroundColor Red
    Write-Host "Please remove secrets before committing." -ForegroundColor Yellow
    Write-Host "If this is a false positive, add it to .gitleaks.toml allowlist" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To bypass this check (NOT RECOMMENDED):" -ForegroundColor Yellow
    Write-Host "  git commit --no-verify" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Secret scan passed" -ForegroundColor Green
exit 0
