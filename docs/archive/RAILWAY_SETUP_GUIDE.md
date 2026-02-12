# 🚂 Railway Setup Guide

## 📋 **CONFIGURATION FILES**

### ✅ **Already Configured:**
- `railway.json` - Railway deployment configuration
- `railway.toml` - Alternative Railway configuration
- `package.json` - Build and start scripts

---

## 🔧 **RAILWAY DASHBOARD SETTINGS**

### **1. Service Settings → Source**

**Root Directory:**
- Should be: `/` or empty (NOT `.cursor`)
- This is the main issue causing build failures

**Build Command:**
```
npm ci && npm run build
```

**Start Command:**
```
npm start
```

**Health Check Path:**
```
/health
```

---

### **2. Environment Variables**

Add these in Railway Dashboard → Service → Variables:

#### **Required:**
```
DATABASE_URL=postgresql://... (from Neon)
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=4000 (or Railway will auto-assign)
```

#### **Stripe:**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### **Twilio:**
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

#### **SendGrid:**
```
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@puretask.com
```

#### **Redis (if using):**
```
REDIS_URL=redis://...
```

#### **n8n:**
```
N8N_WEBHOOK_URL=https://...
```

#### **Frontend URL:**
```
FRONTEND_URL=https://your-frontend-domain.com
```

#### **OneSignal (if using):**
```
ONESIGNAL_APP_ID=...
ONESIGNAL_API_KEY=...
```

---

### **3. Service Settings → Deploy**

**Deployment Settings:**
- **Restart Policy**: ON_FAILURE
- **Max Retries**: 10
- **Health Check Timeout**: 100 seconds
- **Sleep Application**: false

---

## 📝 **STEP-BY-STEP SETUP**

### **Step 1: Fix Root Directory**
1. Go to Railway Dashboard
2. Select `puretask-backend` service
3. Click **Settings** → **Source**
4. Check **Root Directory** field
5. If it shows `.cursor`, change to `/` or leave empty
6. Save

### **Step 2: Set Environment Variables**
1. Go to **Variables** tab
2. Add all required environment variables (see list above)
3. Use values from your local `.env` file
4. Save

### **Step 3: Verify Build Settings**
1. Go to **Settings** → **Deploy**
2. Verify:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check: `/health`

### **Step 4: Trigger Redeploy**
1. Go to **Deployments** tab
2. Click **Redeploy** or push to GitHub (if connected)
3. Watch build logs for errors

---

## 🔍 **VERIFY DEPLOYMENT**

### **Check Build Logs:**
- Should see: `npm ci` running
- Should see: `npm run build` (TypeScript compilation)
- Should see: `npm start` (server starting)

### **Check Health:**
```
https://puretask-backend-production.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "puretask-backend"
}
```

---

## ⚠️ **COMMON ISSUES**

### **Issue: "Cannot find module"**
- **Fix**: Make sure all dependencies are in `package.json`
- **Fix**: Railway uses `npm ci` which requires `package-lock.json`

### **Issue: "Build failed"**
- **Fix**: Check Root Directory is `/` not `.cursor`
- **Fix**: Verify `package.json` has `build` and `start` scripts

### **Issue: "Port already in use"**
- **Fix**: Railway auto-assigns PORT, use `process.env.PORT` in code

### **Issue: "Database connection failed"**
- **Fix**: Verify `DATABASE_URL` is set correctly
- **Fix**: Check Neon database allows Railway IPs

---

## 📦 **DEPENDENCIES CHECKLIST**

Make sure these are in `package.json`:
- ✅ `express`
- ✅ `typescript`
- ✅ `ts-node` (dev)
- ✅ `@types/node`
- ✅ `pg` (PostgreSQL)
- ✅ `stripe`
- ✅ `twilio`
- ✅ `@sendgrid/mail`
- ✅ `multer` (just installed)
- ✅ `uuid` (just installed)
- ✅ All other dependencies

---

## 🚀 **QUICK SETUP COMMANDS**

If you have Railway CLI installed:

```bash
# Login
railway login

# Link project
railway link

# Set variables
railway variables set DATABASE_URL=...
railway variables set JWT_SECRET=...

# Deploy
railway up
```

---

**Main fix needed: Change Root Directory from `.cursor` to `/` in Railway Dashboard!** 🎯
