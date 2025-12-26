# 🚂 Deploy PureTask Backend to Railway

**Quick Start Guide** - Get your backend running on Railway in 15 minutes.

---

## Prerequisites

- [x] Railway account (sign up at https://railway.app)
- [x] GitHub repository (PURETASK/puretask-backend)
- [ ] Railway CLI installed (optional, but recommended)
- [ ] Environment variables prepared

---

## Method 1: Railway Dashboard (Easiest)

### Step 1: Create New Project

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select **PURETASK/puretask-backend**
5. Click **"Deploy Now"**

### Step 2: Add Database (Recommended)

1. In your project, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically creates `DATABASE_URL` environment variable
3. Your service can now access the database

### Step 3: Set Environment Variables

Click on your service → **"Variables"** tab → Add these:

#### Required Variables:
```bash
JWT_SECRET=your-32-character-secret-here-minimum
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
N8N_WEBHOOK_SECRET=your-n8n-webhook-secret
```

#### Notification Variables:
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=no-reply@puretask.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
N8N_WEBHOOK_URL=https://your-n8n.app/webhook/puretask-communications
```

#### Template Variables (14 SendGrid templates):
```bash
SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_USER_JOB_CANCELLED=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_USER_WELCOME=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION=d-xxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_USER_PASSWORD_RESET=d-xxxxxxxxxxxxxxxx
SMS_TEMPLATE_EMERGENCY=xxxxxxxxxxxxxxxx
SMS_TEMPLATE_JOB_REMINDER=xxxxxxxxxxxxxxxx
```

#### Feature Flags (Optional):
```bash
NODE_ENV=production
BOOKINGS_ENABLED=true
PAYOUTS_ENABLED=true
CREDITS_ENABLED=true
WORKERS_ENABLED=true
USE_EVENT_BASED_NOTIFICATIONS=true
```

### Step 4: Deploy

1. Railway automatically deploys after adding variables
2. Watch the **"Deployments"** tab for build progress
3. Wait for status to show **"Active"**

### Step 5: Verify Deployment

**Get your Railway URL:**
- Go to **"Settings"** → **"Networking"** → Copy the generated domain

**Test endpoints:**
```bash
# Health check
curl https://your-app.up.railway.app/health

# Database check
curl https://your-app.up.railway.app/health/ready
```

Expected responses:
```json
// /health
{"ok":true,"status":"ok","service":"puretask-backend","timestamp":"2025-12-26T..."}

// /health/ready
{"status":"ready","database":"connected","timestamp":"2025-12-26T..."}
```

---

## Method 2: Railway CLI (Recommended for Developers)

### Step 1: Install Railway CLI

**Windows (PowerShell):**
```powershell
npm install -g @railway/cli
```

**Mac/Linux:**
```bash
# Using npm
npm install -g @railway/cli

# Or using Homebrew (Mac)
brew install railway
```

### Step 2: Login

```bash
railway login
```
- Opens browser for authentication
- Returns to terminal when complete

### Step 3: Initialize Project

```bash
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
railway init
```

**Select:**
- "Create a new project" or "Link to existing project"
- Choose project name (e.g., "puretask-backend-prod")

### Step 4: Add Database (Optional)

```bash
railway add --database postgresql
```

Railway provisions a Postgres database and sets `DATABASE_URL`.

### Step 5: Set Environment Variables

**Interactive (one at a time):**
```bash
railway variables set JWT_SECRET="your-secret-here"
railway variables set STRIPE_SECRET_KEY="sk_test_xxx"
railway variables set STRIPE_WEBHOOK_SECRET="whsec_xxx"
# ... continue for all variables
```

**Or bulk import from .env file:**
```bash
railway variables set $(cat .env.production)
```

### Step 6: Deploy

```bash
railway up
```

**Or deploy and open logs:**
```bash
railway up --detach && railway logs
```

### Step 7: View Deployment

```bash
# Open Railway dashboard
railway open

# View logs
railway logs

# Get service URL
railway domain
```

---

## Method 3: Connect GitHub for Auto-Deploy

### Step 1: Link Repository

In Railway dashboard:
1. Go to project → Service → **"Settings"**
2. Click **"Connect Repo"**
3. Select **PURETASK/puretask-backend**
4. Choose branch: **main**

### Step 2: Configure Auto-Deploy

**Settings → Deploy:**
- ✅ **Auto-Deploy on Push:** Enabled
- **Watch Paths:** Leave empty (deploy on any change)
- **Root Directory:** `/` (use repo root)

### Step 3: Push to Deploy

```bash
git push origin main
```

Railway automatically:
1. Detects push
2. Builds code (`npm ci && npm run build`)
3. Deploys new version
4. Runs health checks
5. Routes traffic to new version

---

## Post-Deployment Tasks

### 1. Run Database Migrations

**Using Railway CLI:**
```bash
railway run npm run migrate:run
```

**Or via dashboard:**
- Go to service → **"Deploy"** → **"Custom Start Command"**
- Temporarily set to: `npm run migrate:run`
- Redeploy
- Revert to: `npm start`

### 2. Update Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add new endpoint: `https://your-app.up.railway.app/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook secret → Update `STRIPE_WEBHOOK_SECRET` in Railway

### 3. Update n8n Webhooks

1. Update n8n workflows with Railway URL
2. Test communication endpoint:
```bash
curl -X POST https://your-app.up.railway.app/api/test-notification \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 4. Configure Custom Domain (Optional)

**In Railway dashboard:**
1. Go to **"Settings"** → **"Networking"**
2. Click **"Custom Domain"**
3. Add: `api.puretask.com`
4. Update DNS records as instructed by Railway
5. Wait for SSL certificate provisioning (~5 minutes)

**DNS Records (example):**
```
CNAME api.puretask.com -> your-app.up.railway.app
```

### 5. Set Up Monitoring

Railway provides:
- Real-time logs
- CPU/Memory metrics
- Request counts
- Error tracking

**Access:**
- Dashboard → Your Service → **"Observability"** tab

---

## Troubleshooting

### Deployment Fails

**Check logs:**
```bash
railway logs
```

**Common issues:**
- Missing environment variables → Add them in "Variables"
- Build fails → Check `package.json` scripts
- Database connection fails → Verify `DATABASE_URL`

### Health Check Fails

**Check:**
1. Service is running: `railway logs`
2. Port is correct (Railway auto-detects from code)
3. Health endpoint works: `curl https://your-app.up.railway.app/health`

**Note:** PureTask backend already uses `process.env.PORT` correctly, so this shouldn't be an issue.

### "Address Already in Use" Error

This should NOT happen with PureTask backend because we use `process.env.PORT`.

If it does:
1. Check if multiple services are running
2. Verify no hardcoded port in code (we don't have this)
3. Restart deployment

### Database Connection Issues

**Check:**
```bash
railway variables get DATABASE_URL
```

**Ensure:**
- Connection string includes `?sslmode=require`
- Database is running (check Railway database service)
- Network is not blocked

**Fix:**
```bash
railway variables set DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
```

---

## Scaling & Performance

### Horizontal Scaling (Multiple Instances)

Railway Pro plan supports:
1. Go to **"Settings"** → **"Scaling"**
2. Increase replica count
3. Railway load balances automatically

### Vertical Scaling (More Resources)

Railway auto-scales based on usage, but you can set limits:
1. **"Settings"** → **"Resources"**
2. Set memory/CPU limits
3. Monitor "Observability" tab

### Database Performance

**For high traffic:**
1. Upgrade Railway Postgres plan
2. Or use external managed database (Neon, Supabase)
3. Enable connection pooling (PgBouncer)

---

## Cost Optimization

### Development Environment

**Use Railway's Free Tier:**
- $5 free credits/month
- 500 execution hours
- Perfect for testing

**Tips:**
- Use "Sleep on Idle" feature
- Deploy only when testing
- Use local development for coding

### Production Environment

**Starter Plan ($5/month):**
- Good for MVPs
- ~500-1000 requests/day

**Pro Plan ($20/month):**
- Recommended for production
- Unlimited execution time
- Better performance

**Estimated costs:**
- Backend API: $5-15/month
- Postgres DB: $5-10/month
- **Total: $10-25/month** for small-medium traffic

---

## Security Best Practices

### Environment Variables

- ✅ Never commit `.env` files to Git
- ✅ Use Railway's encrypted variables
- ✅ Rotate secrets regularly
- ✅ Use different secrets for dev/prod

### Database

- ✅ Always use `sslmode=require`
- ✅ Set strong database passwords
- ✅ Limit database access to Railway only
- ✅ Regular backups (Railway auto-backs up)

### API

- ✅ CORS configured for your domains only
- ✅ Rate limiting enabled (already in code)
- ✅ Helmet security headers (already in code)
- ✅ Input validation (already in code)

---

## Rollback Strategy

### Instant Rollback

**Via Dashboard:**
1. Go to **"Deployments"** tab
2. Find previous successful deployment
3. Click **"Redeploy"**

**Via CLI:**
```bash
railway redeploy <deployment-id>
```

### Rollback via Git

```bash
git revert HEAD
git push origin main
```

Railway auto-deploys the reverted code.

---

## Monitoring & Alerts

### Built-in Monitoring

Railway provides:
- Request logs
- Error tracking
- Performance metrics
- Uptime monitoring

### External Monitoring (Optional)

Consider adding:
- **Sentry** for error tracking
- **Datadog** for APM
- **UptimeRobot** for uptime checks
- **LogDNA** for log aggregation

---

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Run database migrations
3. ✅ Update webhook URLs (Stripe, n8n)
4. ✅ Test all endpoints
5. ✅ Configure custom domain
6. ✅ Deploy frontend to Vercel/Netlify
7. ✅ Update frontend API URL to Railway
8. ✅ Monitor for 24 hours
9. ✅ Set up production alerts

---

## Support

**Railway:**
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Twitter: @Railway

**PureTask Backend:**
- GitHub Issues: https://github.com/PURETASK/puretask-backend/issues
- Internal docs: `docs/` directory

---

## Summary

✅ **PureTask backend is Railway-ready** - No code changes needed  
✅ **3 deployment methods** - Choose what works for you  
✅ **Auto-deploy on push** - Continuous deployment ready  
✅ **Health checks configured** - Railway can monitor automatically  
✅ **Scaling ready** - Horizontal and vertical scaling supported  

**Estimated Time:** 15 minutes for first deployment  
**Estimated Cost:** $10-25/month for production  
**Difficulty:** Easy (all configuration files provided)

🚀 **Ready to deploy!**

