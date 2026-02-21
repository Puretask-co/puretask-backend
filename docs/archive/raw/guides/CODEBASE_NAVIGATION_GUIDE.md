# 🗺️ PureTask Codebase Navigation Guide

**Your map to understanding and navigating the entire codebase**

---

## 🎯 Quick Navigation

- [Backend Structure](#-backend-structure-puretask-backend)
- [Frontend Structure](#-frontend-structure-puretask-frontend)
- [File Purpose by Name](#-file-purpose-by-name)
- [Code Patterns](#-common-code-patterns)
- [Where to Start](#-where-to-start-reading-code)

---

## 📦 Backend Structure (puretask-backend)

```
puretask-backend/
│
├── 📄 package.json                  ✨ Dependencies, scripts, project metadata
├── 📄 tsconfig.json                 ⚙️ TypeScript configuration
├── 📄 .env                          🔐 SECRET - Environment variables (DATABASE_URL, JWT_SECRET, etc.)
├── 📄 .gitignore                    🚫 Files to not commit to Git
├── 📄 README.md                     📖 Project documentation
│
├── 📁 src/                          💻 ALL SOURCE CODE
│   │
│   ├── 📄 index.ts                  🚀 **START HERE** - Main entry point
│   │                                   • Creates Express app
│   │                                   • Sets up middleware
│   │                                   • Mounts all routes
│   │                                   • Starts server on port 4000
│   │
│   ├── 📁 routes/                   📍 API ENDPOINTS - Define what URLs exist
│   │   │
│   │   ├── 📄 auth.ts              🔐 Authentication
│   │   │                               • POST /auth/register - Create account
│   │   │                               • POST /auth/login - Login
│   │   │                               • POST /auth/forgot-password
│   │   │                               • POST /auth/reset-password
│   │   │
│   │   ├── 📄 jobs.ts              📋 Bookings/Jobs
│   │   │                               • GET /jobs - List user's bookings
│   │   │                               • GET /jobs/:id - Get one booking
│   │   │                               • POST /jobs - Create booking
│   │   │                               • PUT /jobs/:id - Update booking
│   │   │                               • DELETE /jobs/:id - Cancel booking
│   │   │                               • POST /jobs/:id/complete - Mark complete
│   │   │
│   │   ├── 📄 cleaner.ts           🧹 Cleaner Features
│   │   │                               • GET /cleaner/profile - Get cleaner profile
│   │   │                               • PUT /cleaner/profile - Update profile
│   │   │                               • GET /cleaner/availability - Get schedule
│   │   │                               • PUT /cleaner/availability - Update schedule
│   │   │                               • GET /cleaner/jobs - Cleaner's bookings
│   │   │
│   │   ├── 📄 client.ts            👤 Client Features
│   │   │                               • GET /client/profile - Get client profile
│   │   │                               • PUT /client/profile - Update profile
│   │   │                               • GET /client/preferences - Get preferences
│   │   │
│   │   ├── 📄 search.ts            🔍 Public Search (no auth required)
│   │   │                               • GET /search/cleaners - Browse cleaners
│   │   │                               • GET /search/cleaners/:id - View cleaner
│   │   │
│   │   ├── 📄 payments.ts          💰 Stripe Integration
│   │   │                               • POST /payments/intent - Create payment
│   │   │                               • POST /payments/confirm - Confirm payment
│   │   │                               • GET /payments/history - Payment history
│   │   │
│   │   ├── 📄 messages.ts          💬 Chat System
│   │   │                               • GET /messages/:jobId - Get chat messages
│   │   │                               • POST /messages - Send message
│   │   │                               • PUT /messages/:id - Edit message
│   │   │
│   │   └── 📄 reviews.ts           ⭐ Reviews & Ratings
│   │                                   • POST /reviews - Create review
│   │                                   • GET /reviews/cleaner/:id - Get reviews
│   │                                   • PUT /reviews/:id - Update review
│   │
│   ├── 📁 middleware/               🛡️ REQUEST PROCESSORS - Run before routes
│   │   │
│   │   ├── 📄 auth.ts              🔐 Authentication
│   │   │                               • requireAuth() - Verify JWT token
│   │   │                               • requireRole() - Check user role
│   │   │                               • optionalAuth() - Auth if present
│   │   │
│   │   ├── 📄 validation.ts        ✅ Input Validation
│   │   │                               • validateBody() - Check request body
│   │   │                               • validateParams() - Check URL params
│   │   │                               • sanitize() - Clean user input
│   │   │
│   │   └── 📄 errorHandler.ts      ⚠️ Error Handling
│   │                                   • Catch all errors
│   │                                   • Format error responses
│   │                                   • Log errors
│   │
│   ├── 📁 services/                 📋 BUSINESS LOGIC - The "brains"
│   │   │
│   │   ├── 📄 authService.ts       🔐 Auth Logic
│   │   │                               • register() - Create user, hash password
│   │   │                               • login() - Verify credentials, generate JWT
│   │   │                               • resetPassword() - Password reset flow
│   │   │                               • generateToken() - Create JWT
│   │   │                               • verifyToken() - Validate JWT
│   │   │
│   │   ├── 📄 jobService.ts        📋 Booking Logic
│   │   │                               • createJob() - Validate, calculate price
│   │   │                               • updateJob() - Update booking
│   │   │                               • cancelJob() - Cancel with refund logic
│   │   │                               • calculatePrice() - Pricing rules
│   │   │                               • checkAvailability() - Cleaner schedule
│   │   │
│   │   ├── 📄 paymentService.ts    💰 Payment Logic
│   │   │                               • createPaymentIntent() - Stripe setup
│   │   │                               • confirmPayment() - Process payment
│   │   │                               • refundPayment() - Process refund
│   │   │                               • calculateFees() - Platform fees
│   │   │
│   │   ├── 📄 notificationService.ts  📧 Notifications
│   │   │                               • sendEmail() - Email sending
│   │   │                               • sendBookingConfirmation()
│   │   │                               • sendReminder()
│   │   │                               • sendNotification()
│   │   │
│   │   └── 📄 cleanerService.ts    🧹 Cleaner Business Logic
│   │                                   • updateProfile()
│   │                                   • setAvailability()
│   │                                   • getBookings()
│   │
│   ├── 📁 lib/                      🔧 UTILITIES - Helper functions
│   │   │
│   │   ├── 📄 db.ts                💾 Database Connection
│   │   │                               • pool - PostgreSQL connection pool
│   │   │                               • query() - Helper for queries
│   │   │                               • transaction() - Database transactions
│   │   │
│   │   ├── 📄 security.ts          🛡️ Security Setup
│   │   │                               • setupSecurity() - CORS, rate limiting
│   │   │                               • Rate limiters for different endpoints
│   │   │                               • Security headers
│   │   │                               • Input sanitization
│   │   │
│   │   ├── 📄 cache.ts             ⚡ Redis Caching
│   │   │                               • Cache service for performance
│   │   │                               • get(), set(), invalidate()
│   │   │                               • Decorator for easy caching
│   │   │
│   │   ├── 📄 validation.ts        ✅ Validation Helpers
│   │   │                               • Zod schemas for validation
│   │   │                               • Validation rules
│   │   │
│   │   └── 📄 logger.ts            📝 Logging
│   │                                   • Log to console and files
│   │                                   • Different log levels
│   │
│   ├── 📁 config/                   ⚙️ CONFIGURATION
│   │   │
│   │   ├── 📄 env.ts               🌍 Environment Variables
│   │   │                               • Load and validate .env
│   │   │                               • Export typed config object
│   │   │                               • Required vs optional vars
│   │   │
│   │   └── 📄 constants.ts         📊 App Constants
│   │                                   • Service types
│   │                                   • Booking statuses
│   │                                   • User roles
│   │
│   ├── 📁 types/                    📝 TYPESCRIPT TYPES
│   │   │
│   │   ├── 📄 express.d.ts         🔧 Express type extensions
│   │   ├── 📄 models.ts            📊 Data model types
│   │   └── 📄 api.ts               🌐 API request/response types
│   │
│   └── 📁 __tests__/                🧪 TESTS
│       ├── 📁 unit/                 Unit tests
│       ├── 📁 integration/          Integration tests
│       └── 📄 setup.ts              Test configuration
│
├── 📁 DB/                           💾 DATABASE
│   │
│   ├── 📄 schema.sql                🏗️ **MAIN DATABASE STRUCTURE**
│   │                                   • All tables defined here
│   │                                   • users, jobs, messages, payments, etc.
│   │                                   • Relationships, constraints
│   │
│   └── 📁 migrations/               📝 Database Changes Over Time
│       ├── 📄 001_initial_schema.sql
│       ├── 📄 002_add_reviews.sql
│       ├── 📄 030_performance_indexes.sql
│       └── 📄 ...                   (Each change is a separate file)
│
├── 📁 scripts/                      🛠️ HELPER SCRIPTS
│   │
│   ├── 📄 simple-seed.ts           🌱 Populate test data
│   ├── 📄 backup-db.sh             💾 Database backup
│   └── 📄 migrate.ts               🔄 Run migrations
│
└── 📁 dist/                         📦 COMPILED OUTPUT (auto-generated)
    └── (TypeScript compiled to JavaScript)
```

---

## 🎨 Frontend Structure (puretask-frontend)

```
puretask-frontend/
│
├── 📄 package.json                  ✨ Dependencies, scripts
├── 📄 tsconfig.json                 ⚙️ TypeScript config
├── 📄 next.config.js                ⚙️ Next.js configuration
├── 📄 tailwind.config.js            🎨 Tailwind CSS configuration
├── 📄 .env.local                    🔐 SECRET - Frontend environment vars
├── 📄 .gitignore                    🚫 Files to not commit
│
├── 📁 src/                          💻 SOURCE CODE
│   │
│   ├── 📁 app/                      📄 PAGES (Next.js 13+ App Router)
│   │   │                               Each folder = route
│   │   │                               page.tsx = the page content
│   │   │                               layout.tsx = wrapper for pages
│   │   │
│   │   ├── 📄 layout.tsx           🏠 Root Layout
│   │   │                               • Wraps entire app
│   │   │                               • HTML structure
│   │   │                               • Global fonts, metadata
│   │   │
│   │   ├── 📄 page.tsx             🏠 Home Page (/)
│   │   │                               • Landing page
│   │   │                               • Hero section
│   │   │                               • Call to action
│   │   │
│   │   ├── 📁 login/               🔐 Login Page (/login)
│   │   │   └── 📄 page.tsx            • Login form
│   │   │                               • Email + password
│   │   │                               • Redirect after login
│   │   │
│   │   ├── 📁 register/            📝 Register Page (/register)
│   │   │   └── 📄 page.tsx            • Registration form
│   │   │                               • Choose role (client/cleaner)
│   │   │
│   │   ├── 📁 dashboard/           📊 Dashboard (/dashboard)
│   │   │   ├── 📄 page.tsx            • Main dashboard
│   │   │   └── 📄 layout.tsx          • Dashboard layout with sidebar
│   │   │
│   │   ├── 📁 booking/             📋 Booking Pages
│   │   │   ├── 📄 page.tsx            • Browse cleaners
│   │   │   ├── 📁 new/                • Create booking (/booking/new)
│   │   │   └── 📁 [id]/               • View booking (/booking/123)
│   │   │       └── 📄 page.tsx
│   │   │
│   │   ├── 📁 profile/             👤 Profile Pages
│   │   │   ├── 📄 page.tsx            • View profile
│   │   │   └── 📁 edit/               • Edit profile
│   │   │
│   │   ├── 📁 messages/            💬 Chat Page
│   │   │   └── 📄 page.tsx            • Message inbox
│   │   │
│   │   └── 📁 api/                 🔌 API Routes (Next.js API)
│   │       └── (Server-side endpoints if needed)
│   │
│   ├── 📁 components/               🧩 REUSABLE UI COMPONENTS
│   │   │
│   │   ├── 📁 ui/                  🎨 Basic UI Components
│   │   │   │
│   │   │   ├── 📄 Button.tsx       🔘 Button
│   │   │   │                           • Props: variant, size, loading
│   │   │   │                           • Styles: primary, secondary, outline
│   │   │   │
│   │   │   ├── 📄 Input.tsx        ⌨️ Input Field
│   │   │   │                           • Props: type, placeholder, value
│   │   │   │                           • Handles onChange
│   │   │   │
│   │   │   ├── 📄 Card.tsx         🃏 Card Container
│   │   │   │                           • Wrapper with shadow/border
│   │   │   │
│   │   │   ├── 📄 Modal.tsx        🪟 Modal Dialog
│   │   │   │                           • Open/close state
│   │   │   │                           • Overlay background
│   │   │   │
│   │   │   ├── 📄 Spinner.tsx      ⏳ Loading Spinner
│   │   │   ├── 📄 Badge.tsx        🏷️ Badge/Tag
│   │   │   ├── 📄 Alert.tsx        ⚠️ Alert Message
│   │   │   └── 📄 Avatar.tsx       👤 User Avatar
│   │   │
│   │   ├── 📁 features/            ✨ Feature-Specific Components
│   │   │   │
│   │   │   ├── 📄 BookingForm.tsx  📋 Booking Creation Form
│   │   │   │                           • Select cleaner
│   │   │   │                           • Pick date/time
│   │   │   │                           • Choose service
│   │   │   │
│   │   │   ├── 📄 CleanerCard.tsx  🧹 Cleaner Profile Card
│   │   │   │                           • Photo, name, rating
│   │   │   │                           • Price, services
│   │   │   │                           • "Book Now" button
│   │   │   │
│   │   │   ├── 📄 ChatWindow.tsx   💬 Chat Interface
│   │   │   │                           • Message list
│   │   │   │                           • Send message form
│   │   │   │                           • Real-time updates
│   │   │   │
│   │   │   ├── 📄 BookingCard.tsx  📋 Booking Display Card
│   │   │   ├── 📄 ReviewForm.tsx   ⭐ Review Form
│   │   │   └── 📄 PaymentForm.tsx  💳 Payment Form (Stripe)
│   │   │
│   │   └── 📁 layout/              🏗️ Layout Components
│   │       │
│   │       ├── 📄 Header.tsx       🔝 Top Navigation
│   │       │                           • Logo
│   │       │                           • Navigation links
│   │       │                           • User menu
│   │       │
│   │       ├── 📄 Footer.tsx       ⬇️ Footer
│   │       │                           • Links
│   │       │                           • Copyright
│   │       │
│   │       ├── 📄 Sidebar.tsx      📱 Side Navigation
│   │       └── 📄 Container.tsx    📦 Content Container
│   │
│   ├── 📁 hooks/                    🎣 CUSTOM REACT HOOKS
│   │   │
│   │   ├── 📄 useAuth.ts           🔐 Authentication Hook
│   │   │                               • login(email, password)
│   │   │                               • logout()
│   │   │                               • register()
│   │   │                               • user - current user
│   │   │                               • isAuthenticated - bool
│   │   │
│   │   ├── 📄 useBookings.ts       📋 Bookings Hook
│   │   │                               • bookings - list of bookings
│   │   │                               • createBooking()
│   │   │                               • updateBooking()
│   │   │                               • cancelBooking()
│   │   │                               • isLoading - bool
│   │   │
│   │   ├── 📄 useCleaners.ts       🧹 Cleaners Hook
│   │   │                               • cleaners - list
│   │   │                               • searchCleaners(query)
│   │   │                               • getCleaner(id)
│   │   │
│   │   ├── 📄 useChat.ts           💬 Chat Hook
│   │   │                               • messages - list
│   │   │                               • sendMessage()
│   │   │                               • Real-time updates
│   │   │
│   │   └── 📄 usePayment.ts        💰 Payment Hook
│   │                                   • createPayment()
│   │                                   • Stripe integration
│   │
│   ├── 📁 store/                    🗄️ GLOBAL STATE (Zustand)
│   │   │                               State shared across components
│   │   │
│   │   ├── 📄 authStore.ts         🔐 Auth State
│   │   │                               • user
│   │   │                               • token
│   │   │                               • isAuthenticated
│   │   │                               • setUser(), setToken()
│   │   │
│   │   ├── 📄 bookingStore.ts      📋 Booking State
│   │   │                               • bookings list
│   │   │                               • selectedBooking
│   │   │                               • addBooking(), updateBooking()
│   │   │
│   │   └── 📄 chatStore.ts         💬 Chat State
│   │                                   • messages
│   │                                   • activeChat
│   │
│   ├── 📁 lib/                      🔧 UTILITIES
│   │   │
│   │   ├── 📄 api.ts               🌐 **API CLIENT**
│   │   │                               • Wrapper for fetch()
│   │   │                               • Adds auth headers
│   │   │                               • Handles errors
│   │   │                               • get(), post(), put(), delete()
│   │   │
│   │   ├── 📄 auth.ts              🔐 Auth Helpers
│   │   │                               • getToken()
│   │   │                               • setToken()
│   │   │                               • removeToken()
│   │   │                               • isTokenValid()
│   │   │
│   │   ├── 📄 utils.ts             🛠️ General Utilities
│   │   │                               • formatDate()
│   │   │                               • formatPrice()
│   │   │                               • cn() - className helper
│   │   │
│   │   └── 📄 validation.ts        ✅ Client-side Validation
│   │                                   • validateEmail()
│   │                                   • validatePassword()
│   │
│   ├── 📁 types/                    📝 TYPESCRIPT TYPES
│   │   │
│   │   ├── 📄 index.ts             📊 Exported Types
│   │   ├── 📄 api.ts               🌐 API Types
│   │   └── 📄 models.ts            📊 Data Models
│   │
│   └── 📁 __tests__/                🧪 TESTS
│       ├── 📁 unit/                 Unit tests
│       ├── 📁 integration/          Integration tests
│       └── 📄 setup.ts              Test config
│
├── 📁 public/                       🖼️ STATIC FILES (publicly accessible)
│   ├── 📁 images/                   Images
│   ├── 📁 icons/                    Icons
│   └── 📄 favicon.ico              Favicon
│
└── 📁 .next/                        📦 BUILD OUTPUT (auto-generated)
    └── (Next.js compiled code)
```

---

## 📖 File Purpose by Name

### When you see a file named...

| Filename | Purpose | What's Inside |
|----------|---------|---------------|
| **index.ts/tsx** | Entry point | Main file that starts everything |
| **page.tsx** | Next.js page | A route/page in your app |
| **layout.tsx** | Next.js layout | Wrapper around pages |
| **route.ts** | API route | Next.js API endpoint |
| **[id]/page.tsx** | Dynamic route | Page with URL parameter (e.g., /booking/123) |
| **config.ts** | Configuration | Settings and constants |
| **constants.ts** | Constants | Fixed values used throughout |
| **types.ts** | Type definitions | TypeScript type declarations |
| **utils.ts** | Utilities | Helper functions |
| **schema.sql** | Database schema | Table definitions |
| **migration.sql** | Database change | Incremental database update |
| **seed.ts** | Seed data | Populate database with test data |
| **middleware.ts** | Middleware | Request processors |
| **Service.ts** | Service layer | Business logic |
| **Store.ts** | State management | Global state (Zustand) |
| **Hook.ts** (useX) | React hook | Reusable React logic |
| **.env** | Environment vars | SECRET configuration |
| **.test.ts** | Test file | Unit/integration tests |
| **.spec.ts** | Test file | E2E tests (Playwright) |

---

## 🔍 Common Code Patterns

### Pattern 1: Creating an API Endpoint

**Files involved:** Route → Service → Database

```typescript
// 1. src/routes/jobs.ts - Define the endpoint
router.post('/jobs', requireAuth, async (req, res) => {
  const job = await jobService.createJob(req.body)
  res.status(201).json({ job })
})

// 2. src/services/jobService.ts - Business logic
export async function createJob(data) {
  const price = calculatePrice(data.service)
  return await db.query('INSERT INTO jobs...')
}

// 3. Frontend calls it
await api.post('/jobs', { cleaner_id, date, service })
```

---

### Pattern 2: Creating a React Component

**Files involved:** Component → Hook → Store

```typescript
// 1. src/components/features/BookingForm.tsx - UI
export function BookingForm() {
  const { createBooking } = useBookings()  // Use hook
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}

// 2. src/hooks/useBookings.ts - Logic
export function useBookings() {
  const { addBooking } = useBookingStore()  // Use store
  
  async function createBooking(data) {
    const result = await api.post('/jobs', data)  // API call
    addBooking(result.job)  // Update local state
  }
  
  return { createBooking }
}

// 3. src/store/bookingStore.ts - State
export const useBookingStore = create((set) => ({
  bookings: [],
  addBooking: (booking) => set((state) => ({
    bookings: [...state.bookings, booking]
  }))
}))
```

---

### Pattern 3: Adding Authentication

**Files involved:** Middleware → Service → Route

```typescript
// 1. src/middleware/auth.ts - Check token
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const user = verifyToken(token)
  req.user = user
  next()
}

// 2. src/routes/jobs.ts - Use middleware
router.get('/jobs', requireAuth, async (req, res) => {
  // req.user is available here!
  const jobs = await getJobsForUser(req.user.id)
  res.json({ jobs })
})

// 3. Frontend sends token
await api.get('/jobs')  // api.ts automatically adds token
```

---

## 🎯 Where to Start Reading Code

### Want to understand...

#### **1. How the backend starts up?**
Start here: `src/index.ts`

Follow this path:
```
src/index.ts (creates app)
  ↓
src/lib/security.ts (security setup)
  ↓
src/routes/auth.ts (example route)
  ↓
src/services/authService.ts (business logic)
  ↓
src/lib/db.ts (database)
```

---

#### **2. How authentication works?**
Start here: `src/routes/auth.ts`

Follow this path:
```
Frontend: src/app/login/page.tsx
  ↓
Frontend: src/lib/api.ts (sends request)
  ↓
Backend: src/routes/auth.ts (receives request)
  ↓
Backend: src/services/authService.ts (verify password, create token)
  ↓
Backend: Returns { token, user }
  ↓
Frontend: src/hooks/useAuth.ts (saves token)
  ↓
Frontend: src/store/authStore.ts (updates global state)
```

---

#### **3. How bookings are created?**
Start here: `src/routes/jobs.ts`

Follow this path:
```
Frontend: User fills BookingForm.tsx
  ↓
Frontend: useBookings hook calls api.post('/jobs')
  ↓
Backend: src/routes/jobs.ts receives request
  ↓
Backend: src/middleware/auth.ts verifies token
  ↓
Backend: src/services/jobService.ts
  - Validates data
  - Checks availability
  - Calculates price
  - Inserts to database
  ↓
Backend: Returns booking object
  ↓
Frontend: Updates UI with new booking
```

---

#### **4. How frontend pages work?**
Start here: `src/app/page.tsx`

Follow this path:
```
src/app/layout.tsx (root wrapper)
  ↓
src/app/page.tsx (home page)
  ↓
src/components/ui/Button.tsx (used in page)
  ↓
User clicks button → navigates to /login
  ↓
src/app/login/page.tsx loads
  ↓
Uses src/hooks/useAuth.ts for login
  ↓
Calls backend via src/lib/api.ts
```

---

## 🗺️ Mental Model

### Think of it like a restaurant:

```
┌─────────────────────────────────────────────┐
│  👥 FRONTEND (Dining Room)                  │
│  • Customers see the menu                   │
│  • Place orders                             │
│  • See their food arrive                    │
│  Files: src/app/*, src/components/*         │
└─────────────────┬───────────────────────────┘
                  │
                  │ Orders (API Requests)
                  ↓
┌─────────────────────────────────────────────┐
│  🍳 BACKEND (Kitchen)                       │
│  • Receives orders                          │
│  • Prepares food (business logic)           │
│  • Validates orders                         │
│  Files: src/routes/*, src/services/*        │
└─────────────────┬───────────────────────────┘
                  │
                  │ Ingredients (Data)
                  ↓
┌─────────────────────────────────────────────┐
│  🥫 DATABASE (Pantry)                       │
│  • Stores ingredients                       │
│  • Organized in shelves (tables)            │
│  Files: DB/schema.sql, DB/migrations/*      │
└─────────────────────────────────────────────┘
```

---

## 🎓 Learning Path

### For Beginners:

1. **Week 1: Frontend Basics**
   - Read `src/app/page.tsx`
   - Look at `src/components/ui/Button.tsx`
   - Understand `src/lib/api.ts`

2. **Week 2: Backend Basics**
   - Read `src/index.ts`
   - Look at `src/routes/auth.ts`
   - Understand `src/middleware/auth.ts`

3. **Week 3: Data Flow**
   - Follow a complete flow (login or booking)
   - Trace from frontend → backend → database → back

4. **Week 4: Make Changes**
   - Add a new field to a form
   - Change some styling
   - Add a new page

---

## 🚀 Pro Tips

### Finding What You Need

1. **Use VS Code's search** (Ctrl+Shift+F)
   - Search for error messages
   - Search for function names
   - Search for "TODO" comments

2. **Follow imports**
   - Click on imported function names
   - See where they come from
   - Understand dependencies

3. **Use "Go to Definition" (F12)**
   - Right-click on any function/component
   - Jump to its definition
   - See how it's implemented

4. **Read tests**
   - Tests show how code is used
   - Great for understanding APIs
   - Look in `__tests__/` folders

---

## 📚 Key Takeaways

✅ **Backend** = `src/` folder in puretask-backend  
✅ **Frontend** = `src/` folder in puretask-frontend  
✅ **Routes** = Define what URLs exist  
✅ **Services** = Business logic  
✅ **Components** = Reusable UI pieces  
✅ **Hooks** = Reusable React logic  
✅ **Stores** = Global state  

**Remember:** Code is read more than it's written! Take your time exploring. 🔍

---

*Happy navigating! 🗺️*

