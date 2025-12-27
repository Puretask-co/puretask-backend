# 🚀 Railway Deployment Fix - Complete Checklist

## ✅ Track A: Environment Variables (REQUIRED)

### Step 1: Update These 4 Variables in Railway

Go to: **Railway → puretask-backend → Variables tab**

Update these variables (click each one → Edit → Paste value → Save):

#### 1. JWT_SECRET
```
1afe98b72ccc5e3b47edd50a449c69903c605b5eaecd6e3c4bbebc5dc59a7f2e
```

#### 2. N8N_WEBHOOK_SECRET
```
44e7afb06c4f55d32042845f0af6a64a
```

#### 3. STRIPE_WEBHOOK_SECRET (temporary)
```
whsec_test_18ddb5831df423a68b55f81eb9488f9d2d94382c
```
⚠️ Replace with real secret after setting up Stripe webhook

#### 4. STRIPE_SECRET_KEY (YOU MUST GET THIS FROM STRIPE)
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the "Secret key" (starts with `sk_test_`)
3. Paste into Railway: `STRIPE_SECRET_KEY`

---

## ✅ Track B: Verify Server Code (ALREADY CORRECT!)

### Your Code is Already Correct! ✅

I verified your code:

**✅ Server listens on `process.env.PORT`:**
- File: `src/index.ts` line 227-229
- Code: `const PORT = env.PORT; app.listen(PORT, ...)`
- ✅ **CORRECT** - Uses environment variable

**✅ `/health` endpoint exists and returns 200:**
- File: `src/routes/health.ts` line 14-23
- Code: `healthRouter.get("/", (_req, res) => { res.json({ ok: true, ... }) })`
- ✅ **CORRECT** - Returns 200 OK

**✅ Health endpoint is mounted:**
- File: `src/index.ts` line 144
- Code: `app.use("/health", healthRouter);`
- ✅ **CORRECT** - Mounted at `/health`

### No Code Changes Needed! 🎉

Your server code is **already correct**. The healthcheck failure is because:
1. ❌ Invalid environment variables cause app to crash on startup
2. ❌ App never reaches the point where it can respond to `/health`

**Fix Track A first, then Track C.**

---

## ✅ Track C: Redeploy After Fixing Variables

### Step 1: After Updating All 4 Variables

1. Go to **Railway → puretask-backend**
2. Click **"Redeploy"** button (or go to **Deployments** tab → **Redeploy**)

### Step 2: Watch the Logs

1. Click **"Logs"** tab
2. You should see:
   ```
   🚀 PureTask Backend running on port XXXX
   ```
3. After 10-30 seconds, service should turn **green** ("Online")

### Step 3: Verify Health Endpoint

After deployment, test:
```powershell
curl https://your-railway-url.railway.app/health
```

**Expected response:**
```json
{
  "ok": true,
  "status": "ok",
  "service": "puretask-backend",
  ...
}
```

---

## 🎯 Complete Action Plan

### Do This Now (5 minutes):

1. ✅ **Update 4 variables in Railway** (Track A)
   - JWT_SECRET
   - N8N_WEBHOOK_SECRET
   - STRIPE_WEBHOOK_SECRET (temp)
   - STRIPE_SECRET_KEY (get from Stripe)

2. ✅ **Verify code** (Track B)
   - ✅ Already correct - no changes needed!

3. ✅ **Redeploy** (Track C)
   - Click "Redeploy" in Railway
   - Watch Logs tab
   - Service should turn green

---

## 🆘 Troubleshooting

### If Healthcheck Still Fails:

**Check 1: Are variables set correctly?**
- Railway → Variables tab
- Verify all 4 variables have real values (not placeholders)

**Check 2: Check Logs for errors**
- Railway → Logs tab
- Look for red error messages
- Common errors:
  - "Missing required environment variable"
  - "Invalid Stripe key"
  - "Database connection failed"

**Check 3: Test health endpoint manually**
```powershell
curl https://your-railway-url.railway.app/health
```
- If this works but Railway healthcheck fails → Railway config issue
- If this fails → App is not running

**Check 4: Verify PORT is set**
- Railway automatically sets `PORT`
- Your code uses `env.PORT` which reads `process.env.PORT`
- ✅ This is correct

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Service status: **Green** ("Online")
2. ✅ Logs show: `🚀 PureTask Backend running on port XXXX`
3. ✅ No red errors in logs
4. ✅ `curl /health` returns 200 OK
5. ✅ Railway dashboard shows "Deployment successful"

---

## 📋 Quick Reference

**Generated Secrets:**
- JWT_SECRET: `1afe98b72ccc5e3b47edd50a449c69903c605b5eaecd6e3c4bbebc5dc59a7f2e`
- N8N_WEBHOOK_SECRET: `44e7afb06c4f55d32042845f0af6a64a`
- STRIPE_WEBHOOK_SECRET: `whsec_test_18ddb5831df423a68b55f81eb9488f9d2d94382c`

**Get from Stripe:**
- STRIPE_SECRET_KEY: https://dashboard.stripe.com/test/apikeys

**Regenerate secrets:**
```powershell
node scripts/generate-secrets.js
```

---

**Ready?** Start with Track A - update those 4 variables in Railway! 🚀

