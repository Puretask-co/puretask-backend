# PureTask Backend - Verification Checklist

## 🎯 Goal
Verify all integrations are configured and working:
- ✅ Database (Neon PostgreSQL)
- ✅ SendGrid (email)
- ✅ Twilio (SMS)
- ✅ n8n (event routing)
- ✅ Admin endpoints
- ✅ Auth system

---

## 1️⃣ Basic Server Health

### Test: Server is running
```powershell
Invoke-WebRequest -Uri http://localhost:4000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-24T...",
  "version": "1.0.0"
}
```

✅ **Pass if:** Status 200, returns JSON with "ok"

---

## 2️⃣ Database Connection

### Test: Database health check
```powershell
Invoke-WebRequest -Uri http://localhost:4000/health/ready
```

**Expected Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": "connected"
  }
}
```

✅ **Pass if:** Status 200, database shows "connected"

❌ **Fail if:** 
- Status 503
- "Connection failed" error
- Check `.env` has correct `DATABASE_URL`

---

## 3️⃣ Admin Endpoints (Authorization)

### Test: Admin login
```powershell
$body = @{
    email = "admin@puretask.com"
    password = "your_admin_password"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:4000/api/auth/login -Method POST -Body $body -ContentType "application/json"
$token = ($response.Content | ConvertFrom-Json).token
```

### Test: Access admin endpoint
```powershell
Invoke-WebRequest -Uri http://localhost:4000/api/admin/users -Headers @{Authorization="Bearer $token"}
```

✅ **Pass if:** Returns list of users (without password_hash field)

❌ **Fail if:**
- 401 Unauthorized → check credentials
- 403 Forbidden → user is not admin
- Users contain `password_hash` → SECURITY BUG (should be fixed)

---

## 4️⃣ SendGrid Configuration

### Check: Environment variables
```powershell
Get-Content .env | Select-String "SENDGRID"
```

**Required variables:**
```
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@puretask.com
SENDGRID_FROM_NAME=PureTask

# Template IDs (14 total)
SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxxxx
SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED=d-xxxxx
SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY=d-xxxxx
SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED=d-xxxxx
SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED=d-xxxxx
SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED=d-xxxxx
SENDGRID_TEMPLATE_USER_JOB_CANCELLED=d-xxxxx
SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE=d-xxxxx
SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT=d-xxxxx
SENDGRID_TEMPLATE_USER_WELCOME=d-xxxxx
SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION=d-xxxxx
SENDGRID_TEMPLATE_USER_PASSWORD_RESET=d-xxxxx
```

### Test: Send test email (LEGACY PATH - will be replaced by n8n)

**Option A: Via test endpoint (if exists)**
```powershell
$body = @{
    to = "your-email@example.com"
    templateId = $env:SENDGRID_TEMPLATE_USER_WELCOME
    dynamicData = @{
        first_name = "Test"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/test/email -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
```

**Option B: Check SendGrid dashboard**
- Log in: https://app.sendgrid.com
- Go to Activity → See if test emails appear

✅ **Pass if:** Email arrives in inbox (check spam)

❌ **Fail if:**
- 401 Invalid API key → check `SENDGRID_API_KEY`
- Missing template → check template IDs in SendGrid dashboard

---

## 5️⃣ Twilio Configuration

### Check: Environment variables
```powershell
Get-Content .env | Select-String "TWILIO"
```

**Required variables:**
```
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### Test: Send test SMS (LEGACY PATH - will be replaced by n8n)

```powershell
$body = @{
    to = "+1234567890"
    message = "PureTask test SMS"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/test/sms -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
```

✅ **Pass if:** SMS arrives on phone

❌ **Fail if:**
- 401 Invalid credentials → check Twilio SID/token
- Phone number not verified → verify number in Twilio console (dev mode)

---

## 6️⃣ n8n Integration (Event-Based Notifications)

### Check: n8n configuration
```powershell
Get-Content .env | Select-String "N8N"
```

**Required variables:**
```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/pt-universal-sender
N8N_WEBHOOK_SECRET=your_secret_here
USE_EVENT_BASED_NOTIFICATIONS=true
```

### Check: n8n is running
```powershell
Invoke-WebRequest -Uri http://localhost:5678
```

✅ **Pass if:** n8n login page loads

❌ **Fail if:**
- Connection refused → n8n is not running
- Start n8n: `npx n8n` or Docker command

### Test: Event emission (send notification via n8n)

**Step 1: Book a test job** (this should emit `job.booked` event)
```powershell
$body = @{
    address = "123 Test St"
    date = "2025-12-25"
    duration = 2
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/jobs -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
```

**Step 2: Check n8n executions**
- Open n8n: http://localhost:5678
- Go to: Executions
- Look for: PT-Universal-Sender workflow runs

✅ **Pass if:** 
- Workflow executed
- Email sent via SendGrid
- No errors in execution log

❌ **Fail if:**
- Webhook secret mismatch → check `N8N_WEBHOOK_SECRET` matches in both `.env` and n8n
- Workflow not imported → import `n8n-workflows/PT-Universal-Sender.json`

---

## 7️⃣ Full End-to-End Test

### Scenario: Book a job and verify all notifications

1. **Create cleaner account**
```powershell
$body = @{
    email = "cleaner@test.com"
    password = "Test123!"
    role = "cleaner"
    first_name = "Test"
    last_name = "Cleaner"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/auth/register -Method POST -Body $body -ContentType "application/json"
```

2. **Create client account**
```powershell
$body = @{
    email = "client@test.com"
    password = "Test123!"
    role = "client"
    first_name = "Test"
    last_name = "Client"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/auth/register -Method POST -Body $body -ContentType "application/json"
```

3. **Book a job as client**
```powershell
# Login as client first
$body = @{
    email = "client@test.com"
    password = "Test123!"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:4000/api/auth/login -Method POST -Body $body -ContentType "application/json"
$clientToken = ($response.Content | ConvertFrom-Json).token

# Book job
$body = @{
    address = "123 Test St"
    city = "Los Angeles"
    date = "2025-12-26"
    duration = 2
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/jobs -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $clientToken"}
```

4. **Verify notifications sent**
- Check n8n executions: http://localhost:5678/executions
- Check email inbox (client should receive "job booked" email)
- Check backend logs for event emission

✅ **Pass if:**
- Job created in database
- Event emitted to n8n
- Email sent via SendGrid
- No errors in logs

---

## 🔧 Common Issues & Fixes

### Issue: "npm not recognized"
**Fix:**
```powershell
# Refresh PATH or use full path
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### Issue: Database connection failed
**Fix:**
- Check `DATABASE_URL` in `.env`
- Verify Neon dashboard shows database is active
- Check IP is whitelisted (Neon auto-allows most IPs)

### Issue: SendGrid API key invalid
**Fix:**
- Generate new key: https://app.sendgrid.com/settings/api_keys
- Must have "Mail Send" permission
- Update `.env` with new key

### Issue: n8n webhook not receiving events
**Fix:**
1. Check `USE_EVENT_BASED_NOTIFICATIONS=true` in `.env`
2. Check `N8N_WEBHOOK_URL` matches n8n workflow webhook URL
3. Check `N8N_WEBHOOK_SECRET` matches in both places
4. Restart backend after changing `.env`

### Issue: Admin endpoints return 403
**Fix:**
- Ensure user has `role: "admin"` in database
- Update manually if needed:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 📋 Quick Verification Script

Run all checks at once:

```powershell
# Save this as verify-all.ps1
Write-Host "=== PureTask Verification Script ===" -ForegroundColor Cyan
Write-Host ""

# 1. Health check
Write-Host "1. Checking server health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri http://localhost:4000/health
    Write-Host "   ✅ Server is UP" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Server is DOWN" -ForegroundColor Red
    exit 1
}

# 2. Database check
Write-Host "2. Checking database..." -ForegroundColor Yellow
try {
    $db = Invoke-WebRequest -Uri http://localhost:4000/health/ready
    Write-Host "   ✅ Database connected" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Database connection failed" -ForegroundColor Red
}

# 3. Environment variables
Write-Host "3. Checking environment variables..." -ForegroundColor Yellow
$required = @(
    "DATABASE_URL",
    "SENDGRID_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "N8N_WEBHOOK_URL"
)

foreach ($var in $required) {
    if (Get-Content .env | Select-String $var -Quiet) {
        Write-Host "   ✅ $var found" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $var missing" -ForegroundColor Red
    }
}

# 4. n8n check
Write-Host "4. Checking n8n..." -ForegroundColor Yellow
try {
    $n8n = Invoke-WebRequest -Uri http://localhost:5678 -TimeoutSec 2
    Write-Host "   ✅ n8n is running" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ n8n is not running (start with: npx n8n)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
```

Run with:
```powershell
.\verify-all.ps1
```

---

## ✅ Next Steps After Verification

Once everything passes:

1. **Complete remaining security tasks:**
   - [ ] Protect `/status/summary` endpoint with auth
   - [ ] Replace `SELECT *` with explicit columns in user queries

2. **Set up production environment:**
   - Deploy to hosting (Railway, Heroku, Render, etc.)
   - Set production environment variables
   - Configure production n8n instance

3. **Frontend integration:**
   - Update frontend API calls to use backend endpoints
   - Remove any business logic from frontend
   - Test end-to-end user flows

4. **Monitoring & alerts:**
   - Set up n8n Slack alerts for failed notifications
   - Monitor SendGrid delivery rates
   - Set up error tracking (Sentry, etc.)

---

**Last updated:** 2025-12-24


