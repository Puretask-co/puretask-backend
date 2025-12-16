# 🚀 Deployment Quick Start Guide

Get your PureTask Backend deployed to Railway in under 30 minutes.

---

## ⚡ Prerequisites

1. **Railway Account**: https://railway.app (free tier available)
2. **Neon Database**: https://console.neon.tech (free tier available)
3. **Stripe Account**: https://stripe.com (test mode is free)

---

## 🎯 Three Ways to Deploy

### Option 1: Automated Setup (Easiest) ⭐

```bash
# Run the setup script (works on Mac/Linux/Git Bash)
./scripts/setup-staging.sh
```

This interactive script guides you through everything!

### Option 2: Railway Dashboard (Visual)

1. **Create Project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

2. **Add Database**
   - In Railway dashboard, click "New" → "Database" → "Add Neon"
   - Or create manually at https://console.neon.tech

3. **Set Environment Variables**
   - In Railway dashboard → Variables
   - Add all required variables (see below)

4. **Deploy**
   - Railway auto-deploys on git push
   - Or click "Deploy" in dashboard

### Option 3: Railway CLI (Power Users)

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Set variables
railway variables set DATABASE_URL="..." --environment staging
railway variables set JWT_SECRET="$(openssl rand -hex 32)" --environment staging
# ... (see full list below)

# Deploy
railway up --environment staging
```

---

## 📋 Required Environment Variables

### Quick Copy-Paste (Generate Secrets First)

```bash
# Generate secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For N8N_WEBHOOK_SECRET
```

### Required Variables

| Variable | Example | How to Get |
|----------|---------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | From Neon dashboard |
| `JWT_SECRET` | `a1b2c3d4...` (64 chars) | Generate: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | `sk_test_...` | From Stripe dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From Stripe dashboard → Webhooks |
| `N8N_WEBHOOK_SECRET` | `a1b2c3d4...` (32 chars) | Generate: `openssl rand -hex 32` |

### Recommended Guard Flags

```bash
NODE_ENV=staging
BOOKINGS_ENABLED=true
PAYOUTS_ENABLED=false      # Keep false until tested
CREDITS_ENABLED=true
REFUNDS_ENABLED=true
WORKERS_ENABLED=true
```

---

## 🗄️ Database Setup

### Step 1: Create Neon Database

1. Go to https://console.neon.tech
2. Create new project: "puretask-staging"
3. Copy connection string

### Step 2: Run Migrations

**Option A: Neon SQL Editor (Easiest)**

1. Open Neon Console → SQL Editor
2. Copy contents of `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
3. Paste and run
4. Copy contents of `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
5. Paste and run
6. Copy contents of `docs/FIX_STRIPE_EVENTS_COLUMN.sql`
7. Paste and run

**Option B: Command Line**

```bash
export DATABASE_URL="your-connection-string"
psql "$DATABASE_URL" -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql
psql "$DATABASE_URL" -f docs/NEON_V1_HARDENING_MIGRATIONS.sql
psql "$DATABASE_URL" -f docs/FIX_STRIPE_EVENTS_COLUMN.sql
```

---

## 💳 Stripe Setup

### Step 1: Get API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy "Secret key" (starts with `sk_test_`)
3. Add to Railway variables: `STRIPE_SECRET_KEY`

### Step 2: Configure Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.railway.app/stripe/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `charge.dispute.created`
   - (See `docs/DEPLOYMENT_CHECKLIST.md` for full list)
5. Copy webhook secret (starts with `whsec_`)
6. Add to Railway variables: `STRIPE_WEBHOOK_SECRET`

---

## 🚀 Deploy

### Automated Deployment

```bash
./scripts/deploy-staging.sh
```

### Manual Deployment

```bash
# Using Railway CLI
railway up --environment staging

# Or push to GitHub (if connected)
git push origin main
```

---

## ✅ Verify Deployment

### 1. Health Check

```bash
curl https://your-app.railway.app/health
# Should return: {"ok":true,"status":"ok",...}
```

### 2. Check Logs

```bash
railway logs --environment staging
```

### 3. Run Smoke Tests

```bash
STAGING_URL=https://your-app.railway.app npm run test:smoke
```

---

## ⏰ Schedule Workers

### Option 1: Railway Cron Jobs

In Railway dashboard:
1. Add new service → "Cron Job"
2. Set schedule: `0 3 * * *` (daily at 3 AM UTC)
3. Command: `node dist/workers/index.js reliability-recalc`

**Recommended Workers:**

| Worker | Schedule | Command |
|--------|----------|---------|
| Auto-cancel | `*/15 * * * *` | `node dist/workers/index.js auto-cancel` |
| Reliability | `0 3 * * *` | `node dist/workers/index.js reliability-recalc` |
| Credit Economy | `0 4 * * *` | `node dist/workers/index.js credit-economy` |
| Retry Events | `*/5 * * * *` | `node dist/workers/index.js retry-events` |

### Option 2: External Scheduler

Use external cron service (e.g., cron-job.org) to call Railway webhook or API.

---

## 🔍 Troubleshooting

### Deployment Fails

```bash
# Check build logs
railway logs --environment staging

# Common fixes:
# 1. Check environment variables are set
# 2. Verify DATABASE_URL format
# 3. Check build command in railway.toml
```

### Health Check Fails

```bash
# Check service logs
railway logs --environment staging

# Verify environment variables
railway variables --environment staging

# Check database connection
railway logs --environment staging | grep -i database
```

### Workers Not Running

1. Verify `WORKERS_ENABLED=true`
2. Check worker logs: `railway logs --service worker`
3. Verify cron schedule
4. Check `worker_runs` table in database

---

## 📚 Next Steps

1. **Test Endpoints**: Test all API endpoints manually
2. **Monitor Logs**: Watch for errors in first hour
3. **Schedule Workers**: Set up background workers
4. **Set Up Monitoring**: Configure error tracking (Sentry, etc.)
5. **Production Deployment**: Follow same steps for production

---

## 📖 Full Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md` - Complete Railway guide
- **Staging Environment**: `docs/STAGING_ENVIRONMENT.md` - Staging setup
- **Deployment Checklist**: `docs/DEPLOYMENT_CHECKLIST.md` - Full checklist
- **Worker Schedule**: `docs/WORKER_SCHEDULE.md` - Worker scheduling

---

## 🎯 Quick Commands Reference

```bash
# Setup
./scripts/setup-staging.sh

# Deploy
./scripts/deploy-staging.sh
npm run deploy:staging

# View logs
railway logs --environment staging

# View variables
railway variables --environment staging

# Open dashboard
railway open --environment staging

# Health check
curl https://your-app.railway.app/health
```

---

**Last Updated**: 2025-01-15  
**Estimated Setup Time**: 20-30 minutes  
**Status**: Ready to Deploy ✅

