# 🚂 Railway Beginners Guide - Step by Step

## 🎯 What You're Looking At

You're in the **Railway Dashboard** for your **PureTask** project, in the **staging** environment.

**What you see:**
- ✅ **Postgres** (green, online) - Your database
- ❌ **puretask-backend** (offline) - Your API server (needs to be deployed)

---

## 📋 Step-by-Step: Get Your Backend Online

### Step 1: Click on "puretask-backend" Service

1. **Click the "puretask-backend" card** (the one with the GitHub logo that says "Service is offline")
2. This will open the service details page

### Step 2: Connect to GitHub (If Not Already)

If you see "Connect to GitHub" or "Deploy from GitHub":
1. Click it
2. Select your `puretask-backend` repository
3. Railway will automatically detect your code

### Step 3: Set Environment Variables

**This is CRITICAL!** Your backend needs these to work:

1. In the service page, go to the **"Variables"** tab
2. Click **"+ New Variable"** for each of these:

#### Required Variables:

```
DATABASE_URL = [Your Postgres connection string]
```

**How to get DATABASE_URL:**
- Click on your **Postgres** service
- Go to **"Variables"** tab
- Copy the `DATABASE_URL` value
- Paste it into your backend service variables

```
JWT_SECRET = [Generate a random secret]
```

**Generate JWT_SECRET:**
- Open PowerShell on your computer
- Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Copy the output and paste as `JWT_SECRET`

```
STRIPE_SECRET_KEY = sk_test_... [From Stripe dashboard]
```

**Get from Stripe:**
- Go to https://dashboard.stripe.com/test/apikeys
- Copy the "Secret key" (starts with `sk_test_`)
- Paste as `STRIPE_SECRET_KEY`

```
STRIPE_WEBHOOK_SECRET = whsec_... [From Stripe webhook]
```

**Get from Stripe:**
- Go to https://dashboard.stripe.com/test/webhooks
- Create a webhook (see Step 4 below)
- Copy the "Signing secret" (starts with `whsec_`)
- Paste as `STRIPE_WEBHOOK_SECRET`

```
N8N_WEBHOOK_SECRET = [Generate a random secret]
```

**Generate N8N_WEBHOOK_SECRET:**
- In PowerShell: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
- Copy and paste

#### Recommended Variables:

```
NODE_ENV = staging
BOOKINGS_ENABLED = true
PAYOUTS_ENABLED = false
CREDITS_ENABLED = true
REFUNDS_ENABLED = true
WORKERS_ENABLED = true
```

### Step 4: Configure Stripe Webhook

**After your backend is deployed** (Step 5), you'll get a URL like:
`https://puretask-backend-production.up.railway.app/stripe/webhook`

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL**: `https://your-railway-url.railway.app/stripe/webhook`
   - Get your URL from Railway: Click your backend service → Settings → Domains → Generate Domain
4. **Events to send**: Select these:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `charge.dispute.created`
5. Click **"Add endpoint"**
6. Copy the **"Signing secret"** (starts with `whsec_`)
7. Add it to Railway as `STRIPE_WEBHOOK_SECRET`

### Step 5: Deploy Your Backend

**Option A: Auto-Deploy (Recommended)**
- If connected to GitHub, Railway auto-deploys when you push code
- Or click **"Deploy"** or **"Redeploy"** button in Railway

**Option B: Manual Deploy**
1. In your backend service page
2. Click **"Deploy"** or **"Redeploy"** button
3. Wait for deployment to complete (2-5 minutes)

### Step 6: Set Up Database

Your Postgres database needs the schema (tables):

1. **Get your database connection string:**
   - Click **Postgres** service
   - Go to **"Variables"** tab
   - Copy `DATABASE_URL`

2. **Run migrations:**
   - Go to https://console.neon.tech (if using Neon)
   - Or use Railway's Postgres → "Query" tab
   - Copy contents of `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
   - Paste and run
   - Copy contents of `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
   - Paste and run
   - Copy contents of `docs/FIX_STRIPE_EVENTS_COLUMN.sql`
   - Paste and run

### Step 7: Get Your Backend URL

1. Click on **puretask-backend** service
2. Go to **"Settings"** tab
3. Click **"Generate Domain"** (or use custom domain)
4. Copy the URL (e.g., `https://puretask-backend-staging.up.railway.app`)

### Step 8: Test Your Backend

Open a browser or PowerShell and test:

```powershell
# Replace with your actual URL
curl https://your-backend-url.railway.app/health
```

**Should return:** `{"ok":true,"status":"ok",...}`

---

## 🎯 Quick Checklist

**Before deployment:**
- [ ] Backend service connected to GitHub
- [ ] All environment variables set (5 required + 6 recommended)
- [ ] Database migrations run (3 SQL files)

**After deployment:**
- [ ] Backend service shows "Online" (green)
- [ ] Domain generated
- [ ] Health check works (`/health` endpoint)
- [ ] Stripe webhook configured

---

## 🆘 Common Issues

### "Service is offline"
- **Fix**: Click "Deploy" or "Redeploy" button
- **Or**: Check if GitHub connection is working

### "Deployment failed"
- **Check**: Environment variables are set correctly
- **Check**: `DATABASE_URL` is correct
- **Check**: Logs tab for error messages

### "Database connection error"
- **Fix**: Make sure `DATABASE_URL` is set correctly
- **Fix**: Make sure database migrations are run

### "Stripe webhook not working"
- **Fix**: Make sure webhook URL matches your Railway domain
- **Fix**: Make sure `STRIPE_WEBHOOK_SECRET` is set correctly

---

## 📚 Next Steps After Backend is Online

1. **Test all endpoints** - Use Postman or curl
2. **Set up workers** - Schedule background jobs (see `docs/WORKER_SCHEDULE.md`)
3. **Monitor logs** - Check Railway "Logs" tab
4. **Set up production** - Repeat for production environment

---

## 🎓 Understanding Railway Basics

### What is Railway?
- **Platform** that hosts your code (like Heroku, but simpler)
- **Auto-deploys** from GitHub
- **Manages** databases, domains, environment variables

### What are Environments?
- **Staging** - For testing (what you're setting up now)
- **Production** - For real users (set up later)

### What are Services?
- **Postgres** - Your database
- **puretask-backend** - Your API server

### What are Variables?
- **Environment variables** - Settings your code needs (like passwords, API keys)
- **Set per environment** - Staging and production can have different values

---

## 💡 Pro Tips

1. **Always test in staging first** before production
2. **Keep secrets secret** - Never commit `.env` files to GitHub
3. **Check logs** - Railway logs show what's happening
4. **Use domains** - Railway gives you free HTTPS domains
5. **Monitor usage** - Check "Usage" tab to see costs

---

## 🆘 Need Help?

**If stuck:**
1. Check Railway **"Logs"** tab for errors
2. Check Railway **"Deployments"** tab for failed deployments
3. Verify all environment variables are set
4. Make sure database migrations are run

**Documentation:**
- `docs/RAILWAY_SETUP.md` - Detailed Railway guide
- `docs/DEPLOYMENT_QUICK_START.md` - Quick deployment guide
- `docs/STAGING_ENVIRONMENT.md` - Staging-specific guide

---

**Ready to start?** Go to **Step 1** above and click on your backend service! 🚀

