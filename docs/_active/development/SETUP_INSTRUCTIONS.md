# 🚀 Setup Instructions - Choose Your Path

You're on Windows. Here are your options for setting up the staging environment:

---

## ✅ Option 1: Railway Dashboard (Easiest - Recommended)

**No CLI needed!** Use the web interface.

### Quick Steps:

1. **Go to Railway**: https://railway.app
2. **Sign up / Log in**
3. **Create Project**: 
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your `puretask-backend` repository
4. **Add Database**:
   - Click "New" → "Database" → "Add Neon"
   - Or create manually at https://console.neon.tech
5. **Set Environment Variables**:
   - Go to Variables tab
   - Add all required variables (see below)
6. **Deploy**: Railway auto-deploys on git push!

**Full guide**: See `docs/RAILWAY_SETUP.md`

---

## ✅ Option 2: Railway CLI (Just Installed!)

Railway CLI is now installed. You can use it:

### Quick Start:

```powershell
# 1. Login to Railway
railway login

# 2. Create project
railway init --name "puretask-backend-staging"

# 3. Set environment variables
railway variables set "DATABASE_URL=postgresql://..." --environment staging
railway variables set "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" --environment staging

# 4. Deploy
railway up --environment staging
```

**Full guide**: See `docs/RAILWAY_SETUP.md`

---

## ✅ Option 3: PowerShell Script

Run the interactive setup script:

```powershell
# Make sure execution policy allows scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Run setup script
.\scripts\setup-staging.ps1
```

---

## 📋 Required Environment Variables

You'll need to set these in Railway (Dashboard or CLI):

### Required:

1. **DATABASE_URL** - From Neon database
2. **JWT_SECRET** - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **STRIPE_SECRET_KEY** - From Stripe dashboard (`sk_test_...`)
4. **STRIPE_WEBHOOK_SECRET** - From Stripe webhook (`whsec_...`)
5. **N8N_WEBHOOK_SECRET** - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Recommended:

- `NODE_ENV=staging`
- `BOOKINGS_ENABLED=true`
- `PAYOUTS_ENABLED=false`
- `CREDITS_ENABLED=true`
- `REFUNDS_ENABLED=true`
- `WORKERS_ENABLED=true`

---

## 🎯 Recommended: Start with Railway Dashboard

**Easiest path for first-time setup:**

1. Go to https://railway.app
2. Create project from GitHub
3. Add Neon database
4. Set variables in dashboard
5. Deploy!

**See**: `docs/DEPLOYMENT_QUICK_START.md` for detailed steps

---

## 📚 Documentation

- **Quick Start**: `docs/DEPLOYMENT_QUICK_START.md` - 20-30 min guide
- **Railway Setup**: `docs/RAILWAY_SETUP.md` - Complete Railway guide
- **Windows Setup**: `docs/WINDOWS_SETUP.md` - Windows-specific notes
- **Staging Guide**: `docs/STAGING_ENVIRONMENT.md` - Staging management

---

**Ready to start?** Choose Option 1 (Dashboard) for the easiest setup!

