# Secure Railway Environment Variable Setup
# Prompts for sensitive values without displaying them

Write-Host "=== Railway Environment Variable Setup ===" -ForegroundColor Cyan
Write-Host "This script will securely set your environment variables in Railway" -ForegroundColor Yellow
Write-Host "Values will NOT be displayed on screen" -ForegroundColor Green
Write-Host ""

# Check if Railway CLI is logged in
Write-Host "Checking Railway CLI..." -ForegroundColor Cyan
try {
    $whoami = railway whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Not logged into Railway CLI" -ForegroundColor Red
        Write-Host "Run: railway login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Logged in as: $whoami" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found" -ForegroundColor Red
    Write-Host "Install: npm install -g @railway/cli" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Confirm project
Write-Host "Current Railway Project:" -ForegroundColor Cyan
railway status
Write-Host ""
$confirm = Read-Host "Is this correct? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Exiting. Run 'railway link' to link correct project" -ForegroundColor Yellow
    exit 0
}
Write-Host ""

# Set non-sensitive variables first (visible)
Write-Host "=== Setting Non-Sensitive Variables ===" -ForegroundColor Cyan
Write-Host "These will be visible on screen" -ForegroundColor Gray
Write-Host ""

$nonSensitive = @{
    "NODE_ENV" = "production"
    "JWT_EXPIRES_IN" = "30d"
    "BCRYPT_SALT_ROUNDS" = "10"
    "BOOKINGS_ENABLED" = "true"
    "PAYOUTS_ENABLED" = "false"
    "CREDITS_ENABLED" = "true"
    "WORKERS_ENABLED" = "true"
    "USE_EVENT_BASED_NOTIFICATIONS" = "true"
    "PAYOUT_CURRENCY" = "usd"
    "CENTS_PER_CREDIT" = "10"
    "PLATFORM_FEE_PERCENT" = "15"
    "SENDGRID_FROM_EMAIL" = "no-reply@puretask.com"
}

foreach ($key in $nonSensitive.Keys) {
    $value = $nonSensitive[$key]
    Write-Host "Setting $key = $value" -ForegroundColor Gray
    railway variables set "$key=$value" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed" -ForegroundColor Red
    }
}
Write-Host ""

# Now prompt for sensitive variables (hidden)
Write-Host "=== Setting Sensitive Variables ===" -ForegroundColor Cyan
Write-Host "Values will be HIDDEN as you type" -ForegroundColor Yellow
Write-Host ""

# Function to securely read and set variable
function Set-SecureVariable {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Required = $true,
        [string]$Example = ""
    )
    
    Write-Host "➤ $Name" -ForegroundColor Yellow
    if ($Description) {
        Write-Host "  $Description" -ForegroundColor Gray
    }
    if ($Example) {
        Write-Host "  Example: $Example" -ForegroundColor DarkGray
    }
    
    if (-not $Required) {
        $skip = Read-Host "  Skip this variable? (y/n)"
        if ($skip -eq "y") {
            Write-Host "  ⏭️  Skipped" -ForegroundColor Yellow
            return
        }
    }
    
    $secure = Read-Host "  Enter value (hidden)" -AsSecureString
    $value = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "  ⚠️  Empty value, skipping" -ForegroundColor Yellow
        return
    }
    
    railway variables set "$Name=$value" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Set successfully" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed to set" -ForegroundColor Red
    }
    Write-Host ""
}

# JWT Secret (auto-generated option)
Write-Host "➤ JWT_SECRET" -ForegroundColor Yellow
Write-Host "  Signs authentication tokens" -ForegroundColor Gray
$generateJWT = Read-Host "  Generate secure random JWT_SECRET? (y/n)"
if ($generateJWT -eq "y") {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    $jwt = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    railway variables set "JWT_SECRET=$jwt" | Out-Null
    Write-Host "  ✅ Generated and set" -ForegroundColor Green
} else {
    Set-SecureVariable -Name "JWT_SECRET" -Description "Your custom JWT secret (min 32 chars)" -Required $true
}
Write-Host ""

# Database URL
Set-SecureVariable `
    -Name "DATABASE_URL" `
    -Description "Railway Postgres connection string (from Postgres service Variables tab)" `
    -Example "postgresql://postgres:password@host:5432/railway?sslmode=require" `
    -Required $true

# Stripe
Set-SecureVariable `
    -Name "STRIPE_SECRET_KEY" `
    -Description "From https://dashboard.stripe.com/apikeys" `
    -Example "sk_test_... or sk_live_..." `
    -Required $true

Set-SecureVariable `
    -Name "STRIPE_WEBHOOK_SECRET" `
    -Description "From https://dashboard.stripe.com/webhooks" `
    -Example "whsec_..." `
    -Required $true

# n8n
Set-SecureVariable `
    -Name "N8N_WEBHOOK_URL" `
    -Description "Your n8n webhook endpoint URL" `
    -Example "https://your-n8n.app.n8n.cloud/webhook/puretask-communications" `
    -Required $false

Set-SecureVariable `
    -Name "N8N_WEBHOOK_SECRET" `
    -Description "Secret for n8n webhook authentication" `
    -Example "Any secure random string" `
    -Required $false

# SendGrid
Set-SecureVariable `
    -Name "SENDGRID_API_KEY" `
    -Description "From https://app.sendgrid.com/settings/api_keys" `
    -Example "SG...." `
    -Required $false

# Twilio (Optional)
Write-Host "=== Twilio SMS (Optional) ===" -ForegroundColor Cyan
$setupTwilio = Read-Host "Set up Twilio for SMS? (y/n)"
if ($setupTwilio -eq "y") {
    Set-SecureVariable `
        -Name "TWILIO_ACCOUNT_SID" `
        -Description "From https://console.twilio.com" `
        -Example "AC..." `
        -Required $false

    Set-SecureVariable `
        -Name "TWILIO_AUTH_TOKEN" `
        -Description "From https://console.twilio.com" `
        -Required $false

    $twilioPhone = Read-Host "  Twilio Phone Number (e.g., +1234567890)"
    if (-not [string]::IsNullOrWhiteSpace($twilioPhone)) {
        railway variables set "TWILIO_FROM_NUMBER=$twilioPhone" | Out-Null
        Write-Host "  ✅ Set" -ForegroundColor Green
    }
}
Write-Host ""

# Complete
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "✅ Environment variables have been set in Railway" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check Railway dashboard for deployment status" -ForegroundColor White
Write-Host "2. Wait for service to redeploy (~2-3 minutes)" -ForegroundColor White
Write-Host "3. Test deployment: .\test-railway-deployment.ps1 -RailwayUrl 'https://your-url.up.railway.app'" -ForegroundColor White
Write-Host ""
Write-Host "To view all variables:" -ForegroundColor Gray
Write-Host "  railway variables" -ForegroundColor White
Write-Host ""

