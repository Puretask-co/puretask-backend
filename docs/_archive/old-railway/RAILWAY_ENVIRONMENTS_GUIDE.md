# 🎯 Railway Environments Guide - Staging vs Production

## Understanding Railway Environments

In Railway, you can have **multiple environments** in the **same project**:
- **Staging** - For testing
- **Production** - For live users

Each environment has its own:
- Services (API, database, etc.)
- Environment variables
- Deployments
- Domains

---

## 🎯 Your Current Situation

You have:
- ✅ Project: "gleaming-wholeness"
- ✅ Environment: "production"
- ✅ Postgres database (online)
- ⚠️ puretask-backend service (offline)

---

## ✅ Option 1: Create Staging Environment (Recommended)

**Use your existing project, create a new environment for staging.**

### Steps:

1. **In Railway Dashboard:**
   - You're currently in "production" environment
   - Look for environment selector (usually top-left or top-right)
   - Click it → Select "Create New Environment"
   - Name it: "staging"

2. **Add Services to Staging:**
   - In the staging environment, click "+ Create"
   - Add "Database" → "Add Neon" (or use existing Postgres)
   - Add "GitHub Repo" → Select "puretask-backend"

3. **Set Environment Variables for Staging:**
   - Make sure you're in "staging" environment
   - Go to Variables tab
   - Add all required variables (see below)

4. **Deploy:**
   - Railway will auto-deploy when you push to GitHub
   - Or click "Deploy" in dashboard

**Benefits:**
- ✅ Same project, organized
- ✅ Easy to switch between staging/production
- ✅ Can share some resources if needed

---

## ✅ Option 2: Create Separate Project for Staging

**Create a completely new Railway project for staging.**

### Steps:

1. **Create New Project:**
   - In Railway dashboard, click your profile → "New Project"
   - Name: "puretask-backend-staging"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Add Services:**
   - Add Neon database
   - Backend service will be auto-added

3. **Set Variables:**
   - Add all environment variables

4. **Deploy:**
   - Auto-deploys on git push

**Benefits:**
- ✅ Completely separate
- ✅ Different billing/limits
- ✅ Clear separation

---

## 🔍 What About Your Current Setup?

### Your "production" Environment:

**The puretask-backend service is offline.** This could mean:
1. It was never deployed
2. Deployment failed
3. Service was stopped

**To fix:**
1. Click on "puretask-backend" service
2. Check "Deployments" tab
3. See if there are any errors
4. Try deploying again

**Or start fresh:**
- Keep production for later
- Set up staging first
- Test everything in staging
- Then deploy to production

---

## 🎯 Recommended Path Forward

### Step 1: Create Staging Environment

1. In your current project ("gleaming-wholeness")
2. Create new environment: "staging"
3. Add services to staging:
   - Database (Neon or Postgres)
   - Backend service (from GitHub)

### Step 2: Configure Staging

1. Set environment variables (staging-specific)
2. Run database migrations
3. Configure Stripe webhook (staging URL)

### Step 3: Deploy & Test

1. Deploy to staging
2. Test all endpoints
3. Verify everything works

### Step 4: Production (Later)

1. Once staging works
2. Configure production environment
3. Deploy to production

---

## 📋 Quick Checklist

**For Staging Environment:**

- [ ] Create "staging" environment in Railway
- [ ] Add database service (Neon recommended)
- [ ] Add backend service (from GitHub)
- [ ] Set environment variables:
  - [ ] `DATABASE_URL`
  - [ ] `JWT_SECRET`
  - [ ] `STRIPE_SECRET_KEY` (test mode)
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `N8N_WEBHOOK_SECRET`
  - [ ] `NODE_ENV=staging`
  - [ ] Guard flags (BOOKINGS_ENABLED, etc.)
- [ ] Run database migrations
- [ ] Configure Stripe webhook
- [ ] Deploy
- [ ] Test health endpoint

---

## 🆘 Still Confused?

**Tell me:**
1. Do you want staging and production in the same project? (Recommended: Yes)
2. Or separate projects? (More isolation)

**I'll guide you step-by-step based on your choice!**

---

**Last Updated**: 2025-01-15

