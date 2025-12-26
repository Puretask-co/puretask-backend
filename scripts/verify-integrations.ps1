# Quick Verification Script
# Run this to check all PureTask integrations

Write-Host "`n=== 🎯 PureTask Backend Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "1️⃣  Server Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Host "   ✅ Server is UP (port 4000)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Server is DOWN - run: npm run dev" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Check database
Write-Host "2️⃣  Database Connection..." -ForegroundColor Yellow
try {
    $db = Invoke-RestMethod -Uri "http://localhost:4000/health/ready" -TimeoutSec 5
    if ($db.checks.database -eq "connected") {
        Write-Host "   ✅ Database connected (Neon PostgreSQL)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Database connection failed - check DATABASE_URL in .env" -ForegroundColor Red
}

# Check environment variables
Write-Host "3️⃣  Environment Variables..." -ForegroundColor Yellow
$required = @(
    "DATABASE_URL",
    "JWT_SECRET",
    "SENDGRID_API_KEY",
    "SENDGRID_FROM_EMAIL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "N8N_WEBHOOK_URL",
    "N8N_WEBHOOK_SECRET",
    "USE_EVENT_BASED_NOTIFICATIONS"
)

$missing = @()
foreach ($var in $required) {
    if (Get-Content .env -ErrorAction SilentlyContinue | Select-String "^$var=" -Quiet) {
        Write-Host "   ✅ $var" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $var MISSING" -ForegroundColor Red
        $missing += $var
    }
}

# Check SendGrid templates
Write-Host "4️⃣  SendGrid Templates..." -ForegroundColor Yellow
$templates = @(
    "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
    "SENDGRID_TEMPLATE_USER_WELCOME",
    "SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION"
)

$templateMissing = @()
foreach ($template in $templates) {
    if (Get-Content .env -ErrorAction SilentlyContinue | Select-String "^$template=" -Quiet) {
        Write-Host "   ✅ $template" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $template missing" -ForegroundColor Yellow
        $templateMissing += $template
    }
}

# Check n8n
Write-Host "5️⃣  n8n Automation Server..." -ForegroundColor Yellow
try {
    $n8n = Invoke-WebRequest -Uri "http://localhost:5678" -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "   ✅ n8n is running (port 5678)" -ForegroundColor Green
    Write-Host "   → Open dashboard: http://localhost:5678" -ForegroundColor Cyan
} catch {
    Write-Host "   ⚠️  n8n is NOT running" -ForegroundColor Yellow
    Write-Host "   → Start with: npx n8n" -ForegroundColor Cyan
}

# Summary
Write-Host ""
Write-Host "=== 📊 Summary ===" -ForegroundColor Cyan

if ($missing.Count -eq 0) {
    Write-Host "✅ All required environment variables configured" -ForegroundColor Green
} else {
    Write-Host "❌ Missing $($missing.Count) required variables:" -ForegroundColor Red
    foreach ($m in $missing) {
        Write-Host "   - $m" -ForegroundColor Red
    }
}

if ($templateMissing.Count -gt 0) {
    Write-Host "⚠️  Missing $($templateMissing.Count) SendGrid template IDs (optional but recommended)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 🧪 Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Test admin login:" -ForegroundColor White
Write-Host '   $body = @{email="admin@puretask.com"; password="your_password"} | ConvertTo-Json' -ForegroundColor Gray
Write-Host '   $response = Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method POST -Body $body -ContentType "application/json"' -ForegroundColor Gray
Write-Host '   $token = $response.token' -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test admin endpoint:" -ForegroundColor White
Write-Host '   Invoke-RestMethod -Uri http://localhost:4000/api/admin/users -Headers @{Authorization="Bearer $token"}' -ForegroundColor Gray
Write-Host ""
Write-Host "3. For detailed testing, see: VERIFICATION_CHECKLIST.md" -ForegroundColor White
Write-Host ""


