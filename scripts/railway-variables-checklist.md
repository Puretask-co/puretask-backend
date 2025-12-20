# 📋 Railway Variables Checklist

## ✅ Generated Secrets (Run `node scripts/generate-secrets.js`)

Copy these values to Railway Variables:

### 1. JWT_SECRET
```
[Generated - see output of generate-secrets.js]
```

### 2. N8N_WEBHOOK_SECRET
```
[Generated - see output of generate-secrets.js]
```

### 3. STRIPE_WEBHOOK_SECRET (Temporary)
```
[Generated - see output of generate-secrets.js]
⚠️ Replace with real secret after setting up Stripe webhook
```

---

## 🔑 Manual Steps (You Need to Do These)

### 4. STRIPE_SECRET_KEY
**You need to get this from Stripe:**
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the "Secret key" (starts with `sk_test_`)
3. Paste into Railway: `STRIPE_SECRET_KEY`

---

## 📝 Quick Copy-Paste Guide

1. **Open Railway Dashboard**
   - Go to: https://railway.app
   - Click: Your project → puretask-backend → Variables tab

2. **For each variable below:**
   - Click the variable name
   - Click edit/pencil icon
   - Paste the new value
   - Click Save

3. **Variables to update:**
   - `JWT_SECRET` = [from generate-secrets.js]
   - `N8N_WEBHOOK_SECRET` = [from generate-secrets.js]
   - `STRIPE_WEBHOOK_SECRET` = [from generate-secrets.js]
   - `STRIPE_SECRET_KEY` = [from Stripe dashboard]

4. **After updating all 4:**
   - Click "Redeploy" button
   - Watch the Logs tab
   - Should see: `🚀 PureTask Backend running on port XXXX`

---

## 🆘 Need Help?

Run this to regenerate secrets:
```powershell
node scripts/generate-secrets.js
```

