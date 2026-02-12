# 🏗️ PureTask Architecture - Complete Beginner's Guide

**A comprehensive guide to understanding how PureTask works, what each file does, and how to make changes**

---

## 📖 Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Backend vs Frontend - What's the Difference?](#backend-vs-frontend)
3. [How They Communicate](#how-they-communicate)
4. [Backend Deep Dive](#backend-deep-dive)
5. [Frontend Deep Dive](#frontend-deep-dive)
6. [Where to Make Changes](#where-to-make-changes)
7. [Common Scenarios](#common-scenarios)
8. [Best Practices](#best-practices)

---

## 🎯 The Big Picture

### What is PureTask?

PureTask is a **3-tier web application** for booking cleaning services:

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                           │
│           (What the user sees and interacts with)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS Requests (JSON)
                         │ "Hey, can I book a cleaner?"
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND SERVER                          │
│                  (Next.js - Port 3000)                      │
│                                                             │
│  📱 React Components (UI)                                   │
│  🎨 Tailwind CSS (Styling)                                  │
│  🔄 API Calls to Backend                                    │
│  🌐 Server-Side Rendering                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ API Calls (JSON + JWT Token)
                         │ "Create a booking for user X"
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                           │
│                 (Express.js - Port 4000)                    │
│                                                             │
│  🔐 Authentication (JWT)                                    │
│  📋 Business Logic                                          │
│  🛡️ Security & Validation                                   │
│  💰 Payment Processing (Stripe)                             │
│  💬 Real-time Chat (Socket.IO)                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ SQL Queries
                         │ "SELECT * FROM users WHERE..."
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                 │
│                (PostgreSQL on Neon)                         │
│                                                             │
│  📊 Users, Jobs, Messages, Payments                         │
│  🔒 Secure Storage                                          │
│  ⚡ Fast Queries with Indexes                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎭 Backend vs Frontend - What's the Difference?

### 🖥️ **FRONTEND** (What Users See)

**Location:** `C:\Users\onlyw\Documents\GitHub\puretask-frontend`

**What it does:**
- 🎨 **Displays the UI** - buttons, forms, pages
- 👆 **Handles user interactions** - clicks, typing, scrolling
- 📱 **Manages the interface** - navigation, animations
- 🔄 **Fetches data** from the backend
- 💅 **Makes things look pretty** - colors, layouts, responsive design

**Technology:** Next.js + React + TypeScript + Tailwind CSS

**Think of it as:** The **restaurant menu and dining room** - what customers see and interact with.

---

### ⚙️ **BACKEND** (The Engine)

**Location:** `C:\Users\onlyw\Documents\GitHub\puretask-backend`

**What it does:**
- 🔐 **Authenticates users** - login, register, JWT tokens
- 📋 **Processes business logic** - booking rules, payment calculations
- 💾 **Manages data** - saves, updates, deletes from database
- 🛡️ **Enforces security** - who can do what, rate limiting
- 💰 **Handles payments** - Stripe integration
- 📧 **Sends notifications** - emails, push notifications
- 💬 **Real-time features** - chat, live updates

**Technology:** Node.js + Express.js + TypeScript + PostgreSQL

**Think of it as:** The **kitchen and manager** - where the actual work happens behind the scenes.

---

## 🔗 How They Communicate

### The Request-Response Flow

Here's what happens when a user clicks "Book Now":

```
1️⃣ USER CLICKS BUTTON
   ↓
   Browser (Frontend)

2️⃣ FRONTEND SENDS REQUEST
   ↓
   POST http://localhost:4000/jobs
   Headers: { Authorization: "Bearer eyJhbGc..." }
   Body: { cleaner_id: "123", date: "2026-01-15", service: "deep-clean" }
   ↓

3️⃣ BACKEND RECEIVES REQUEST
   ↓
   ✅ Verify JWT token
   ✅ Check user permissions
   ✅ Validate booking data
   ✅ Check cleaner availability
   ✅ Calculate price
   ↓

4️⃣ BACKEND TALKS TO DATABASE
   ↓
   INSERT INTO jobs (client_id, cleaner_id, date, service, price)
   VALUES ('user-123', 'cleaner-456', '2026-01-15', 'deep-clean', 150)
   ↓

5️⃣ DATABASE RESPONDS
   ↓
   Returns: { job_id: 'job-789', status: 'pending' }
   ↓

6️⃣ BACKEND SENDS RESPONSE
   ↓
   Status: 201 Created
   Body: { 
     success: true,
     job: { id: 'job-789', status: 'pending', price: 150 }
   }
   ↓

7️⃣ FRONTEND RECEIVES RESPONSE
   ↓
   ✅ Update UI: "Booking successful!"
   ✅ Redirect to booking page
   ✅ Show success animation
```

### The Key Connection: API Endpoints

The backend exposes **endpoints** (URLs) that the frontend can call:

```javascript
// BACKEND defines the endpoints
app.get('/jobs', getJobs)           // List all jobs
app.post('/jobs', createJob)        // Create a new job
app.get('/jobs/:id', getJobById)    // Get one job
app.put('/jobs/:id', updateJob)     // Update a job
app.delete('/jobs/:id', deleteJob)  // Delete a job

// FRONTEND calls them
const response = await fetch('http://localhost:4000/jobs', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ cleaner_id: '123', date: '2026-01-15' })
})
```

---

## 🔧 Backend Deep Dive

### Backend Folder Structure

```
puretask-backend/
│
├── src/                           # All source code
│   ├── index.ts                   # 🚀 MAIN ENTRY POINT - Starts server
│   │
│   ├── routes/                    # 📍 API ENDPOINTS
│   │   ├── auth.ts               # Login, Register, Password Reset
│   │   ├── jobs.ts               # Booking CRUD operations
│   │   ├── cleaner.ts            # Cleaner profiles, availability
│   │   ├── client.ts             # Client profiles, preferences
│   │   ├── payments.ts           # Stripe, payment processing
│   │   ├── messages.ts           # Chat messages
│   │   └── search.ts             # Browse/search cleaners
│   │
│   ├── middleware/                # 🛡️ REQUEST PROCESSING
│   │   ├── auth.ts               # JWT verification
│   │   ├── validation.ts         # Input validation
│   │   └── errorHandler.ts       # Error handling
│   │
│   ├── services/                  # 📋 BUSINESS LOGIC
│   │   ├── authService.ts        # Auth logic, password hashing
│   │   ├── jobService.ts         # Booking logic, calculations
│   │   ├── paymentService.ts     # Payment processing
│   │   └── notificationService.ts # Email, push notifications
│   │
│   ├── lib/                       # 🔧 UTILITIES
│   │   ├── db.ts                 # Database connection
│   │   ├── security.ts           # Rate limiting, CORS
│   │   ├── cache.ts              # Redis caching
│   │   └── validation.ts         # Validation schemas
│   │
│   └── config/                    # ⚙️ CONFIGURATION
│       ├── env.ts                # Environment variables
│       └── constants.ts          # App constants
│
├── DB/                            # 💾 DATABASE
│   ├── schema.sql                # Database structure
│   └── migrations/               # Database changes over time
│
├── scripts/                       # 🛠️ HELPER SCRIPTS
│   └── simple-seed.ts            # Populate test data
│
├── .env                          # 🔐 SECRET CONFIGURATION
└── package.json                  # 📦 Dependencies & scripts
```

### Key Backend Files Explained

#### 1. **`src/index.ts`** - The Main Entry Point

```typescript
// This file starts the entire backend server

import express from 'express'
import authRouter from './routes/auth'
import jobsRouter from './routes/jobs'
import { setupSecurity } from './lib/security'

const app = express()

// Setup middleware
app.use(express.json())         // Parse JSON in requests
setupSecurity(app)              // CORS, rate limiting, security headers

// Mount routes
app.use('/auth', authRouter)    // All /auth/* endpoints
app.use('/jobs', jobsRouter)    // All /jobs/* endpoints

// Start server
app.listen(4000, () => {
  console.log('🚀 Backend running on http://localhost:4000')
})
```

**When to edit:** 
- Adding new route files
- Changing the port
- Adding global middleware

---

#### 2. **`src/routes/auth.ts`** - Authentication Endpoints

```typescript
// Handles user login, registration, password reset

import { Router } from 'express'
import { register, login, resetPassword } from '../services/authService'

const router = Router()

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body
  
  // Validate input
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  
  // Create user
  const user = await register(email, password, role)
  
  res.status(201).json({ user })
})

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  
  const result = await login(email, password)
  
  res.json(result)  // { token: 'jwt...', user: {...} }
})

export default router
```

**When to edit:**
- Adding new auth methods (OAuth, 2FA)
- Changing registration fields
- Modifying login logic

---

#### 3. **`src/routes/jobs.ts`** - Booking Management

```typescript
// Handles all booking operations

import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { createJob, getJobs, updateJob } from '../services/jobService'

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /jobs - List all jobs for current user
router.get('/', async (req, res) => {
  const userId = req.user.id  // From JWT token
  const jobs = await getJobs(userId)
  res.json({ jobs })
})

// POST /jobs - Create new booking
router.post('/', async (req, res) => {
  const { cleaner_id, date, service } = req.body
  const client_id = req.user.id
  
  const job = await createJob({
    client_id,
    cleaner_id,
    date,
    service
  })
  
  res.status(201).json({ job })
})

// PUT /jobs/:id - Update booking
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body
  
  const job = await updateJob(id, updates)
  
  res.json({ job })
})

export default router
```

**When to edit:**
- Adding new booking features
- Changing booking validation rules
- Modifying what data is returned

---

#### 4. **`src/services/jobService.ts`** - Business Logic

```typescript
// The actual logic for handling bookings

import { pool } from '../lib/db'

export async function createJob(data: {
  client_id: string
  cleaner_id: string
  date: string
  service: string
}) {
  // 1. Validate cleaner is available
  const availability = await checkAvailability(data.cleaner_id, data.date)
  if (!availability) {
    throw new Error('Cleaner not available')
  }
  
  // 2. Calculate price
  const price = calculatePrice(data.service)
  
  // 3. Create booking in database
  const result = await pool.query(`
    INSERT INTO jobs (client_id, cleaner_id, date, service, price, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING *
  `, [data.client_id, data.cleaner_id, data.date, data.service, price])
  
  // 4. Send notification to cleaner
  await sendNotification(data.cleaner_id, 'New booking request!')
  
  return result.rows[0]
}

function calculatePrice(service: string): number {
  const prices = {
    'basic-clean': 75,
    'deep-clean': 150,
    'move-out': 200
  }
  return prices[service] || 75
}
```

**When to edit:**
- Changing business rules (pricing, availability)
- Adding complex calculations
- Modifying workflow logic

---

#### 5. **`src/middleware/auth.ts`** - Authentication Middleware

```typescript
// Verifies JWT tokens on protected routes

import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  // 1. Get token from header
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  try {
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // 3. Attach user info to request
    req.user = decoded  // { id: '123', role: 'client' }
    
    // 4. Continue to next handler
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

**When to edit:**
- Adding role-based permissions
- Changing token validation logic
- Adding custom auth checks

---

#### 6. **`.env`** - Secret Configuration

```bash
# NEVER commit this file to Git!

# Database
DATABASE_URL=postgresql://user:password@host/database

# JWT
JWT_SECRET=your-super-secret-key-here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Server
PORT=4000
NODE_ENV=development
```

**When to edit:**
- Changing database connection
- Updating API keys
- Switching between dev/production

---

## 🎨 Frontend Deep Dive

### Frontend Folder Structure

```
puretask-frontend/
│
├── src/
│   ├── app/                       # 📄 PAGES (Next.js App Router)
│   │   ├── layout.tsx            # Root layout wrapper
│   │   ├── page.tsx              # Home page (/)
│   │   ├── login/page.tsx        # Login page (/login)
│   │   ├── register/page.tsx     # Register page (/register)
│   │   ├── dashboard/page.tsx    # Dashboard (/dashboard)
│   │   └── booking/page.tsx      # Booking page (/booking)
│   │
│   ├── components/                # 🧩 REUSABLE UI COMPONENTS
│   │   ├── ui/                   # Basic components
│   │   │   ├── Button.tsx        # Button component
│   │   │   ├── Input.tsx         # Input field
│   │   │   ├── Card.tsx          # Card container
│   │   │   └── Modal.tsx         # Modal dialog
│   │   │
│   │   ├── features/             # Feature-specific
│   │   │   ├── BookingForm.tsx   # Booking creation form
│   │   │   ├── CleanerCard.tsx   # Cleaner profile card
│   │   │   └── ChatWindow.tsx    # Chat interface
│   │   │
│   │   └── layout/               # Layout components
│   │       ├── Header.tsx        # Top navigation
│   │       ├── Footer.tsx        # Bottom footer
│   │       └── Sidebar.tsx       # Side navigation
│   │
│   ├── lib/                       # 🔧 UTILITIES
│   │   ├── api.ts                # API client (fetch wrapper)
│   │   ├── auth.ts               # Auth helpers
│   │   └── utils.ts              # General utilities
│   │
│   ├── hooks/                     # 🎣 CUSTOM REACT HOOKS
│   │   ├── useAuth.ts            # Auth state & functions
│   │   ├── useBookings.ts        # Booking data & actions
│   │   └── useCleaners.ts        # Cleaner data & search
│   │
│   ├── store/                     # 🗄️ GLOBAL STATE (Zustand)
│   │   ├── authStore.ts          # User auth state
│   │   ├── bookingStore.ts       # Booking state
│   │   └── chatStore.ts          # Chat state
│   │
│   └── types/                     # 📝 TYPESCRIPT TYPES
│       ├── api.ts                # API response types
│       ├── models.ts             # Data model types
│       └── index.ts              # Exported types
│
├── public/                        # 🖼️ STATIC FILES
│   ├── images/                   # Images
│   └── icons/                    # Icons
│
├── .env.local                    # 🔐 FRONTEND SECRETS
├── next.config.js                # ⚙️ Next.js config
├── tailwind.config.js            # 🎨 Tailwind CSS config
└── package.json                  # 📦 Dependencies
```

### Key Frontend Files Explained

#### 1. **`src/app/page.tsx`** - Home Page

```typescript
// The main landing page at http://localhost:3000/

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-5xl font-bold text-center mb-8">
        Welcome to PureTask
      </h1>
      
      <p className="text-xl text-center mb-12">
        Book professional cleaning services in minutes
      </p>
      
      <div className="flex gap-4 justify-center">
        <Link href="/register">
          <Button size="lg">Get Started</Button>
        </Link>
        
        <Link href="/login">
          <Button size="lg" variant="outline">Login</Button>
        </Link>
      </div>
    </div>
  )
}
```

**When to edit:**
- Changing home page content
- Updating call-to-action buttons
- Modifying layout

---

#### 2. **`src/app/login/page.tsx`** - Login Page

```typescript
// Login page at http://localhost:3000/login

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading } = useAuth()
  const router = useRouter()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Call backend API
      await login(email, password)
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      alert('Login failed!')
    }
  }
  
  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-3xl font-bold mb-6">Login</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
        
        <Button type="submit" fullWidth loading={isLoading}>
          Login
        </Button>
      </form>
    </div>
  )
}
```

**When to edit:**
- Changing form fields
- Adding OAuth buttons
- Modifying validation

---

#### 3. **`src/hooks/useAuth.ts`** - Authentication Hook

```typescript
// Custom hook for auth operations

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const { setUser, setToken } = useAuthStore()
  
  const login = async (email: string, password: string) => {
    setIsLoading(true)
    
    try {
      // Call backend API
      const response = await api.post('/auth/login', {
        email,
        password
      })
      
      // Save token and user info
      setToken(response.token)
      setUser(response.user)
      
      // Store in localStorage
      localStorage.setItem('token', response.token)
      
      return response
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }
  
  return { login, logout, isLoading }
}
```

**When to edit:**
- Adding registration function
- Modifying auth flow
- Adding token refresh logic

---

#### 4. **`src/lib/api.ts`** - API Client

```typescript
// Wrapper for making API calls to backend

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

class ApiClient {
  async request(endpoint: string, options: RequestInit = {}) {
    // Get token from localStorage
    const token = localStorage.getItem('token')
    
    // Set headers
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
    
    // Make request
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    })
    
    // Handle errors
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }
    
    return response.json()
  }
  
  get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' })
  }
  
  post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
  
  put(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }
  
  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient()
```

**When to edit:**
- Changing API URL
- Adding request interceptors
- Modifying error handling

---

#### 5. **`src/components/ui/Button.tsx`** - Button Component

```typescript
// Reusable button component

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  disabled?: boolean
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false
}: ButtonProps) {
  const baseClasses = 'rounded font-semibold transition-colors'
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  }
  
  const className = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
  `.trim()
  
  return (
    <button
      type={type}
      onClick={onClick}
      className={className}
      disabled={disabled || loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}
```

**When to edit:**
- Adding new button styles
- Changing colors or sizes
- Adding icons

---

## 🎯 Where to Make Changes

### Decision Tree: Backend or Frontend?

```
❓ What do you want to change?

├─ 📱 How it LOOKS?
│   └─ ➡️ FRONTEND
│       • Colors, fonts, spacing
│       • Layout, animations
│       • Text content
│       • Images, icons
│       Files: src/app/*, src/components/*, tailwind.config.js
│
├─ 🔄 How users INTERACT?
│   └─ ➡️ FRONTEND
│       • Button clicks, forms
│       • Navigation, routing
│       • Client-side validation
│       Files: src/app/*, src/components/*, src/hooks/*
│
├─ 🔐 Who can ACCESS what?
│   └─ ➡️ BACKEND
│       • Authentication, permissions
│       • User roles
│       • Access control
│       Files: src/middleware/auth.ts, src/routes/*
│
├─ 📋 Business RULES?
│   └─ ➡️ BACKEND
│       • Pricing calculations
│       • Booking validation
│       • Availability logic
│       Files: src/services/*, src/routes/*
│
├─ 💾 What data is STORED?
│   └─ ➡️ BACKEND + DATABASE
│       • Database schema
│       • Data models
│       Files: DB/schema.sql, DB/migrations/*
│
├─ 💰 Payment PROCESSING?
│   └─ ➡️ BACKEND
│       • Stripe integration
│       • Payment validation
│       Files: src/services/paymentService.ts
│
├─ 🌐 What API endpoints EXIST?
│   └─ ➡️ BACKEND
│       • Add new routes
│       • Modify responses
│       Files: src/routes/*, src/index.ts
│
└─ 🔗 How frontend CALLS backend?
    └─ ➡️ FRONTEND
        • API calls
        • Request formatting
        Files: src/lib/api.ts, src/hooks/*
```

---

## 🔧 Common Scenarios

### Scenario 1: "I want to add a new field to the booking form"

**Steps:**

1️⃣ **DATABASE** - Add the column
```sql
-- DB/migrations/031_add_booking_notes.sql
ALTER TABLE jobs ADD COLUMN notes TEXT;
```

2️⃣ **BACKEND** - Update the route
```typescript
// src/routes/jobs.ts
router.post('/', async (req, res) => {
  const { cleaner_id, date, service, notes } = req.body  // ← Add notes
  // ... rest of code
})
```

3️⃣ **BACKEND** - Update the service
```typescript
// src/services/jobService.ts
export async function createJob(data: {
  client_id: string
  cleaner_id: string
  date: string
  service: string
  notes: string  // ← Add this
}) {
  // Update INSERT query to include notes
}
```

4️⃣ **FRONTEND** - Update the form
```typescript
// src/components/features/BookingForm.tsx
const [notes, setNotes] = useState('')

<textarea
  placeholder="Special instructions"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
/>

// Include notes in API call
await api.post('/jobs', { cleaner_id, date, service, notes })
```

**Where to make changes:** Database → Backend → Frontend

---

### Scenario 2: "I want to change the website colors"

**Steps:**

1️⃣ **FRONTEND** - Update Tailwind config
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',    // Blue
        secondary: '#10B981',  // Green
        // Change these ↑
      }
    }
  }
}
```

2️⃣ **FRONTEND** - Use new colors in components
```typescript
// src/components/ui/Button.tsx
const variantClasses = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  //           ↑ Uses your custom color
}
```

**Where to make changes:** Frontend only

---

### Scenario 3: "I want to change booking pricing"

**Steps:**

1️⃣ **BACKEND** - Update pricing logic
```typescript
// src/services/jobService.ts
function calculatePrice(service: string): number {
  const prices = {
    'basic-clean': 100,     // Changed from 75
    'deep-clean': 200,      // Changed from 150
    'move-out': 300         // Changed from 200
  }
  return prices[service] || 100
}
```

**Where to make changes:** Backend only (Frontend automatically gets updated prices)

---

### Scenario 4: "I want to add a new page"

**Steps:**

1️⃣ **FRONTEND** - Create new page file
```typescript
// src/app/about/page.tsx
export default function AboutPage() {
  return (
    <div>
      <h1>About PureTask</h1>
      <p>We're a cleaning service platform...</p>
    </div>
  )
}
```

2️⃣ **FRONTEND** - Add navigation link
```typescript
// src/components/layout/Header.tsx
<nav>
  <Link href="/">Home</Link>
  <Link href="/about">About</Link>  {/* ← New link */}
  <Link href="/login">Login</Link>
</nav>
```

**Where to make changes:** Frontend only

---

### Scenario 5: "I want to add email notifications"

**Steps:**

1️⃣ **BACKEND** - Install email library
```bash
npm install nodemailer
```

2️⃣ **BACKEND** - Create email service
```typescript
// src/services/emailService.ts
import nodemailer from 'nodemailer'

export async function sendBookingConfirmation(email: string, jobDetails: any) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  })
  
  await transporter.sendMail({
    from: 'noreply@puretask.com',
    to: email,
    subject: 'Booking Confirmed!',
    html: `<p>Your booking has been confirmed!</p>`
  })
}
```

3️⃣ **BACKEND** - Call it when booking is created
```typescript
// src/services/jobService.ts
export async function createJob(data) {
  // ... create booking ...
  
  // Send email
  await sendBookingConfirmation(user.email, job)
  
  return job
}
```

4️⃣ **BACKEND** - Add email config to .env
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Where to make changes:** Backend only

---

## 💡 Best Practices

### 🔐 Security

✅ **DO:**
- Always validate input on the backend
- Use JWT tokens for authentication
- Hash passwords (never store plain text)
- Use HTTPS in production
- Rate limit API endpoints
- Sanitize user input to prevent SQL injection

❌ **DON'T:**
- Trust client-side validation alone
- Store secrets in frontend code
- Commit .env files to Git
- Log sensitive information

---

### 🎨 Frontend

✅ **DO:**
- Keep components small and reusable
- Use TypeScript for type safety
- Handle loading and error states
- Show feedback to users (success/error messages)
- Make it responsive (mobile-friendly)

❌ **DON'T:**
- Put business logic in components
- Make huge components (break them down)
- Ignore accessibility
- Forget to handle errors

---

### ⚙️ Backend

✅ **DO:**
- Separate routes, services, and database logic
- Use transactions for multi-step operations
- Log errors properly
- Return consistent error responses
- Document your API endpoints

❌ **DON'T:**
- Put all logic in routes
- Return raw database errors to clients
- Skip input validation
- Ignore error handling

---

### 💾 Database

✅ **DO:**
- Use migrations for schema changes
- Add indexes for frequently queried columns
- Use transactions for data integrity
- Backup regularly
- Use parameterized queries (prevent SQL injection)

❌ **DON'T:**
- Edit the database manually without migrations
- Delete data without backups
- Use string concatenation for queries
- Forget to add indexes

---

## 🚀 Development Workflow

### Making Changes Step-by-Step

```
1️⃣ PLAN
   ↓
   • What feature/fix do I need?
   • Does it affect frontend, backend, or both?
   • What files need to change?

2️⃣ BACKEND FIRST (if needed)
   ↓
   • Update database schema (if needed)
   • Add/modify routes
   • Update services/business logic
   • Test with API client (Postman, curl)

3️⃣ FRONTEND NEXT (if needed)
   ↓
   • Add/modify components
   • Update API calls
   • Test in browser
   • Check mobile responsiveness

4️⃣ TEST
   ↓
   • Run unit tests
   • Test manually
   • Check error cases
   • Verify on different browsers

5️⃣ COMMIT
   ↓
   • Git add
   • Git commit with descriptive message
   • Git push

6️⃣ DEPLOY
   ↓
   • Push to GitHub
   • Deploy to production
   • Monitor for errors
```

---

## 🔍 Debugging Tips

### Frontend Not Showing Data?

1. Check browser console (F12) for errors
2. Check Network tab - are API calls succeeding?
3. Verify API URL is correct (`NEXT_PUBLIC_API_URL`)
4. Check if token is being sent in headers
5. Look for CORS errors

### Backend Returning Errors?

1. Check backend logs (terminal where `npm run dev` is running)
2. Test endpoint with curl or Postman
3. Verify database connection
4. Check .env file has correct values
5. Look for TypeScript compilation errors

### Database Issues?

1. Check connection string in .env
2. Verify database exists on Neon
3. Check migrations have been run
4. Look for SQL syntax errors in logs

---

## 📚 Learning Resources

### Want to Learn More?

**Next.js (Frontend):**
- Official Docs: https://nextjs.org/docs
- Learn Next.js: https://nextjs.org/learn

**Express.js (Backend):**
- Official Docs: https://expressjs.com/
- MDN Web Docs: https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs

**PostgreSQL (Database):**
- PostgreSQL Tutorial: https://www.postgresqltutorial.com/
- Neon Docs: https://neon.tech/docs

**TypeScript:**
- Official Handbook: https://www.typescriptlang.org/docs/handbook/

---

## 🎯 Quick Reference

### Start Development

```powershell
# Backend
cd C:\Users\onlyw\Documents\GitHub\puretask-backend
npm run dev
# ➡️ http://localhost:4000

# Frontend (in new terminal)
cd C:\Users\onlyw\Documents\GitHub\puretask-frontend
npm run dev
# ➡️ http://localhost:3000
```

### Key URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Backend Health: http://localhost:4000/health
- API Docs: See `CONNECTING_FRONTEND_BACKEND.md`

### Environment Files

- Backend: `puretask-backend/.env`
- Frontend: `puretask-frontend/.env.local`

### Important Commands

```powershell
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Type checking
npm run typecheck
```

---

## 🎉 You're Ready!

You now understand:
- ✅ What backend and frontend do
- ✅ How they communicate
- ✅ What each file does
- ✅ Where to make changes
- ✅ Best practices
- ✅ How to debug issues

**Remember:** 
- Backend = Business logic, data, security
- Frontend = User interface, interactions
- They talk via API endpoints
- Make changes where they make sense!

---

*Need help? Refer back to this guide anytime!* 🚀

