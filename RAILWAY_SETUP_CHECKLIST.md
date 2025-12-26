# Railway Setup Checklist

**Project:** PureTask Backend  
**Internal URL:** puretask-backend.railway.internal  
**Status:** Configuration files committed, ready for variable setup

---

## ✅ Completed

- [x] Railway account created (reeperzx7@icloud.com)
- [x] Railway CLI installed (v4.16.1)
- [x] Project created: "Puretask"
- [x] Backend service deployed
- [x] Railway configuration files committed:
  - [x] `railway.json` - Build/deploy config
  - [x] `.railwayignore` - Deployment optimization
  - [x] `RAILWAY_DEPLOYMENT_ANALYSIS.md` - Technical docs
  - [x] `DEPLOY_TO_RAILWAY.md` - Setup guide
- [x] Code is Railway-ready:
  - [x] Dynamic PORT handling
  - [x] Trust proxy configured
  - [x] Health check endpoints
  - [x] Graceful shutdown

---

## 🔄 In Progress

### 1. Add PostgreSQL Database
- [ ] Go to Railway dashboard: https://railway.app/project
- [ ] Click **"+ New"** → **"Database"** → **"PostgreSQL"**
- [ ] Wait for provisioning (~30 seconds)
- [ ] Copy `DATABASE_URL` from Postgres Variables tab

### 2. Set Critical Environment Variables
Go to **puretask-backend** service → **Variables** tab

#### Must Set (Service Won't Start Without These):
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET=PSOyk5vaOgIkypUbvAGg5tnTlEE7nhNXaWE6wejA`
- [ ] `DATABASE_URL=<PASTE_RAILWAY_POSTGRES_URL>`
- [ ] `STRIPE_SECRET_KEY=<YOUR_KEY>`
- [ ] `STRIPE_WEBHOOK_SECRET=<YOUR_SECRET>`
- [ ] `N8N_WEBHOOK_SECRET=<YOUR_SECRET>`

#### Recommended (Use defaults below or customize):
- [ ] `JWT_EXPIRES_IN=30d`
- [ ] `BCRYPT_SALT_ROUNDS=10`
- [ ] `BOOKINGS_ENABLED=true`
- [ ] `PAYOUTS_ENABLED=false`
- [ ] `CREDITS_ENABLED=true`
- [ ] `WORKERS_ENABLED=true`
- [ ] `USE_EVENT_BASED_NOTIFICATIONS=true`
- [ ] `PAYOUT_CURRENCY=usd`
- [ ] `CENTS_PER_CREDIT=10`
- [ ] `PLATFORM_FEE_PERCENT=15`

#### Optional (Notifications):
- [ ] `SENDGRID_API_KEY=<YOUR_KEY>`
- [ ] `SENDGRID_FROM_EMAIL=no-reply@puretask.com`
- [ ] `N8N_WEBHOOK_URL=<YOUR_N8N_URL>`
- [ ] `TWILIO_ACCOUNT_SID=<YOUR_SID>` (if using SMS)
- [ ] `TWILIO_AUTH_TOKEN=<YOUR_TOKEN>` (if using SMS)
- [ ] `TWILIO_FROM_NUMBER=<YOUR_PHONE>` (if using SMS)

#### Template IDs (Add when you have SendGrid templates):
- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_USER_JOB_CANCELLED=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE=d-xxx`
- [ ] `SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT=d-xxx`
- [ ] `SENDGRID_TEMPLATE_USER_WELCOME=d-xxx`
- [ ] `SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION=d-xxx`
- [ ] `SENDGRID_TEMPLATE_USER_PASSWORD_RESET=d-xxx`
- [ ] `SMS_TEMPLATE_EMERGENCY=xxx` (if using SMS)
- [ ] `SMS_TEMPLATE_JOB_REMINDER=xxx` (if using SMS)

### 3. Generate Public Domain
- [ ] Go to **puretask-backend** → **"Settings"** → **"Networking"**
- [ ] Click **"Generate Domain"**
- [ ] Copy the URL (e.g., `puretask-backend-production-xxxx.up.railway.app`)
- [ ] Save URL for testing

### 4. Verify Deployment
- [ ] Wait for deployment to finish (check "Deployments" tab)
- [ ] Status shows **"Active"**
- [ ] Logs show: `🚀 PureTask Backend running on port XXXX`

### 5. Test Endpoints
Run the test script with your Railway URL:
```powershell
.\test-railway-deployment.ps1 -RailwayUrl "https://your-app.up.railway.app"
```

Expected results:
- [ ] `GET /health` returns 200 OK
- [ ] `GET /health/ready` returns 200 OK with `database: "connected"`

---

## ⏭️ Next Steps (After Deployment Works)

### 6. Run Database Migrations
Once health checks pass:
```bash
railway run npm run migrate:run
```

Or manually connect to Railway Postgres and run migration scripts from `DB/migrations/`

### 7. Update External Webhooks
- [ ] **Stripe Webhooks**
  - Go to: https://dashboard.stripe.com/webhooks
  - Add endpoint: `https://your-railway-url.up.railway.app/stripe/webhook`
  - Select events: payment_intent.succeeded, payment_intent.payment_failed, etc.
  - Copy webhook secret → Update `STRIPE_WEBHOOK_SECRET` in Railway
  
- [ ] **n8n Workflows**
  - Update n8n workflows to use Railway URL
  - Update `N8N_WEBHOOK_URL` in Railway if needed
  - Test communication flow

### 8. Configure Custom Domain (Optional)
- [ ] Add custom domain in Railway: `api.puretask.com`
- [ ] Update DNS records (Railway will provide instructions)
- [ ] Wait for SSL certificate provisioning
- [ ] Test custom domain

### 9. Set Up Monitoring
- [ ] Check Railway **"Observability"** tab for metrics
- [ ] Set up external monitoring (UptimeRobot, Datadog, etc.)
- [ ] Configure alerts for downtime
- [ ] Set up error tracking (Sentry, etc.)

### 10. Enable Auto-Deploy from GitHub
- [ ] Go to **"Settings"** → **"Source"**
- [ ] Connect GitHub repository
- [ ] Enable auto-deploy on push to `main`
- [ ] Test by pushing a commit

---

## 🔧 Troubleshooting

### Service Won't Start
**Check:**
1. Railway logs (click service → "Logs" tab)
2. Missing required environment variables
3. Database connection string is correct
4. `NODE_ENV=production` is set

**Common fixes:**
- Ensure all required variables are set
- Verify DATABASE_URL has `?sslmode=require`
- Check build logs for errors

### Health Check Fails
**Check:**
1. Service is running (green status in Railway)
2. Public URL is generated
3. `/health` endpoint is accessible
4. Logs don't show startup errors

**Common fixes:**
- Wait 1-2 minutes for deployment to complete
- Check if PORT binding is correct (our code already handles this)
- Verify no firewall blocking

### Database Connection Fails
**Check:**
1. Railway Postgres service is running
2. DATABASE_URL is copied correctly
3. Connection string includes `?sslmode=require`
4. Postgres service is in same project/environment

**Common fixes:**
- Regenerate DATABASE_URL from Postgres service
- Ensure no typos in connection string
- Check Postgres logs for connection attempts

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Railway Project | ✅ Created | "Puretask" project |
| Backend Service | ✅ Deployed | Internal URL: puretask-backend.railway.internal |
| Config Files | ✅ Committed | railway.json, .railwayignore, docs |
| Code Readiness | ✅ Ready | Zero changes needed |
| PostgreSQL | ⏳ Pending | Need to add database |
| Environment Variables | ⏳ Pending | Need to configure |
| Public Domain | ⏳ Pending | Need to generate |
| Database Migrations | ⏳ Pending | Run after env vars set |
| Webhooks | ⏳ Pending | Update after URL generated |

---

## 📞 Support Resources

**Railway:**
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

**PureTask:**
- Setup Guide: `DEPLOY_TO_RAILWAY.md`
- Analysis: `RAILWAY_DEPLOYMENT_ANALYSIS.md`
- Test Script: `test-railway-deployment.ps1`

---

## ✅ Definition of Done

Deployment is complete when:
- [x] All required environment variables set
- [ ] Health check returns 200 OK
- [ ] Database check returns `"connected"`
- [ ] Database migrations completed
- [ ] External webhooks updated
- [ ] At least one successful API request
- [ ] Monitoring configured

---

**Last Updated:** 2025-12-26  
**Next Action:** Add PostgreSQL database and configure environment variables

