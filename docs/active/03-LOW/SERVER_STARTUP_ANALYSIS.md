# Server Startup Issues - Comprehensive Analysis

**Date:** 2026-01-28  
**Status:** 🔴 Issues Identified - Solutions Provided

**What this doc is for:** Use it when the backend or frontend fails to start (e.g. import errors, module resolution, port conflicts). It documents (1) what was broken, (2) root cause (e.g. working directory, Tailwind v4 resolution), and (3) fixes and workarounds. Update it when you hit new startup issues so the next person has a single troubleshooting hub.

**Why it matters:** Startup failures are common after clone or dependency changes. This doc shortens debugging time and avoids repeating the same fixes.

**What it is:** A troubleshooting doc for backend and frontend startup failures (import errors, module resolution, port conflicts).  
**What it does:** Documents what was broken, root cause, and fixes so we don't repeat the same debugging.  
**How we use it:** When the app won't start, open this doc; use Executive Summary and Critical Issues; update when you hit new issues.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Executive Summary

### Backend Status: ✅ **WORKING**
- Backend server starts successfully on port **4000**
- All critical import errors have been fixed
- Server is listening and operational

### Frontend Status: 🔴 **FAILING**
**What it is:** Frontend status (fails due to Tailwind v4 resolution).  
**What it does:** Confirms frontend is currently broken and why.  
**How we use it:** If frontend won't start, see Issue #1 below for fix/workaround.

- Frontend fails to start due to Tailwind CSS v4 module resolution error
- Error: `Can't resolve 'tailwindcss' in 'C:\Users\onlyw\Documents\GitHub'`
- Frontend configured to run on port **3001** (not 3000)

---

## 🔴 Critical Issues

**What it is:** The list of known startup blockers (e.g. Frontend Tailwind resolution).  
**What it does:** Documents root cause and fix for each so we can resolve or work around.  
**How we use it:** Find the issue that matches your error; follow the fix; update if you find a new root cause.

### Issue #1: Frontend Tailwind CSS v4 Module Resolution Error
**What it is:** The frontend build failing because it can't resolve the `tailwindcss` module.  
**What it does:** Explains why and how to fix (working directory, install, or downgrade).  
**How we use it:** Ensure you're in the frontend directory; run npm install; or follow the workaround in the doc.

**Error Message:**
```
Error: Can't resolve 'tailwindcss' in 'C:\Users\onlyw\Documents\GitHub'
    [at finishWithoutResolve ...]
    details: "resolve 'tailwindcss' in 'C:\\Users\\onlyw\\Documents\\GitHub'\n" +
      '  Parsed request is a module\n' +
      '  No description file found in C:\\Users\\onlyw\\Documents\\GitHub or above\n'
```

**Root Cause:**
- Next.js is trying to resolve `tailwindcss` from the **parent directory** (`C:\Users\onlyw\Documents\GitHub`) instead of from the frontend project directory (`C:\Users\onlyw\Documents\GitHub\puretask-frontend`)
- This is a **module resolution path issue**, likely caused by:
  1. Working directory not being set correctly when starting the server
  2. Next.js/Turbopack module resolution configuration issue
  3. Tailwind CSS v4 requires different configuration than v3

**Current Configuration:**
- **Tailwind CSS Version:** v4.1.18 (latest)
- **PostCSS Config:** `postcss.config.mjs` uses `@tailwindcss/postcss` plugin
- **CSS Import:** `globals.css` uses `@import "tailwindcss";` (v4 syntax)
- **Dependencies:** Both `tailwindcss@4.1.18` and `@tailwindcss/postcss@4.1.18` are installed

**Files Involved:**
- `C:\Users\onlyw\Documents\GitHub\puretask-frontend\postcss.config.mjs`
- `C:\Users\onlyw\Documents\GitHub\puretask-frontend\tailwind.config.ts`
- `C:\Users\onlyw\Documents\GitHub\puretask-frontend\src\app\globals.css`
- `C:\Users\onlyw\Documents\GitHub\puretask-frontend\next.config.ts`

---

## ✅ Backend Analysis

### Status: **WORKING CORRECTLY**

**Startup Sequence:**
1. ✅ Environment variables loaded (`dotenv.config()`)
2. ✅ Required env vars validated (throws if missing)
3. ✅ Express app initialized
4. ✅ Middleware loaded (security, CORS, rate limiting)
5. ✅ Routes loaded successfully
6. ✅ Redis initialization (non-blocking, falls back if fails)
7. ✅ HTTP server started on port **4000**

**Previous Issues (Now Fixed):**
- ✅ Missing `asyncHandler` import in `src/routes/jobs.ts` - **FIXED**
- ✅ Missing `sendError` import in `src/routes/jobs.ts` - **FIXED**
- ✅ Missing `try` block in route handler - **FIXED**

**Current Configuration:**
- **Port:** 4000 (default)
- **Dev Command:** `ts-node-dev --respawn --transpile-only src/index.ts`
- **Node Version:** >=20.0.0
- **Status:** ✅ Server running and listening

---

## 🔧 Solutions & Fixes

### Solution #1: Fix Frontend Working Directory Issue

**Problem:** Server may be starting from wrong directory

**Fix:** Ensure we're in the frontend directory when starting:
```powershell
Set-Location "C:\Users\onlyw\Documents\GitHub\puretask-frontend"
npm run dev
```

**Verification:**
```powershell
# Check current directory
Get-Location
# Should output: C:\Users\onlyw\Documents\GitHub\puretask-frontend
```

---

### Solution #2: Verify Tailwind CSS v4 Configuration

**Check PostCSS Config:**
The `postcss.config.mjs` should be:
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**Check Tailwind Config:**
The `tailwind.config.ts` should import from `tailwindcss`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // ... rest of config
};

export default config;
```

**Check CSS Import:**
The `globals.css` should use v4 syntax:
```css
@import "tailwindcss";
```

---

### Solution #3: Reinstall Dependencies (If Needed)

If module resolution still fails, try:
```powershell
Set-Location "C:\Users\onlyw\Documents\GitHub\puretask-frontend"
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

---

### Solution #4: Check Next.js Configuration

**Current `next.config.ts`:**
```typescript
const nextConfig = {
  async redirects() {
    return [];
  },
};
```

**Potential Fix - Add Module Resolution:**
```typescript
const nextConfig = {
  async redirects() {
    return [];
  },
  // Ensure module resolution works correctly
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};
```

**Note:** This may not be necessary if the working directory issue is fixed.

---

### Solution #5: Verify Port Configuration

**Backend:** Port 4000 ✅  
**Frontend:** Port 3001 (configured in `package.json`)

**Note:** Frontend runs on **3001**, not 3000. This is intentional to avoid conflicts.

**Backend expects frontend on:** Port 3000 (from `FRONTEND_URL` env var default)

**Potential Issue:** Mismatch between:
- Frontend actual port: **3001**
- Backend expected frontend URL: **http://localhost:3000**

**Fix Options:**
1. Change frontend to port 3000: `"dev": "next dev -p 3000"`
2. Update backend `FRONTEND_URL` env var to `http://localhost:3001`

---

## 📋 Verification Checklist

### Backend ✅
- [x] Server starts without errors
- [x] Listening on port 4000
- [x] All imports resolved correctly
- [x] Environment variables loaded
- [x] Routes accessible

### Frontend 🔴
- [ ] Server starts without errors
- [ ] Module resolution works correctly
- [ ] Tailwind CSS compiles
- [ ] Listening on port 3001 (or 3000)
- [ ] Can access frontend URL

---

## 🚀 Recommended Next Steps

1. **Stop all running servers**
2. **Verify working directory** before starting frontend
3. **Start backend** from `puretask-backend` directory
4. **Start frontend** from `puretask-frontend` directory
5. **Check ports** 4000 and 3001 are listening
6. **Test frontend** by accessing `http://localhost:3001`
7. **Update backend FRONTEND_URL** if frontend stays on 3001

---

## 🔍 Debugging Commands

### Check Port Status
```powershell
Get-NetTCPConnection -LocalPort 4000,3001 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
```

### Check Node Processes
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime
```

### Verify Dependencies
```powershell
# Backend
Set-Location "C:\Users\onlyw\Documents\GitHub\puretask-backend"
npm ls --depth=0

# Frontend
Set-Location "C:\Users\onlyw\Documents\GitHub\puretask-frontend"
npm ls tailwindcss @tailwindcss/postcss --depth=0
```

### Check Working Directory
```powershell
Get-Location
# Should be in the project directory when starting server
```

---

## 📝 Notes

- **Tailwind CSS v4** uses different syntax and configuration than v3
- **Next.js 16.1.1** with Turbopack may have different module resolution behavior
- **Port mismatch** between frontend (3001) and backend expectation (3000) needs resolution
- **Working directory** is critical for module resolution in Node.js/Next.js

---

**Last Updated:** 2026-01-28  
**Analysis By:** Auto (AI Assistant)
