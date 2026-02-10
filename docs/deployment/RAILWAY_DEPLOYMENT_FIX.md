# Railway Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Railway Settings Configuration

In Railway Dashboard → Your Service → Settings:

- [ ] **Root Directory**: Set to `.` or leave empty (NOT `/.cursor`)
- [ ] **Build Command**: `npm run build`
- [ ] **Start Command**: `npm start`
- [ ] **Health Check Path**: `/health`
- [ ] **Health Check Timeout**: 100 seconds

### 2. Environment Variables

In Railway Dashboard → Variables tab, add:

```bash
# Required
DATABASE_URL=postgresql://...  (from Railway Postgres)
JWT_SECRET=<your-128-char-secret>
NODE_ENV=production

# Stripe (IMPORTANT: Rotate after screenshots!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# n8n
N8N_WEBHOOK_SECRET=<secret>
N8N_WEBHOOK_URL=<your-n8n-url>

# Email (SendGrid)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=no-reply@puretask.com

# SMS (Twilio) - Optional
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# OAuth - Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# URLs
APP_URL=https://app.puretask.com
```

### 3. Database Migration

After first deployment:

```bash
# Connect to Railway Postgres
railway connect <postgres-service-id>

# Run migrations
\i DB/migrations/001_init.sql
\i DB/migrations/025_auth_enhancements.sql
```

Or use Railway CLI:
```bash
railway run psql $DATABASE_URL < DB/migrations/001_init.sql
railway run psql $DATABASE_URL < DB/migrations/025_auth_enhancements.sql
```

### 4. Verify Health Check

After deployment:
```bash
curl https://your-app.railway.app/health
```

Should return:
```json
{
  "ok": true,
  "status": "ok",
  "service": "puretask-backend",
  "timestamp": "2025-12-27T..."
}
```

## 🚨 Common Issues & Fixes

### Issue 1: "Service Unavailable" on Health Check

**Cause**: App not binding to Railway's PORT or not listening on 0.0.0.0

**Fix**: ✅ Already fixed in `src/index.ts`:
```typescript
server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
});
```

### Issue 2: "Root Directory" set to `/.cursor`

**Cause**: Incorrect Railway configuration

**Fix**: 
1. Go to Railway → Settings
2. Find "Root Directory"
3. Change from `/.cursor` to `.` or leave empty
4. Save and redeploy

### Issue 3: Health Check Timeout

**Cause**: App takes too long to start

**Fix**: 
- Increase timeout in `railway.json` (already set to 100s)
- Check logs for slow initialization
- Ensure database connection doesn't block startup

### Issue 4: Build Fails

**Cause**: TypeScript errors or missing dependencies

**Fix**:
```bash
# Test locally first
npm run build
npm start

# Check for errors
npm run typecheck
```

### Issue 5: Database Connection Fails

**Cause**: Wrong DATABASE_URL or SSL not configured

**Fix**:
- Verify DATABASE_URL includes `?sslmode=require`
- Check Railway Postgres is in same project
- Test connection: `railway run npm run test:smoke`

## 📊 Post-Deployment Verification

### 1. Check Health Endpoints

```bash
BASE_URL=https://your-app.railway.app

# Basic health
curl $BASE_URL/health

# Database connectivity
curl $BASE_URL/health/ready

# Liveness
curl $BASE_URL/health/live
```

### 2. Test Authentication

```bash
# Register a user
curl -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "role": "client"
  }'

# Should return token and user object
```

### 3. Monitor Logs

```bash
railway logs --tail 100
```

Look for:
- ✅ `server_started`
- ✅ `Listening on 0.0.0.0:PORT`
- ❌ Any error messages

### 4. Check Metrics

Railway Dashboard → Metrics tab:
- CPU usage should be low at idle
- Memory usage should be stable
- Network traffic should show health check requests

## 🔐 Security Post-Deployment

### CRITICAL: Rotate Stripe Keys

Since Stripe keys were visible in screenshots:

1. **Go to Stripe Dashboard**
2. **API Keys section**
3. **Rotate both:**
   - Secret Key (`sk_live_...`)
   - Webhook Secret (`whsec_...`)
4. **Update Railway environment variables**
5. **Redeploy**

### Update Webhook URLs

1. **Stripe Webhooks**:
   - Update endpoint to: `https://your-app.railway.app/stripe/webhook`

2. **n8n Webhooks**:
   - Update N8N_WEBHOOK_URL in Railway variables

## 🎯 Railway-Specific Optimizations

### 1. Use Railway's Postgres

Already configured, but verify:
```bash
railway variables
# Should show DATABASE_URL
```

### 2. Enable Auto-Deploy

Railway Settings:
- ✅ Enable "Auto-Deploy from GitHub"
- Branch: `main`
- Every push deploys automatically

### 3. Set Up Monitoring

Railway Settings → Observability:
- Enable health checks (already done)
- Set up alerts for downtime
- Monitor resource usage

## 📝 Deployment Commands

```bash
# Manual deploy via CLI
railway up

# Link to Railway project
railway link

# View logs
railway logs

# Open in browser
railway open

# Run migrations
railway run npm run migration:run

# Shell access
railway shell
```

## ✅ Final Checklist

Before marking as complete:

- [ ] Root Directory is `.` (not `/.cursor`)
- [ ] App binds to `0.0.0.0` ✅
- [ ] Health check returns 200 OK
- [ ] Database migrations ran successfully
- [ ] Environment variables all set
- [ ] Stripe keys rotated
- [ ] Webhook URLs updated
- [ ] Auto-deploy enabled
- [ ] Logs show no errors
- [ ] Test API endpoint works

## 🚀 Deploy Command

After fixing everything:

```bash
git add -A
git commit -m "fix: Railway deployment configuration"
git push origin main
```

Railway will auto-deploy!

---

**Need Help?**
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check logs: `railway logs`

