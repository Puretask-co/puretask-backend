# 🪟 Windows Setup Guide

Windows-specific instructions for setting up PureTask Backend on Railway.

---

## 🚀 Quick Start (Windows)

### Option 1: PowerShell Script (Recommended)

```powershell
# Run the PowerShell setup script
.\scripts\setup-staging.ps1
```

### Option 2: Railway Dashboard (Easiest - No CLI Needed)

1. **Go to Railway**: https://railway.app
2. **Create Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Connect Repository**: Select your `puretask-backend` repository
4. **Add Database**: Click "New" → "Database" → "Add Neon"
5. **Set Variables**: Go to Variables tab and add all required variables
6. **Deploy**: Railway will auto-deploy on git push

### Option 3: Railway CLI (If Installed)

```powershell
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Set variables
railway variables set DATABASE_URL="..." --environment staging

# Deploy
railway up --environment staging
```

---

## 📋 Step-by-Step Setup (Windows)

### Step 1: Install Railway CLI (Optional)

```powershell
npm install -g @railway/cli
railway login
```

**Or skip this step** and use Railway Dashboard instead.

### Step 2: Create Neon Database

1. Go to https://console.neon.tech
2. Sign up / Log in
3. Click "Create Project"
4. Name: `puretask-staging`
5. Copy the connection string

### Step 3: Run Database Migrations

**Using Neon SQL Editor (Recommended for Windows):**

1. Open Neon Console → SQL Editor
2. Copy contents of `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
3. Paste in SQL Editor and click "Run"
4. Copy contents of `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
5. Paste and run
6. Copy contents of `docs/FIX_STRIPE_EVENTS_COLUMN.sql`
7. Paste and run

**Using psql (If Installed):**

```powershell
# If you have PostgreSQL installed
$env:DATABASE_URL = "your-connection-string"
psql $env:DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql
```

### Step 4: Set Up Railway Project

**Using Railway Dashboard:**

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect the build settings

**Using Railway CLI:**

```powershell
railway init --name "puretask-backend-staging"
railway link
```

### Step 5: Set Environment Variables

**Generate Secrets:**

```powershell
# Using Node.js (if installed)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator: https://www.random.org/strings/
```

**Set in Railway Dashboard:**

1. Go to Railway Dashboard → Your Project → Variables
2. Add each variable:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Generated 64-char secret |
| `STRIPE_SECRET_KEY` | `sk_test_...` (from Stripe) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from Stripe) |
| `N8N_WEBHOOK_SECRET` | Generated 32-char secret |
| `NODE_ENV` | `staging` |
| `BOOKINGS_ENABLED` | `true` |
| `PAYOUTS_ENABLED` | `false` |
| `CREDITS_ENABLED` | `true` |
| `REFUNDS_ENABLED` | `true` |
| `WORKERS_ENABLED` | `true` |

**Or using Railway CLI:**

```powershell
railway variables set "DATABASE_URL=postgresql://..." --environment staging
railway variables set "JWT_SECRET=your-secret" --environment staging
# ... (repeat for each variable)
```

### Step 6: Configure Stripe

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.railway.app/stripe/webhook`
4. Select events (see `docs/DEPLOYMENT_CHECKLIST.md`)
5. Copy webhook secret
6. Add to Railway variables: `STRIPE_WEBHOOK_SECRET`

### Step 7: Deploy

**Using Railway Dashboard:**
- Push to GitHub → Railway auto-deploys
- Or click "Deploy" in Railway dashboard

**Using Railway CLI:**
```powershell
railway up --environment staging
```

---

## 🔧 Windows-Specific Notes

### PowerShell Scripts

The PowerShell script (`setup-staging.ps1`) handles Windows-specific issues:
- Uses Node.js for secret generation (if openssl not available)
- Provides clear instructions for Neon SQL Editor
- Handles Railway CLI installation check

### Running Bash Scripts on Windows

If you prefer bash scripts:

1. **Git Bash** (Recommended):
   ```bash
   # Install Git for Windows (includes Git Bash)
   # Then run:
   ./scripts/setup-staging.sh
   ```

2. **WSL** (Windows Subsystem for Linux):
   ```bash
   wsl
   ./scripts/setup-staging.sh
   ```

3. **PowerShell** (Use PowerShell script instead):
   ```powershell
   .\scripts\setup-staging.ps1
   ```

### Database Migrations on Windows

**Recommended**: Use Neon SQL Editor (web-based, no installation needed)

**Alternative**: Install PostgreSQL for Windows:
1. Download from https://www.postgresql.org/download/windows/
2. Install PostgreSQL
3. Use `psql` from command prompt

---

## ✅ Verification

### Check Deployment

```powershell
# Get deployment URL
railway domain --environment staging

# Or check in Railway dashboard
# Test health endpoint
curl https://your-app.railway.app/health
```

### View Logs

```powershell
railway logs --environment staging
```

### Run Tests

```powershell
# Set staging URL
$env:STAGING_URL = "https://your-app.railway.app"

# Run smoke tests
npm run test:smoke
```

---

## 🛠️ Troubleshooting

### Railway CLI Not Found

```powershell
# Install globally
npm install -g @railway/cli

# Verify installation
railway --version
```

### PowerShell Execution Policy

If script won't run:

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow script execution (for current session)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Or run with bypass
powershell -ExecutionPolicy Bypass -File .\scripts\setup-staging.ps1
```

### Database Connection Issues

1. Verify `DATABASE_URL` includes `?sslmode=require`
2. Check Neon console for connection limits
3. Verify database is accessible from your IP

### Build Failures

1. Check Railway build logs
2. Verify `railway.toml` and `nixpacks.toml` are in repo
3. Check Node.js version (requires 20+)

---

## 📚 Next Steps

1. **Complete Setup**: Follow steps above
2. **Test Deployment**: Verify health endpoint
3. **Schedule Workers**: See `docs/WORKER_SCHEDULE.md`
4. **Monitor**: Set up error tracking

---

**Last Updated**: 2025-01-15  
**Platform**: Windows 10/11  
**Status**: Ready ✅

