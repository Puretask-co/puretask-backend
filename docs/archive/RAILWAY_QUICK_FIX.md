# 🚂 Railway Quick Fix Guide

## ⚠️ **YOU'RE ON THE WRONG SERVICE!**

You're currently looking at **Postgres** database settings.  
We need to configure **`puretask-backend`** service instead.

---

## 🎯 **STEPS TO FIX:**

### **Step 1: Navigate to Backend Service**
1. In Railway Dashboard, look at the **left panel**
2. Find the service card that says **"puretask-backend"** (NOT Postgres)
3. Click on **"puretask-backend"** service

### **Step 2: Go to Settings**
1. Once on `puretask-backend` service page
2. Click the **"Settings"** tab at the top
3. You should see sections like:
   - **Source** (this is what we need to fix!)
   - **Networking**
   - **Build**
   - **Deploy**

### **Step 3: Fix Root Directory**
1. In **Settings** → **Source** section
2. Look for **"Root Directory"** field
3. **Current (WRONG)**: Probably shows `.cursor` or something else
4. **Change to**: `/` or leave it **empty**
5. **Save**

### **Step 4: Verify Build Settings**
In the **Settings** tab, check:

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

## 📋 **WHAT TO LOOK FOR:**

### **✅ CORRECT Service:**
- Service name: **"puretask-backend"**
- Should have GitHub icon (not database icon)
- Should show "Build failed" or deployment status

### **❌ WRONG Service (what you're on now):**
- Service name: **"Postgres"** or **"Postgres-Tjpv"**
- Has database/elephant icon
- This is just the database, not your app

---

## 🔍 **FINDING THE BACKEND SERVICE:**

In the **left panel** of Railway:
- Look for a service with:
  - GitHub/Code icon (not database icon)
  - Name like "puretask-backend" or "backend"
  - May show "Build failed" or "Failed" status
  - Has a yellow warning icon

---

## ⚡ **QUICK CHECKLIST:**

- [ ] Navigated to **puretask-backend** service (NOT Postgres)
- [ ] Clicked **Settings** tab
- [ ] Found **Source** section
- [ ] Changed **Root Directory** to `/` or empty
- [ ] Verified **Build Command**: `npm ci && npm run build`
- [ ] Verified **Start Command**: `npm start`
- [ ] Saved changes
- [ ] Triggered redeploy

---

**The main issue: You need to be on the `puretask-backend` service, not the Postgres service!** 🎯
