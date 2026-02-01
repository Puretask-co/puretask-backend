# 🛠️ Making Changes to PureTask - Practical Guide

**Step-by-step instructions for common changes you'll want to make**

---

## 📋 Table of Contents

1. [Visual: Data Flow](#visual-data-flow)
2. [Change Type Quick Reference](#change-type-quick-reference)
3. [Step-by-Step Tutorials](#step-by-step-tutorials)
4. [File Quick Finder](#file-quick-finder)
5. [Testing Your Changes](#testing-your-changes)

---

## 🔄 Visual: Data Flow

### How a User Action Flows Through PureTask

```
USER CLICKS "BOOK NOW" BUTTON
         │
         │ (1) React event handler triggered
         │
         ↓
┌─────────────────────────────────────┐
│  FRONTEND: BookingForm.tsx          │
│                                     │
│  handleSubmit() {                   │
│    // Validate form                 │
│    // Show loading state            │
│    ↓                                │
│  }                                  │
└──────────────┬──────────────────────┘
               │
               │ (2) API call made
               │ api.post('/jobs', data)
               │
               ↓
┌─────────────────────────────────────┐
│  FRONTEND: lib/api.ts               │
│                                     │
│  • Adds JWT token to headers       │
│  • Formats request body as JSON    │
│  • Sends HTTP POST request         │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (3) Network request
               │ POST http://localhost:4000/jobs
               │ Headers: { Authorization: "Bearer..." }
               │ Body: { cleaner_id, date, service }
               │
               ↓
┌─────────────────────────────────────┐
│  BACKEND: index.ts                  │
│                                     │
│  • CORS check ✓                    │
│  • Rate limiting ✓                 │
│  • Body parsing ✓                  │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (4) Route to correct handler
               │ app.use('/jobs', jobsRouter)
               │
               ↓
┌─────────────────────────────────────┐
│  BACKEND: routes/jobs.ts            │
│                                     │
│  router.post('/', ...)              │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (5) Authentication check
               │ requireAuth middleware
               │
               ↓
┌─────────────────────────────────────┐
│  BACKEND: middleware/auth.ts        │
│                                     │
│  • Verify JWT token                │
│  • Extract user ID from token      │
│  • Attach to req.user              │
│    ✓ Authorized                    │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (6) Call business logic
               │ await createJob(data)
               │
               ↓
┌─────────────────────────────────────┐
│  BACKEND: services/jobService.ts    │
│                                     │
│  • Check cleaner availability      │
│  • Calculate price                 │
│  • Validate booking rules          │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (7) Database operations
               │ INSERT INTO jobs...
               │
               ↓
┌─────────────────────────────────────┐
│  DATABASE: PostgreSQL (Neon)        │
│                                     │
│  • Validate constraints            │
│  • Insert new row                  │
│  • Return job_id                   │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (8) Return to service
               │ { id: 'job-123', status: 'pending' }
               │
               ↓
┌─────────────────────────────────────┐
│  BACKEND: services/jobService.ts    │
│                                     │
│  • Send notification to cleaner    │
│  • Log the booking                 │
│  • Return job object               │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (9) Send HTTP response
               │ Status: 201 Created
               │ Body: { success: true, job: {...} }
               │
               ↓
┌─────────────────────────────────────┐
│  FRONTEND: lib/api.ts               │
│                                     │
│  • Parse JSON response             │
│  • Return to calling code          │
│    ↓                                │
└──────────────┬──────────────────────┘
               │
               │ (10) Update UI
               │
               ↓
┌─────────────────────────────────────┐
│  FRONTEND: BookingForm.tsx          │
│                                     │
│  • Hide loading state              │
│  • Show success message            │
│  • Redirect to booking page        │
│  • Update local state              │
└─────────────────────────────────────┘
         │
         ↓
   USER SEES: "Booking successful! ✓"
```

---

## 🎯 Change Type Quick Reference

### "I want to change..."

| What You Want | Where to Go | Files to Edit |
|---------------|-------------|---------------|
| **Button color** | Frontend | `src/components/ui/Button.tsx`<br>`tailwind.config.js` |
| **Page layout** | Frontend | `src/app/[page]/page.tsx`<br>`src/components/layout/*` |
| **Form fields** | Frontend + Backend | Frontend: Form component<br>Backend: Route & service |
| **Booking price** | Backend | `src/services/jobService.ts` |
| **Who can access** | Backend | `src/middleware/auth.ts`<br>`src/routes/*` |
| **Database table** | Backend | `DB/migrations/*.sql` |
| **API endpoint** | Backend | `src/routes/*.ts`<br>`src/index.ts` |
| **Email content** | Backend | `src/services/emailService.ts` |
| **Payment amount** | Backend | `src/services/paymentService.ts` |
| **Error messages** | Both | Backend: Services<br>Frontend: Components |
| **Navigation menu** | Frontend | `src/components/layout/Header.tsx` |
| **User profile fields** | Database + Both | DB migration → Backend → Frontend |

---

## 📚 Step-by-Step Tutorials

### Tutorial 1: Change a Button Color

**Goal:** Change the primary button from blue to purple

**Difficulty:** ⭐ Easy  
**Time:** 2 minutes  
**Location:** Frontend only

**Steps:**

1. Open `tailwind.config.js`
```javascript
// Find this:
colors: {
  primary: '#3B82F6',  // Blue
}

// Change to:
colors: {
  primary: '#9333EA',  // Purple
}
```

2. Save the file - Tailwind will automatically rebuild

3. Refresh your browser - all primary buttons are now purple!

**What happened?**
- Tailwind uses this color definition throughout your app
- Any component using `bg-primary` will now be purple
- No other files need to change!

---

### Tutorial 2: Add a Phone Number Field to Registration

**Goal:** Collect user phone numbers during registration

**Difficulty:** ⭐⭐ Medium  
**Time:** 15 minutes  
**Location:** Database + Backend + Frontend

**Steps:**

**Step 1: Update Database**

Create file: `DB/migrations/032_add_phone_to_users.sql`
```sql
-- Add phone column to users table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Add index for faster lookups
CREATE INDEX idx_users_phone ON users(phone);
```

Run migration:
```powershell
# If using psql:
psql $DATABASE_URL -f DB/migrations/032_add_phone_to_users.sql

# Or use Neon Console SQL Editor:
# Paste the SQL above and run it
```

**Step 2: Update Backend Registration Route**

File: `src/routes/auth.ts`
```typescript
// Find the register route
router.post('/register', async (req, res) => {
  const { email, password, role, phone } = req.body  // ← Add phone
  
  // Add validation
  if (!phone || phone.length < 10) {
    return res.status(400).json({ 
      error: 'Valid phone number required' 
    })
  }
  
  // Pass phone to service
  const user = await register(email, password, role, phone)  // ← Add phone
  
  res.status(201).json({ user })
})
```

**Step 3: Update Backend Service**

File: `src/services/authService.ts`
```typescript
export async function register(
  email: string, 
  password: string, 
  role: string,
  phone: string  // ← Add this parameter
) {
  // ... existing validation ...
  
  // Update INSERT query
  const result = await pool.query(`
    INSERT INTO users (email, password_hash, role, phone)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, role, phone
  `, [email, hashedPassword, role, phone])  // ← Add phone
  
  return result.rows[0]
}
```

**Step 4: Update Frontend Registration Form**

File: `src/app/register/page.tsx`
```typescript
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')  // ← Add state
  const [role, setRole] = useState('client')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await api.post('/auth/register', {
        email,
        password,
        role,
        phone  // ← Send phone
      })
      
      alert('Registration successful!')
    } catch (error) {
      alert('Registration failed!')
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      
      {/* ← Add phone field */}
      <Input
        type="tel"
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      
      <select 
        value={role} 
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="client">Client</option>
        <option value="cleaner">Cleaner</option>
      </select>
      
      <Button type="submit">Register</Button>
    </form>
  )
}
```

**Step 5: Test It!**

1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Go to http://localhost:3000/register
4. Fill in the form including phone number
5. Submit and check database!

**Done!** ✅ Phone numbers are now collected during registration.

---

### Tutorial 3: Change Booking Prices

**Goal:** Update service pricing

**Difficulty:** ⭐ Easy  
**Time:** 2 minutes  
**Location:** Backend only

**Steps:**

**Step 1: Open Price Calculation File**

File: `src/services/jobService.ts`

```typescript
// Find this function:
function calculatePrice(service: string): number {
  const prices = {
    'basic-clean': 75,
    'deep-clean': 150,
    'move-out': 200
  }
  return prices[service] || 75
}

// Change to your new prices:
function calculatePrice(service: string): number {
  const prices = {
    'basic-clean': 100,      // Changed from 75
    'deep-clean': 175,       // Changed from 150
    'move-out': 250,         // Changed from 200
    'window-cleaning': 50    // New service!
  }
  return prices[service] || 100  // Default changed to 100
}
```

**Step 2: Restart Backend**

```powershell
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

**Done!** ✅ All new bookings will use the new prices automatically.

**Note:** Frontend doesn't need changes - it gets prices from backend!

---

### Tutorial 4: Add a New Page

**Goal:** Add an "About Us" page

**Difficulty:** ⭐ Easy  
**Time:** 5 minutes  
**Location:** Frontend only

**Steps:**

**Step 1: Create Page File**

Create file: `src/app/about/page.tsx`
```typescript
export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">About PureTask</h1>
      
      <div className="prose max-w-3xl">
        <p>
          PureTask is a modern platform connecting homeowners with 
          professional cleaning services.
        </p>
        
        <h2>Our Mission</h2>
        <p>
          To make booking cleaning services as easy as ordering food.
        </p>
        
        <h2>How It Works</h2>
        <ol>
          <li>Browse verified cleaners</li>
          <li>Book your service</li>
          <li>Enjoy a clean home!</li>
        </ol>
      </div>
    </div>
  )
}
```

**Step 2: Add Navigation Link**

File: `src/components/layout/Header.tsx`
```typescript
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-white shadow">
      <nav className="container mx-auto px-4 py-4 flex gap-6">
        <Link href="/" className="hover:text-blue-600">
          Home
        </Link>
        
        <Link href="/about" className="hover:text-blue-600">
          About
        </Link>
        
        <Link href="/login" className="hover:text-blue-600">
          Login
        </Link>
      </nav>
    </header>
  )
}
```

**Step 3: Test It**

Visit: http://localhost:3000/about

**Done!** ✅ Your new page is live!

---

### Tutorial 5: Require Admin Role for Endpoint

**Goal:** Make `/admin/users` only accessible to admins

**Difficulty:** ⭐⭐ Medium  
**Time:** 10 minutes  
**Location:** Backend only

**Steps:**

**Step 1: Create Role Middleware**

File: `src/middleware/auth.ts`
```typescript
// Add this function after requireAuth

export function requireRole(allowedRoles: string[]) {
  return (req, res, next) => {
    const userRole = req.user.role  // From JWT token
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      })
    }
    
    next()
  }
}
```

**Step 2: Create Admin Route**

Create file: `src/routes/admin.ts`
```typescript
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { pool } from '../lib/db'

const router = Router()

// All admin routes require authentication AND admin role
router.use(requireAuth)
router.use(requireRole(['admin']))

// GET /admin/users - List all users
router.get('/users', async (req, res) => {
  const result = await pool.query('SELECT id, email, role FROM users')
  res.json({ users: result.rows })
})

// DELETE /admin/users/:id - Delete a user
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params
  await pool.query('DELETE FROM users WHERE id = $1', [id])
  res.json({ success: true })
})

export default router
```

**Step 3: Mount Admin Router**

File: `src/index.ts`
```typescript
import adminRouter from './routes/admin'

// Add this line with other routes
app.use('/admin', adminRouter)
```

**Step 4: Test It**

```powershell
# Try without admin role (should fail with 403)
$token = "regular-user-token"
$headers = @{ Authorization = "Bearer $token" }
Invoke-WebRequest -Uri "http://localhost:4000/admin/users" -Headers $headers
# Result: 403 Forbidden

# Try with admin role (should succeed)
$adminToken = "admin-user-token"
$headers = @{ Authorization = "Bearer $adminToken" }
Invoke-WebRequest -Uri "http://localhost:4000/admin/users" -Headers $headers
# Result: 200 OK with user list
```

**Done!** ✅ Admin endpoints are now protected!

---

## 📂 File Quick Finder

### "Where is the file that handles..."

| Feature | File Path |
|---------|-----------|
| **Server startup** | `src/index.ts` |
| **User login** | `src/routes/auth.ts` |
| **User registration** | `src/routes/auth.ts` |
| **Creating bookings** | `src/routes/jobs.ts` |
| **Viewing bookings** | `src/routes/jobs.ts` |
| **Cleaner profiles** | `src/routes/cleaner.ts` |
| **Client profiles** | `src/routes/client.ts` |
| **Payments** | `src/routes/payments.ts` |
| **Chat messages** | `src/routes/messages.ts` |
| **Searching cleaners** | `src/routes/search.ts` |
| **JWT verification** | `src/middleware/auth.ts` |
| **Request validation** | `src/middleware/validation.ts` |
| **Error handling** | `src/middleware/errorHandler.ts` |
| **Password hashing** | `src/services/authService.ts` |
| **Booking logic** | `src/services/jobService.ts` |
| **Payment processing** | `src/services/paymentService.ts` |
| **Email sending** | `src/services/emailService.ts` |
| **Database connection** | `src/lib/db.ts` |
| **Security setup** | `src/lib/security.ts` |
| **Caching** | `src/lib/cache.ts` |
| **Environment config** | `src/config/env.ts` |
| **Database schema** | `DB/schema.sql` |
| **Seed data** | `scripts/simple-seed.ts` |

### Frontend Files

| Feature | File Path |
|---------|-----------|
| **Home page** | `src/app/page.tsx` |
| **Login page** | `src/app/login/page.tsx` |
| **Register page** | `src/app/register/page.tsx` |
| **Dashboard** | `src/app/dashboard/page.tsx` |
| **Booking page** | `src/app/booking/page.tsx` |
| **API client** | `src/lib/api.ts` |
| **Auth helpers** | `src/lib/auth.ts` |
| **Auth hook** | `src/hooks/useAuth.ts` |
| **Booking hook** | `src/hooks/useBookings.ts` |
| **Auth store** | `src/store/authStore.ts` |
| **Button component** | `src/components/ui/Button.tsx` |
| **Input component** | `src/components/ui/Input.tsx` |
| **Header** | `src/components/layout/Header.tsx` |
| **Footer** | `src/components/layout/Footer.tsx` |
| **Tailwind config** | `tailwind.config.js` |
| **Next.js config** | `next.config.js` |

---

## 🧪 Testing Your Changes

### Manual Testing Checklist

After making changes, test these:

#### Backend Changes

```powershell
# 1. Server starts without errors
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev
# Look for: "🚀 Backend running on http://localhost:4000"

# 2. Health check works
Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing
# Should return: 200 OK

# 3. Your specific endpoint works
# Example: Test new endpoint
Invoke-WebRequest -Uri "http://localhost:4000/your-endpoint" -Method GET
```

#### Frontend Changes

```powershell
# 1. Server starts without errors
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev
# Look for: "✓ Ready in Xs"

# 2. No TypeScript errors
npm run typecheck

# 3. Manual browser testing
# Open: http://localhost:3000
# Test your changes visually
```

#### Database Changes

```sql
-- After running migration, verify:

-- 1. Table/column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'your_table';

-- 2. Try inserting test data
INSERT INTO your_table (columns...) VALUES (values...);

-- 3. Try querying
SELECT * FROM your_table LIMIT 5;
```

---

### Automated Testing

```powershell
# Backend unit tests
cd puretask-backend
npm test

# Frontend component tests
cd puretask-frontend
npm test

# E2E tests (both servers must be running)
cd puretask-frontend
npm run test:e2e
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Port already in use"

**Error:** `EADDRINUSE: address already in use :::4000`

**Solution:**
```powershell
# Find process using the port
netstat -ano | findstr :4000

# Kill the process (replace PID with actual number)
taskkill /PID 1234 /F

# Or change the port in .env
PORT=4001
```

---

### Issue 2: Frontend can't connect to backend

**Error:** `Failed to fetch` or CORS errors

**Solution:**

1. Check backend is running:
```powershell
Invoke-WebRequest -Uri "http://localhost:4000/health"
```

2. Check frontend .env.local:
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

3. Check backend CORS in `src/lib/security.ts`:
```typescript
app.use(cors({
  origin: 'http://localhost:3000',  // Must match frontend URL
  credentials: true
}))
```

---

### Issue 3: Database errors

**Error:** `relation "table_name" does not exist`

**Solution:**
```powershell
# Run migrations
psql $DATABASE_URL -f DB/schema.sql
psql $DATABASE_URL -f DB/migrations/001_*.sql
# etc...
```

---

### Issue 4: Authentication not working

**Error:** `401 Unauthorized` or `Invalid token`

**Checklist:**
1. Token is being sent: Check browser Network tab
2. Token format: `Authorization: Bearer eyJhbGc...`
3. JWT_SECRET matches between .env and code
4. Token hasn't expired
5. User still exists in database

---

## 🎯 Best Practices Summary

### Before Making Changes

- [ ] Understand what you want to achieve
- [ ] Identify which layer needs changes (DB/Backend/Frontend)
- [ ] Check if similar code already exists
- [ ] Plan the changes step by step

### While Making Changes

- [ ] Make small, incremental changes
- [ ] Test after each change
- [ ] Keep code clean and readable
- [ ] Add comments for complex logic
- [ ] Follow existing code style

### After Making Changes

- [ ] Test manually in browser/API client
- [ ] Run automated tests
- [ ] Check for console errors
- [ ] Commit with descriptive message
- [ ] Document if needed

---

## 📞 Getting Help

### When You're Stuck

1. **Read error messages carefully** - they usually tell you what's wrong
2. **Check the logs** - backend terminal and browser console
3. **Use debugging tools** - console.log, debugger, breakpoints
4. **Search for the error** - Google/Stack Overflow
5. **Check documentation** - Next.js, Express, PostgreSQL docs
6. **Ask for help** - with specific error messages and what you tried

---

## 🎉 You've Got This!

Remember:
- 🎨 **Frontend** = What users see and interact with
- ⚙️ **Backend** = Business logic, data, security
- 💾 **Database** = Where data lives
- 🔗 **API** = How they talk to each other

**Start small, test often, and build confidence!**

---

*Happy coding! 🚀*

