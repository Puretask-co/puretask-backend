# 🔗 Connecting Frontend & Backend - Complete Guide

## 📋 Overview

This guide shows you exactly how to connect your PureTask frontend and backend together, whether running locally or in production.

---

## 🎯 Connection Checklist

- [ ] Backend CORS configured
- [ ] Frontend API URL set
- [ ] Environment variables configured
- [ ] Authentication working
- [ ] WebSocket connection established
- [ ] Test the connection

---

## 1️⃣ BACKEND SETUP (API Configuration)

### **A. Configure CORS (Already Done ✅)**

Your backend already has CORS configured in `src/index.ts`:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
```

### **B. Set Environment Variables**

Create/update your backend `.env` file:

```env
# Backend Configuration
PORT=3001
NODE_ENV=production

# Database (Neon)
DATABASE_URL=your_neon_connection_string

# Frontend URL (IMPORTANT!)
FRONTEND_URL=http://localhost:3000  # Local development
# FRONTEND_URL=https://your-app.vercel.app  # Production

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Session Secret
SESSION_SECRET=your_session_secret_here

# Rate Limiting (Optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **C. Verify Backend is Running**

```bash
# Start backend
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev

# Should see:
# ✅ Server running on port 3001
# ✅ Database connected
```

---

## 2️⃣ FRONTEND SETUP (API Connection)

### **A. Configure API Base URL**

Your frontend needs to know where the backend is!

**Option 1: Environment Variable (Recommended)**

Create/update `puretask-frontend/.env.local`:

```env
# Local Development
NEXT_PUBLIC_API_URL=http://localhost:3001

# OR for Production
# NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

**Option 2: Direct Configuration**

Find your API client file (usually `src/lib/api.ts` or `src/services/api.ts`):

```typescript
// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### **B. Verify Frontend Configuration**

```bash
# Start frontend
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev

# Should see:
# ✅ Ready on http://localhost:3000
```

---

## 3️⃣ TEST THE CONNECTION

### **Quick Connection Test**

**1. Open your browser:** http://localhost:3000

**2. Open DevTools Console (F12)**

**3. Run this test:**

```javascript
// Test 1: Check API connection
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(data => console.log('✅ Backend connected:', data))
  .catch(err => console.error('❌ Connection failed:', err));

// Test 2: Check CORS
fetch('http://localhost:3001/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@test.com',
    password: 'Test123!',
    role: 'client'
  })
})
  .then(r => r.json())
  .then(data => console.log('✅ CORS working:', data))
  .catch(err => console.error('❌ CORS issue:', err));
```

### **Full User Flow Test**

**1. Go to:** http://localhost:3000/register

**2. Register a new account**
- Email: `testuser@example.com`
- Password: `Test123!`
- Role: Client

**3. Check if:**
- ✅ Registration works
- ✅ Token is stored
- ✅ Redirects to dashboard
- ✅ User data loads

**4. Try logging out and back in**

---

## 4️⃣ DEPLOYMENT CONNECTION

### **When Both are Deployed:**

#### **Step 1: Deploy Backend First**

Deploy to Railway/Render, get your backend URL:
```
https://puretask-backend.railway.app
```

#### **Step 2: Update Backend Environment**

In Railway/Render dashboard, set:
```env
FRONTEND_URL=https://puretask-frontend.vercel.app
```

#### **Step 3: Update Frontend Environment**

In Vercel/Netlify dashboard, set:
```env
NEXT_PUBLIC_API_URL=https://puretask-backend.railway.app
```

#### **Step 4: Redeploy Frontend**

Vercel/Netlify will automatically redeploy with new API URL.

---

## 5️⃣ COMMON CONNECTION ISSUES & FIXES

### **❌ Issue 1: CORS Error**

```
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Fix:**
```typescript
// Backend: src/index.ts
app.use(cors({
  origin: 'http://localhost:3000',  // Add your frontend URL
  credentials: true
}));
```

---

### **❌ Issue 2: 404 Not Found**

```
GET http://localhost:3001/api/users 404 (Not Found)
```

**Fix:** Check your API routes
- ❌ Wrong: `/api/users`
- ✅ Correct: `/users` (no `/api` prefix in our backend)

---

### **❌ Issue 3: Authentication Not Working**

```
401 Unauthorized
```

**Fix:** Make sure cookies are being sent
```typescript
// Frontend API client
axios.create({
  baseURL: API_URL,
  withCredentials: true,  // ← IMPORTANT!
});
```

---

### **❌ Issue 4: Environment Variables Not Loading**

**Fix for Next.js:**
1. Variable MUST start with `NEXT_PUBLIC_`
2. Restart dev server after changing `.env.local`
3. Clear Next.js cache: `rm -rf .next`

---

## 6️⃣ VERIFICATION CHECKLIST

Run through this checklist to ensure everything is connected:

### **Backend Checks:**
- [ ] Server is running
- [ ] Database is connected
- [ ] `/health` endpoint returns 200
- [ ] CORS is configured with frontend URL
- [ ] Environment variables are loaded

### **Frontend Checks:**
- [ ] Dev server is running
- [ ] `NEXT_PUBLIC_API_URL` is set
- [ ] API calls are going to correct URL (check Network tab)
- [ ] No CORS errors in console

### **Integration Checks:**
- [ ] Can register a new user
- [ ] Can login with credentials
- [ ] Token is stored in localStorage/cookies
- [ ] Protected routes work
- [ ] Can fetch user data
- [ ] Can create/update/delete resources

---

## 7️⃣ QUICK TROUBLESHOOTING

### **Check Backend is Accessible**

```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T..."
}
```

### **Check Frontend is Making Correct Calls**

1. Open http://localhost:3000
2. Open DevTools (F12) → Network tab
3. Try to login/register
4. Check the request URL - should be `http://localhost:3001/auth/...`

### **Check Environment Variables**

**Backend:**
```bash
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
node -e "console.log(process.env.FRONTEND_URL)"
```

**Frontend:**
```bash
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
# In browser console
console.log(process.env.NEXT_PUBLIC_API_URL)
```

---

## 8️⃣ ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                    http://localhost:3000                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Requests
                             │ (with credentials)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS FRONTEND                            │
│  • API Client (Axios/Fetch)                                      │
│  • State Management (Zustand)                                    │
│  • Auth Token Storage                                            │
│  • ENV: NEXT_PUBLIC_API_URL=http://localhost:3001               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ API Calls
                             │ (JSON + JWT Token)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS BACKEND                            │
│                   http://localhost:3001                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CORS Middleware                                            │ │
│  │ • Allows: http://localhost:3000                            │ │
│  │ • Credentials: true                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ JWT Auth Middleware                                        │ │
│  │ • Validates tokens                                         │ │
│  │ • Attaches user to request                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Routes                                                 │ │
│  │ • /auth (login, register)                                  │ │
│  │ • /users                                                   │ │
│  │ • /jobs                                                    │ │
│  │ • /cleaner                                                 │ │
│  │ • /search                                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ SQL Queries
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NEON POSTGRESQL DATABASE                      │
│  • Users, Jobs, Messages, Reviews, etc.                         │
│  • Connection: DATABASE_URL from .env                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9️⃣ PRODUCTION DEPLOYMENT URLS

Once deployed, your architecture will look like:

```
USER
  ↓
VERCEL (Frontend)
  https://puretask.vercel.app
  ENV: NEXT_PUBLIC_API_URL=https://puretask-backend.railway.app
  ↓
RAILWAY (Backend)
  https://puretask-backend.railway.app
  ENV: FRONTEND_URL=https://puretask.vercel.app
  ↓
NEON (Database)
  postgresql://...neon.tech/puretask
```

---

## 🎯 NEXT STEPS

Once connection is verified:

1. **Test all major features:**
   - User registration/login
   - Job creation
   - Booking flow
   - Messaging
   - Payments

2. **Deploy to production:**
   - Follow `DEPLOYMENT_PREPARATION_GUIDE.md`
   - Update environment variables
   - Test production connection

3. **Monitor & optimize:**
   - Check server logs
   - Monitor API response times
   - Set up error tracking

---

## 📞 NEED HELP?

If you're stuck, tell me:
1. What you're trying to do
2. What error you're seeing
3. Show me your `.env` files (hide secrets!)

I'll help you debug! 🚀

