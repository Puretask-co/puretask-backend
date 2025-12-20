# 🔧 Railway Healthcheck Fix Guide

## ✅ Your Code is CORRECT!

Your backend code is **already correct**:
- ✅ Uses `process.env.PORT` (line 227 in `src/index.ts`)
- ✅ Has `/health` endpoint (line 144 in `src/index.ts`)
- ✅ Server starts correctly (Express app)

## 🚨 The REAL Problem

The healthcheck is failing because **one of these is happening**:

### Issue #1: Invalid Environment Variables (MOST LIKELY)

Your app is **crashing on startup** because of placeholder values:

- `STRIPE_SECRET_KEY = sk_test_replace` ❌ (not a valid key)
- `JWT_SECRET = replace-with-jwt-secret` ❌ (might cause issues)
- `STRIPE_WEBHOOK_SECRET = whsec_replace` ❌ (not a valid secret)

**Fix**: Replace ALL placeholder values with real ones (see below)

### Issue #2: Database Connection Failing

If `DATABASE_URL` is wrong or database is unreachable, the app might crash.

**Fix**: Verify `DATABASE_URL` is correct in Railway Variables

### Issue #3: App Starting Too Slow

Railway healthcheck times out before app is ready.

**Fix**: Already configured in `railway.toml` (healthcheckTimeout = 10s)

---

## 🎯 Step-by-Step Fix

### Step 1: Fix Environment Variables (DO THIS FIRST)

In Railway → puretask-backend → Variables tab:

1. **JWT_SECRET**
   - Current: `replace-with-jwt-secret`
   - Fix: Generate new one:
     ```powershell
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Replace the value

2. **STRIPE_SECRET_KEY**
   - Current: `sk_test_replace`
   - Fix: Get from https://dashboard.stripe.com/test/apikeys
   - Copy the "Secret key" (starts with `sk_test_`)
   - Replace the value

3. **STRIPE_WEBHOOK_SECRET**
   - Current: `whsec_replace`
   - Fix: Set up webhook first (see Step 2), then get secret
   - Or use a temporary value for now: `whsec_test_placeholder`
   - Replace the value

4. **N8N_WEBHOOK_SECRET**
   - Current: `replace-with-n8n-hmac-secret`
   - Fix: Generate new one:
     ```powershell
     node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
     ```
   - Replace the value

### Step 2: Verify DATABASE_URL

1. Click **Postgres** service
2. Go to **Variables** tab
3. Copy `DATABASE_URL`
4. Go back to **puretask-backend** → **Variables**
5. Make sure `DATABASE_URL` matches exactly

### Step 3: Check Railway Logs

1. Click **puretask-backend** service
2. Go to **Logs** tab
3. Look for errors like:
   - "Missing required environment variable"
   - "Database connection failed"
   - "Invalid Stripe key"
   - Any red error messages

### Step 4: Redeploy

1. After fixing variables, click **"Redeploy"** button
2. Watch the **Logs** tab
3. You should see: `🚀 PureTask Backend running on port XXXX`
4. Healthcheck should pass after 10-30 seconds

---

## 🔍 How to Diagnose

### Check 1: Is the app starting?

**In Railway Logs**, look for:
```
🚀 PureTask Backend running on port XXXX
```

**If you see this**: App is starting ✅
**If you DON'T see this**: App is crashing ❌

### Check 2: What error is showing?

**Common errors in logs:**

1. **"Missing required environment variable: STRIPE_SECRET_KEY"**
   - Fix: Set `STRIPE_SECRET_KEY` to a real value (not `sk_test_replace`)

2. **"Database connection failed"**
   - Fix: Check `DATABASE_URL` is correct

3. **"Invalid Stripe key"**
   - Fix: `STRIPE_SECRET_KEY` must start with `sk_test_` or `sk_live_`

4. **"Port already in use"**
   - Fix: Railway handles this automatically, but check logs

### Check 3: Test health endpoint manually

After deployment, test:
```powershell
curl https://your-railway-url.railway.app/health
```

**Should return:**
```json
{
  "ok": true,
  "status": "ok",
  "service": "puretask-backend",
  ...
}
```

---

## 🎯 Quick Fix Checklist

- [ ] Replace `JWT_SECRET` placeholder with generated value
- [ ] Replace `STRIPE_SECRET_KEY` placeholder with real Stripe key
- [ ] Replace `STRIPE_WEBHOOK_SECRET` placeholder (can use temp value for now)
- [ ] Replace `N8N_WEBHOOK_SECRET` placeholder with generated value
- [ ] Verify `DATABASE_URL` is correct
- [ ] Click **"Redeploy"**
- [ ] Check **Logs** tab for startup message
- [ ] Wait 30 seconds
- [ ] Service should turn green ✅

---

## 🆘 Still Not Working?

### Option A: Check Logs for Exact Error

1. Railway → puretask-backend → **Logs** tab
2. Look for red error messages
3. Copy the error and share it

### Option B: Test Locally First

Make sure your app works locally:

```powershell
# Set environment variables locally
$env:DATABASE_URL="your-database-url"
$env:JWT_SECRET="test-secret"
$env:STRIPE_SECRET_KEY="sk_test_..."
# ... etc

# Run locally
npm run build
npm start
```

If it works locally but not on Railway, it's an environment variable issue.

### Option C: Disable Healthcheck Temporarily

**Only for debugging!**

1. Railway → puretask-backend → **Settings** → **Healthcheck**
2. Uncheck **"Enable healthcheck"**
3. Redeploy
4. Check if service starts (it should)
5. Re-enable healthcheck after fixing

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Service status turns **green** ("Online")
2. ✅ Logs show: `🚀 PureTask Backend running on port XXXX`
3. ✅ No red errors in logs
4. ✅ `curl /health` returns 200 OK
5. ✅ Railway dashboard shows "Deployment successful"

---

**Most likely fix**: Replace the 4 placeholder environment variables with real values, then redeploy! 🚀

