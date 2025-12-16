# 🚂 Railway Deployment Guide

Complete guide for deploying PureTask Backend to Railway.

---

## 📋 Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **Railway CLI**: Install with `npm install -g @railway/cli`
3. **Neon Database**: Create at https://console.neon.tech
4. **Stripe Account**: For payment processing

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Make scripts executable (Unix/Mac)
chmod +x scripts/*.sh

# Run staging setup script
./scripts/setup-staging.sh
```

This script will:
- ✅ Create Railway project
- ✅ Guide you through database setup
- ✅ Set environment variables
- ✅ Deploy to staging

### Option 2: Manual Setup

Follow the steps below for manual setup.

---

## 📦 Railway Project Structure

### Recommended Setup

**Two Environments:**
1. **Staging** - For testing before production
2. **Production** - Live environment

**Services:**
1. **API Service** - Main backend API
2. **Worker Service** (optional) - Separate service for background workers

---

## 🔧 Step-by-Step Setup

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Create Railway Project

```bash
# Create new project
railway init --name "puretask-backend-staging"

# Or link to existing project
railway link
```

### Step 3: Create Neon Database

1. Go to https://console.neon.tech
2. Create new project: "puretask-staging"
3. Copy connection string
4. Add to Railway variables:

```bash
railway variables set DATABASE_URL="postgresql://..." --environment staging
```

**Important**: Add `?sslmode=require` to connection string for production.

### Step 4: Run Database Migrations

**Option A: Using Neon SQL Editor (Recommended)**
1. Open Neon Console → SQL Editor
2. Copy and paste `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
3. Run it
4. Copy and paste `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
5. Run it
6. Copy and paste `docs/FIX_STRIPE_EVENTS_COLUMN.sql`
7. Run it

**Option B: Using psql**
```bash
export DATABASE_URL="your-connection-string"
psql "$DATABASE_URL" -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql
psql "$DATABASE_URL" -f docs/NEON_V1_HARDENING_MIGRATIONS.sql
psql "$DATABASE_URL" -f docs/FIX_STRIPE_EVENTS_COLUMN.sql
```

### Step 5: Set Environment Variables

**Required Variables:**

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
N8N_SECRET=$(openssl rand -hex 32)

# Set in Railway
railway variables set JWT_SECRET="$JWT_SECRET" --environment staging
railway variables set N8N_WEBHOOK_SECRET="$N8N_SECRET" --environment staging
railway variables set DATABASE_URL="postgresql://..." --environment staging
railway variables set STRIPE_SECRET_KEY="sk_test_..." --environment staging
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..." --environment staging
```

**Production Guard Flags (Staging):**

```bash
railway variables set NODE_ENV=staging --environment staging
railway variables set BOOKINGS_ENABLED=true --environment staging
railway variables set PAYOUTS_ENABLED=false --environment staging
railway variables set CREDITS_ENABLED=true --environment staging
railway variables set REFUNDS_ENABLED=true --environment staging
railway variables set WORKERS_ENABLED=true --environment staging
```

**Production Guard Flags (Production):**

```bash
railway variables set NODE_ENV=production --environment production
railway variables set BOOKINGS_ENABLED=true --environment production
railway variables set PAYOUTS_ENABLED=false --environment production  # Enable after testing
railway variables set CREDITS_ENABLED=true --environment production
railway variables set REFUNDS_ENABLED=true --environment production
railway variables set WORKERS_ENABLED=true --environment production
```

### Step 6: Configure Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.railway.app/stripe/webhook`
4. Select events (see `docs/DEPLOYMENT_CHECKLIST.md` for full list)
5. Copy webhook secret
6. Set in Railway:

```bash
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..." --environment staging
```

### Step 7: Deploy

```bash
# Deploy to staging
./scripts/deploy-staging.sh

# Or manually
railway up --environment staging
```

### Step 8: Get Deployment URL

```bash
# Generate domain
railway domain --environment staging

# Or view in Railway dashboard
railway open --environment staging
```

---

## ⏰ Worker Scheduling

Railway supports scheduled tasks via cron jobs.

### Option 1: Railway Cron Jobs

In Railway dashboard:
1. Go to your project
2. Add new service → "Cron Job"
3. Configure schedule and command

**Recommended Workers:**

| Worker | Schedule | Command |
|--------|----------|---------|
| Auto-cancel | `*/15 * * * *` | `node dist/workers/index.js auto-cancel` |
| Reliability Recalc | `0 3 * * *` | `node dist/workers/index.js reliability-recalc` |
| Credit Economy | `0 4 * * *` | `node dist/workers/index.js credit-economy` |
| Retry Events | `*/5 * * * *` | `node dist/workers/index.js retry-events` |
| KPI Snapshot | `0 0 * * *` | `node dist/workers/index.js kpi-snapshot` |
| Photo Cleanup | `0 1 * * *` | `node dist/workers/index.js photo-cleanup` |

### Option 2: Separate Worker Service

Create a separate Railway service that runs workers:

1. Create new service in Railway
2. Set start command: `node dist/workers/index.js <worker-name>`
3. Use Railway's cron triggers or external scheduler

---

## 🔍 Monitoring & Logs

### View Logs

```bash
# All logs
railway logs --environment staging

# Follow logs
railway logs --follow --environment staging

# Filter by service
railway logs --service api --environment staging
```

### Health Checks

```bash
# Basic health
curl https://your-app.railway.app/health

# Readiness (database)
curl https://your-app.railway.app/health/ready

# Liveness
curl https://your-app.railway.app/health/live
```

### Railway Dashboard

```bash
# Open dashboard
railway open --environment staging
```

---

## 🔐 Production Deployment

### Pre-Production Checklist

- [ ] All staging tests pass
- [ ] Database migrations run on production database
- [ ] Production environment variables set
- [ ] Stripe live keys configured
- [ ] Production webhook endpoint configured
- [ ] Monitoring/logging set up
- [ ] Workers scheduled
- [ ] Rollback plan documented

### Deploy to Production

```bash
# Use production deployment script
./scripts/deploy-production.sh

# Or manually
railway up --environment production
```

**Important**: Production deployment requires:
- Live Stripe keys (`sk_live_...`)
- Production database
- Strong JWT_SECRET (64+ characters)
- All production guard flags reviewed

---

## 🛠️ Troubleshooting

### Deployment Fails

**Check logs:**
```bash
railway logs --environment staging
```

**Common issues:**
1. **Build fails**: Check `railway.toml` and `nixpacks.toml`
2. **Start fails**: Check environment variables
3. **Database connection fails**: Verify `DATABASE_URL` and SSL mode

### Health Check Fails

1. Check if service is running: `railway status`
2. Check logs for errors
3. Verify environment variables are set
4. Check database connectivity

### Workers Not Running

1. Verify `WORKERS_ENABLED=true`
2. Check worker logs: `railway logs --service worker`
3. Verify cron schedule is correct
4. Check worker execution in `worker_runs` table

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app
- **Deployment Checklist**: `docs/DEPLOYMENT_CHECKLIST.md`
- **Worker Schedule**: `docs/WORKER_SCHEDULE.md`
- **Environment Template**: `docs/ENV_TEMPLATE.md`

---

## 🎯 Quick Reference

```bash
# Login
railway login

# Create project
railway init

# Link to project
railway link

# Set variable
railway variables set KEY=value --environment staging

# View variables
railway variables --environment staging

# Deploy
railway up --environment staging

# View logs
railway logs --environment staging

# Open dashboard
railway open --environment staging

# Generate domain
railway domain --environment staging
```

---

**Last Updated**: 2025-01-15  
**Status**: Production Ready ✅

