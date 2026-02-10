# 🎓 PureTask Complete Understanding - Quick Reference

**Everything you need to know in one place**

---

## 📊 The 3-Layer Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    1. FRONTEND                            │
│              http://localhost:3000                        │
│                                                           │
│  WHAT IT IS:  The user interface (what you see)          │
│  TECHNOLOGY:  Next.js + React + TypeScript                │
│  LOCATION:    C:\...\puretask-frontend\                  │
│                                                           │
│  RESPONSIBILITIES:                                        │
│  ✓ Display pages and components                          │
│  ✓ Handle user clicks and interactions                   │
│  ✓ Show forms and collect input                          │
│  ✓ Make API calls to backend                             │
│  ✓ Display data from backend                             │
│                                                           │
│  KEY FILES:                                               │
│  • src/app/page.tsx - Pages                              │
│  • src/components/* - UI components                       │
│  • src/lib/api.ts - API client                           │
│  • .env.local - Config (API URL)                         │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ HTTP Requests (JSON + JWT Token)
                        │ "Hey backend, create a booking!"
                        ↓
┌───────────────────────────────────────────────────────────┐
│                    2. BACKEND                             │
│              http://localhost:4000                        │
│                                                           │
│  WHAT IT IS:  The business logic (the brain)             │
│  TECHNOLOGY:  Node.js + Express + TypeScript              │
│  LOCATION:    C:\...\puretask-backend\                   │
│                                                           │
│  RESPONSIBILITIES:                                        │
│  ✓ Authenticate users (login, register)                  │
│  ✓ Validate all data                                     │
│  ✓ Apply business rules (pricing, availability)          │
│  ✓ Process payments (Stripe)                             │
│  ✓ Send emails and notifications                         │
│  ✓ Talk to database                                      │
│  ✓ Protect sensitive operations                          │
│                                                           │
│  KEY FILES:                                               │
│  • src/index.ts - Main entry point                       │
│  • src/routes/* - API endpoints                          │
│  • src/services/* - Business logic                       │
│  • src/middleware/auth.ts - Security                     │
│  • .env - Config (DATABASE_URL, JWT_SECRET)              │
└───────────────────────┬───────────────────────────────────┘
                        │
                        │ SQL Queries
                        │ "SELECT * FROM jobs WHERE..."
                        ↓
┌───────────────────────────────────────────────────────────┐
│                    3. DATABASE                            │
│              PostgreSQL on Neon                           │
│                                                           │
│  WHAT IT IS:  Permanent data storage                     │
│  TECHNOLOGY:  PostgreSQL (SQL database)                   │
│  LOCATION:    Cloud (Neon.tech)                          │
│                                                           │
│  RESPONSIBILITIES:                                        │
│  ✓ Store all data permanently                            │
│  ✓ Maintain relationships between data                   │
│  ✓ Ensure data integrity                                 │
│  ✓ Provide fast queries                                  │
│                                                           │
│  KEY TABLES:                                              │
│  • users - All user accounts                             │
│  • jobs - All bookings                                   │
│  • messages - Chat messages                              │
│  • payments - Payment records                            │
│  • reviews - Ratings & reviews                           │
│                                                           │
│  KEY FILES:                                               │
│  • DB/schema.sql - Database structure                    │
│  • DB/migrations/* - Database changes                    │
└───────────────────────────────────────────────────────────┘
```

---

## 🔄 How Data Flows (Real Example)

### Example: User Books a Cleaner

```
STEP 1: USER ACTION (Frontend)
   📱 User fills out booking form
   📍 File: src/components/features/BookingForm.tsx
   🔄 User clicks "Book Now" button

      ↓

STEP 2: FRONTEND PROCESSING
   📍 File: src/hooks/useBookings.ts
   🔄 validateForm() - Check all fields are filled
   🔄 setLoading(true) - Show loading spinner
   🔄 api.post('/jobs', data) - Call backend

      ↓

STEP 3: API CALL SENT
   📍 File: src/lib/api.ts
   📨 POST http://localhost:4000/jobs
   📋 Headers: { Authorization: "Bearer eyJhbGc..." }
   📋 Body: { cleaner_id: "abc", date: "2026-01-15", service: "deep-clean" }

      ↓

STEP 4: BACKEND RECEIVES REQUEST
   📍 File: src/index.ts
   ✅ CORS check
   ✅ Parse JSON body
   ✅ Route to /jobs handler

      ↓

STEP 5: AUTHENTICATION
   📍 File: src/middleware/auth.ts
   ✅ Extract JWT token from header
   ✅ Verify token is valid
   ✅ Extract user ID from token
   ✅ Attach to request: req.user = { id: "123", role: "client" }

      ↓

STEP 6: ROUTE HANDLER
   📍 File: src/routes/jobs.ts
   🔄 Extract data from req.body
   🔄 Call service: await jobService.createJob(data)

      ↓

STEP 7: BUSINESS LOGIC
   📍 File: src/services/jobService.ts
   ✅ Validate cleaner exists
   ✅ Check cleaner is available on that date
   ✅ Calculate price: calculatePrice("deep-clean") → $150
   ✅ Apply any discounts
   ✅ Validate booking rules (e.g., must be future date)

      ↓

STEP 8: DATABASE WRITE
   📍 File: src/lib/db.ts
   💾 INSERT INTO jobs (client_id, cleaner_id, date, service, price, status)
      VALUES ('123', 'abc', '2026-01-15', 'deep-clean', 150, 'pending')
   💾 Database returns: { id: 'job-789', ... }

      ↓

STEP 9: POST-CREATION TASKS
   📍 File: src/services/jobService.ts
   📧 Send email to client: "Booking confirmed!"
   📧 Send notification to cleaner: "New booking request"
   📝 Log the transaction

      ↓

STEP 10: BACKEND RESPONDS
   📍 File: src/routes/jobs.ts
   📨 Status: 201 Created
   📋 Body: {
        success: true,
        job: {
          id: "job-789",
          cleaner_id: "abc",
          date: "2026-01-15",
          service: "deep-clean",
          price: 150,
          status: "pending"
        }
      }

      ↓

STEP 11: FRONTEND RECEIVES RESPONSE
   📍 File: src/hooks/useBookings.ts
   ✅ setLoading(false) - Hide spinner
   ✅ addBooking(job) - Add to local state
   ✅ Navigate to booking page

      ↓

STEP 12: UI UPDATE
   📍 File: src/app/booking/[id]/page.tsx
   🎉 Show success message: "Booking confirmed!"
   📋 Display booking details
   🔔 User sees their new booking
```

**Total time: ~500ms**

---

## 🎯 Where to Make Different Types of Changes

### Quick Decision Guide

| I Want To... | Edit Where | Files to Change |
|-------------|------------|-----------------|
| **Change a color** | Frontend | `tailwind.config.js` |
| **Change text on a page** | Frontend | `src/app/[page]/page.tsx` |
| **Add a button** | Frontend | Component file |
| **Add a form field** | Frontend + Backend + DB | 1. Migration 2. Backend route 3. Frontend form |
| **Change pricing** | Backend | `src/services/jobService.ts` |
| **Add authentication** | Backend | `src/middleware/auth.ts` |
| **Add a new page** | Frontend | `src/app/[name]/page.tsx` |
| **Add new API endpoint** | Backend | `src/routes/*.ts` + `src/index.ts` |
| **Change who can access** | Backend | `src/middleware/auth.ts` |
| **Add a database table** | Database + Backend | 1. Migration 2. Update services |
| **Send emails** | Backend | `src/services/emailService.ts` |
| **Change payment amount** | Backend | `src/services/paymentService.ts` |
| **Add real-time feature** | Backend + Frontend | Socket.IO setup |
| **Change logo** | Frontend | `public/images/` + Header component |
| **Add new user role** | Database + Backend | 1. Add to DB 2. Update auth logic |

---

## 📂 Critical Files to Know

### Backend

```
🚀 MUST KNOW
├─ src/index.ts ..................... Starts the server
├─ src/routes/auth.ts ............... Login/register
├─ src/routes/jobs.ts ............... Bookings
├─ src/middleware/auth.ts ........... Security
├─ src/services/jobService.ts ....... Booking logic
├─ src/lib/db.ts .................... Database
└─ .env ............................. Secrets (NEVER commit!)

💡 GOOD TO KNOW
├─ src/lib/security.ts .............. CORS, rate limiting
├─ src/config/env.ts ................ Configuration
└─ DB/schema.sql .................... Database structure
```

### Frontend

```
🚀 MUST KNOW
├─ src/app/page.tsx ................. Home page
├─ src/app/login/page.tsx ........... Login page
├─ src/lib/api.ts ................... API calls
├─ src/hooks/useAuth.ts ............. Auth logic
├─ src/components/ui/Button.tsx ..... Button component
└─ .env.local ....................... Config (API URL)

💡 GOOD TO KNOW
├─ src/store/authStore.ts ........... Global auth state
├─ tailwind.config.js ............... Styling config
└─ next.config.js ................... Next.js config
```

---

## 💬 Key Concepts Explained Simply

### 1. **API Endpoint**

**What:** A URL that the frontend can call to get/send data

**Example:**
```
GET  /jobs      → Get list of bookings
POST /jobs      → Create a booking
GET  /jobs/123  → Get booking #123
PUT  /jobs/123  → Update booking #123
```

**Where defined:** Backend `src/routes/*.ts`

---

### 2. **JWT Token**

**What:** A secure way to prove who you are

**Flow:**
```
1. User logs in → Backend creates token
2. Frontend stores token
3. Frontend sends token with every request
4. Backend verifies token → knows who you are
```

**Example token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJjbGllbnQifQ.xyz
```

**Contains:** User ID, role, expiration time

---

### 3. **Middleware**

**What:** Code that runs BEFORE your route handler

**Example:**
```typescript
// Without middleware
router.get('/jobs', getJobs)

// With middleware
router.get('/jobs', requireAuth, getJobs)
                    ↑
                    Runs first, checks if user is logged in
```

**Common uses:** Authentication, validation, logging

---

### 4. **Component**

**What:** Reusable piece of UI

**Example:**
```typescript
// Button component
<Button>Click me</Button>

// Used in many places
<Button variant="primary">Login</Button>
<Button variant="secondary">Cancel</Button>
```

**Where:** Frontend `src/components/*`

---

### 5. **Hook**

**What:** Reusable React logic

**Example:**
```typescript
// useAuth hook
const { login, logout, user } = useAuth()

// Can be used in any component
function LoginPage() {
  const { login } = useAuth()  // ← Reuse logic
  // ...
}
```

**Where:** Frontend `src/hooks/*`

---

### 6. **Store**

**What:** Global state shared across components

**Example:**
```typescript
// authStore
const user = useAuthStore((state) => state.user)

// Available everywhere - no passing props!
```

**Where:** Frontend `src/store/*`

---

## 🔧 Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db
# ↑ Where your data lives

# JWT
JWT_SECRET=super-secret-key-min-32-chars-long
# ↑ Used to sign tokens (NEVER share!)

# Stripe
STRIPE_SECRET_KEY=sk_test_...
# ↑ Payment processing

# Server
PORT=4000
NODE_ENV=development
```

### Frontend (.env.local)

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:4000
# ↑ Where to send API requests

# Stripe Public Key
NEXT_PUBLIC_STRIPE_KEY=pk_test_...
# ↑ Safe to expose (public key)
```

**⚠️ CRITICAL:** Never commit `.env` files to Git!

---

## 🚀 Common Commands

### Start Development

```powershell
# Backend
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev
# ✅ Backend running on http://localhost:4000

# Frontend (new terminal)
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev
# ✅ Frontend running on http://localhost:3000
```

### Testing

```powershell
# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Database

```powershell
# Run migration
psql $DATABASE_URL -f DB/migrations/001_migration.sql

# Seed test data
npm run seed
```

---

## 🐛 Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| **Port already in use** | Kill process: `netstat -ano \| findstr :4000` then `taskkill /PID xxxx /F` |
| **Can't connect to backend** | 1. Check backend is running<br>2. Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`<br>3. Check CORS settings |
| **Database errors** | 1. Check `DATABASE_URL`<br>2. Run migrations<br>3. Check Neon dashboard |
| **401 Unauthorized** | 1. Check token is being sent<br>2. Check token hasn't expired<br>3. Verify `JWT_SECRET` |
| **CORS errors** | Check backend `src/lib/security.ts` - must allow frontend URL |
| **Module not found** | Run `npm install` |
| **TypeScript errors** | Run `npm run typecheck` to see all errors |

---

## 📚 Learning Resources

### Documentation

- **Next.js:** https://nextjs.org/docs
- **Express.js:** https://expressjs.com/
- **PostgreSQL:** https://www.postgresqltutorial.com/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Tailwind CSS:** https://tailwindcss.com/docs

### Your Project Guides

- **Architecture:** `PURETASK_ARCHITECTURE_EXPLAINED.md`
- **Making Changes:** `MAKING_CHANGES_GUIDE.md`
- **Navigation:** `CODEBASE_NAVIGATION_GUIDE.md`
- **Connection:** `CONNECTING_FRONTEND_BACKEND.md`
- **Deployment:** `DEPLOYMENT_PREPARATION_GUIDE.md`

---

## 🎯 Mental Models

### Think of PureTask Like...

#### A Restaurant 🍽️

- **Frontend** = Dining room (customers order from menu)
- **Backend** = Kitchen (chefs prepare food)
- **Database** = Pantry (ingredients stored)
- **API** = Waiters (carry orders between dining room & kitchen)

#### A Post Office 📮

- **Frontend** = Counter (you drop off package)
- **Backend** = Sorting facility (decides where it goes)
- **Database** = Storage warehouse (keeps packages)
- **API** = Mail routes (how things get delivered)

#### A Bank 🏦

- **Frontend** = ATM (interface you use)
- **Backend** = Bank systems (process transactions)
- **Database** = Vault (stores account data)
- **API** = Commands (withdraw, deposit, check balance)

---

## ✅ Quick Checklist: Understanding PureTask

### Core Concepts

- [ ] I understand frontend vs backend
- [ ] I know how they communicate (API endpoints)
- [ ] I understand what JWT tokens do
- [ ] I know what middleware is
- [ ] I understand the role of the database

### File Structure

- [ ] I can find the backend entry point (`src/index.ts`)
- [ ] I can find where routes are defined (`src/routes/*`)
- [ ] I can find business logic (`src/services/*`)
- [ ] I can find frontend pages (`src/app/*`)
- [ ] I can find UI components (`src/components/*`)

### Making Changes

- [ ] I know where to change colors/styling
- [ ] I know where to change prices
- [ ] I know where to add a new page
- [ ] I know where to add a new API endpoint
- [ ] I know where to change authentication logic

### Running the App

- [ ] I can start the backend server
- [ ] I can start the frontend server
- [ ] I can test API endpoints
- [ ] I can view the app in a browser

---

## 🎉 Final Summary

### The Big Picture

```
PureTask is a 3-tier application:

1️⃣ FRONTEND (Next.js)
   • What users see and click
   • Runs in browser
   • Port 3000
   • Makes API calls to backend

2️⃣ BACKEND (Express.js)
   • Business logic and security
   • Runs on server
   • Port 4000
   • Talks to database

3️⃣ DATABASE (PostgreSQL)
   • Stores all data
   • Runs on Neon cloud
   • Accessed via SQL queries
```

### Key Takeaways

✅ **Frontend** = User interface (what you see)  
✅ **Backend** = Business logic (what happens)  
✅ **Database** = Data storage (what's remembered)  
✅ **API** = Communication (how they talk)  
✅ **JWT** = Authentication (who you are)  

### Remember

- 🎨 **UI changes** → Frontend
- 🔐 **Security/Auth** → Backend
- 💰 **Business rules** → Backend
- 💾 **Data structure** → Database
- 🌐 **New features** → Usually all three!

---

## 🚀 You're Ready!

You now understand:

✅ What each part does  
✅ How they work together  
✅ Where to find things  
✅ How to make changes  
✅ How to test and debug  

**Start with small changes and build confidence!**

---

## 📞 Need Help?

1. **Check the guides** - Detailed walkthroughs in other .md files
2. **Read error messages** - They usually tell you what's wrong
3. **Check the logs** - Backend terminal and browser console
4. **Google it** - With specific error messages
5. **Ask for help** - With what you tried and what error you got

---

*You've got this! Happy coding! 🎉*

