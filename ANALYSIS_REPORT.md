# 🔍 PURETASK BACKEND - COMPLETE ANALYSIS REPORT

**Generated:** Analysis of entire backend codebase vs Neon schema  
**Schema Reference:** `DB/migrations/001_core_schema.sql`

---

## 📁 FILE-BY-FILE STATUS

### ✅ EXISTING FILES (Working/Partial)

#### Core Infrastructure
- ✅ `src/index.ts` - Express server entry (WORKS)
- ✅ `src/config/env.ts` - Environment config (WORKS)
- ✅ `src/db/client.ts` - Database client with Pool (WORKS)
- ✅ `package.json` - Dependencies configured (MISSING: stripe, jsonwebtoken, @neondatabase/serverless)
- ✅ `tsconfig.json` - TypeScript config (WORKS)
- ✅ `DB/migrations/001_core_schema.sql` - Complete Neon schema (REFERENCE)

#### Routes
- ⚠️ `src/routes/health.ts` - Health endpoint (WORKS)
- ⚠️ `src/routes/jobs.ts` - Job routes (SCHEMA MISMATCHES - see below)
- ⚠️ `src/routes/admin.ts` - Admin routes (INCOMPLETE)

#### Services
- ⚠️ `src/services/jobsService.ts` - Job service (SCHEMA MISMATCHES - see below)
- ⚠️ `src/services/creditsService.ts` - Credits service (✅ CORRECT - uses credit_transactions)
- ⚠️ `src/services/jobEvents.ts` - Events service (✅ CORRECT - uses app_events)
- ⚠️ `src/services/paymentService.ts` - Payment stub (INCOMPLETE)
- ⚠️ `src/services/adminJobsService.ts` - Admin service (BASIC)
- ⚠️ `src/services/cleanerJobsService.ts` - Cleaner service (BASIC)

#### State & Middleware
- ⚠️ `src/state/jobStateMachine.ts` - State machine (✅ STATUS VALUES CORRECT)
- ⚠️ `src/middleware/auth.ts` - Auth stub (INCOMPLETE - no JWT generation)

---

## ❌ MISSING FILES (Critical)

### Folder Structure Missing
- ❌ `src/lib/` - Shared utilities folder (DOES NOT EXIST)
- ❌ `src/types/` - TypeScript type definitions (DOES NOT EXIST)
- ❌ `src/workers/` - Background workers (DOES NOT EXIST)
- ❌ `src/tests/` - Test files (DOES NOT EXIST)

### Core Files Missing
- ❌ `src/lib/logger.ts` - Centralized logging
- ❌ `src/lib/validation.ts` - Zod validation middleware
- ❌ `src/lib/events.ts` - Event publishing system
- ❌ `src/lib/httpClient.ts` - HTTP client for n8n
- ❌ `src/types/db.ts` - Database type definitions
- ❌ `src/types/api.ts` - API request/response types
- ❌ `src/routes/stripe.ts` - Stripe webhook route
- ❌ `src/routes/events.ts` - n8n events route
- ❌ `src/services/payoutsService.ts` - Payout service
- ❌ `src/services/notificationsService.ts` - Notification service
- ❌ `src/services/disputesService.ts` - Dispute service
- ❌ `src/services/kpisService.ts` - KPI service
- ❌ `src/workers/autoCancelStaleJobs.ts` - Auto-cancel worker
- ❌ `src/workers/payoutWeekly.ts` - Payout worker
- ❌ `src/workers/kpiDailySnapshot.ts` - KPI worker
- ❌ `src/tests/smoke/jobLifecycle.test.ts` - Smoke tests
- ❌ `src/tests/integration/` - Integration tests
- ❌ `Dockerfile` - Docker configuration
- ❌ `.env.example` - Environment template

---

## 🚨 SCHEMA MISMATCHES (Critical Fixes Needed)

### 1. `src/routes/jobs.ts` - Route Handler Mismatches

**Line 34-36:** Uses wrong field names
```typescript
// ❌ WRONG
scheduled_start: z.string(),
estimated_hours: z.number(),
total_credits: z.number(),

// ✅ SHOULD BE
scheduled_start_at: z.string(),
scheduled_end_at: z.string().optional(),
estimated_hours: z.number(),
cleaning_type: z.enum(['basic', 'deep', 'moveout']),
base_rate_cph: z.number(),
addon_rate_cph: z.number().optional(),
total_rate_cph: z.number(),
```

**Line 43-45:** Passes wrong parameters to createJob
```typescript
// ❌ WRONG
scheduledStart: body.scheduled_start,
estimatedHours: body.estimated_hours,
totalCredits: body.total_credits,

// ✅ SHOULD BE
scheduledStartAt: body.scheduled_start_at,
scheduledEndAt: body.scheduled_end_at,
estimatedHours: body.estimated_hours,
cleaningType: body.cleaning_type,
baseRateCph: body.base_rate_cph,
addonRateCph: body.addon_rate_cph,
totalRateCph: body.total_rate_cph,
```

**Line 122-124:** Update route uses wrong field names
```typescript
// ❌ WRONG
scheduled_start: z.string().optional(),
total_credits: z.number().optional(),

// ✅ SHOULD BE
scheduled_start_at: z.string().optional(),
scheduled_end_at: z.string().optional(),
estimated_hours: z.number().optional(),
```

**Line 139-141:** Passes wrong parameters
```typescript
// ❌ WRONG
scheduledStart: body.scheduled_start,
totalCredits: body.total_credits,

// ✅ SHOULD BE
scheduledStartAt: body.scheduled_start_at,
scheduledEndAt: body.scheduled_end_at,
estimatedHours: body.estimated_hours,
```

**Line 209-215:** Transition route uses wrong event types
```typescript
// ❌ WRONG
event_type: z.enum([
  "job_approved",
  "job_assigned",
  "job_started",
  "job_completed",
  "job_cancelled",
]),

// ✅ SHOULD BE (matching state machine)
event_type: z.enum([
  "job_created",
  "job_requested",
  "job_accepted",
  "cleaner_en_route",
  "job_started",
  "job_completed",
  "client_approved",
  "client_disputed",
  "dispute_resolved",
  "job_cancelled",
]),
```

### 2. `src/services/jobsService.ts` - Service Function Mismatches

**Line 231-237:** logJobEvent call uses wrong parameter names
```typescript
// ❌ WRONG
await logJobEvent({
  jobId,
  eventName: eventType,
  clientId: job.client_id ?? undefined,
  cleanerId: job.cleaner_id ?? undefined,
  payload,
});

// ✅ SHOULD BE
await logJobEvent({
  jobId,
  actorType: role === "admin" ? "admin" : role,
  actorId: requesterId,
  eventName: eventType,
  payload,
});
```

**Line 218-227:** Missing GPS and timestamp updates
```typescript
// ❌ MISSING: check_in_at, check_out_at, GPS fields, cleaner_id assignment
// Current UPDATE only changes status

// ✅ SHOULD UPDATE:
// - check_in_at, check_in_lat, check_in_lng (on job_started)
// - check_out_at, check_out_lat, check_out_lng (on job_completed)
// - cleaner_id (on job_accepted)
// - payout_percentage_at_accept (on job_accepted)
// - actual_hours, final_charge_credits (on job_completed)
```

### 3. `src/services/jobEvents.ts` - Function Signature Mismatch

**Line 8-14:** Interface doesn't match usage
```typescript
// ⚠️ CURRENT: Has optional jobId, actorType, actorId
// ✅ CORRECT: But usage in jobsService.ts passes wrong params
// Fix: Update jobsService.ts to use correct parameter names
```

### 4. Package.json - Missing Dependencies

**Missing:**
- `stripe` - For Stripe SDK
- `jsonwebtoken` - For JWT auth
- `@neondatabase/serverless` - For Neon (currently using `pg`)
- `@types/jsonwebtoken` - JWT types
- `supertest` - For testing
- `vitest` - Test runner

---

## ⚠️ INCOMPLETE IMPLEMENTATIONS

### 1. Auth System (`src/middleware/auth.ts`)
- ❌ No JWT generation
- ❌ No password hashing
- ❌ No user registration
- ⚠️ Only reads headers (stub)

### 2. Payment Service (`src/services/paymentService.ts`)
- ❌ No Stripe SDK integration
- ❌ No webhook handling
- ❌ No payment_intents table operations
- ⚠️ Just placeholder comments

### 3. Admin Service (`src/services/adminJobsService.ts`)
- ❌ No KPI calculations
- ❌ No dispute management
- ❌ No override functionality
- ⚠️ Basic job listing only

### 4. Jobs Service (`src/services/jobsService.ts`)
- ⚠️ Missing: GPS field updates
- ⚠️ Missing: Timestamp updates (check_in_at, check_out_at)
- ⚠️ Missing: Cleaner assignment logic
- ⚠️ Missing: Payout percentage capture
- ⚠️ Missing: Final charge calculation

### 5. Routes (`src/routes/jobs.ts`)
- ⚠️ Missing: Cleaner-specific routes (accept, on_my_way, check_in, check_out)
- ⚠️ Missing: Client approval route
- ⚠️ Missing: Dispute route
- ⚠️ Uses wrong field names (see schema mismatches above)

---

## 📋 PRIORITIZED ACTION PLAN

### 🔴 PHASE 1: CRITICAL SCHEMA FIXES (Do First)

1. **Fix `src/routes/jobs.ts`**
   - Update Zod schemas to use correct field names
   - Fix createJob call parameters
   - Fix updateJob call parameters
   - Fix transition event types

2. **Fix `src/services/jobsService.ts`**
   - Update applyStatusTransition to handle GPS fields
   - Update to set check_in_at, check_out_at
   - Update to set cleaner_id on acceptance
   - Update to capture payout_percentage_at_accept
   - Fix logJobEvent parameter names

3. **Update `package.json`**
   - Add missing dependencies (stripe, jsonwebtoken, etc.)

### 🟡 PHASE 2: CREATE MISSING FOLDERS & CORE FILES

4. **Create folder structure**
   - `src/lib/`
   - `src/types/`
   - `src/workers/`
   - `src/tests/smoke/`
   - `src/tests/integration/`

5. **Create core utilities**
   - `src/lib/logger.ts` - JSON logger
   - `src/lib/validation.ts` - Zod middleware
   - `src/lib/events.ts` - Event publisher
   - `src/lib/httpClient.ts` - HTTP client

6. **Create type definitions**
   - `src/types/db.ts` - All DB interfaces matching schema exactly
   - `src/types/api.ts` - Request/response DTOs

### 🟢 PHASE 3: COMPLETE SERVICES

7. **Complete payment service**
   - Stripe SDK integration
   - Webhook handling
   - payment_intents table operations

8. **Create payout service**
   - Stripe Connect transfers
   - Payout processing
   - cleaner_earnings integration

9. **Create missing routes**
   - `src/routes/stripe.ts` - Webhook handler
   - `src/routes/events.ts` - n8n events

10. **Update main app**
    - Mount new routes
    - Add request logging
    - Add error handling

### 🔵 PHASE 4: WORKERS & TESTS

11. **Create workers**
    - Auto-cancel stale jobs
    - Process payouts
    - KPI snapshots

12. **Create tests**
    - Smoke tests
    - Integration tests

### 🟣 PHASE 5: DEPLOYMENT

13. **Create deployment files**
    - Dockerfile
    - .env.example

---

## ✅ WHAT'S ALREADY CORRECT

1. ✅ **State Machine** - Status values match Neon schema exactly
2. ✅ **Credits Service** - Uses `credit_transactions` table correctly
3. ✅ **Job Events Service** - Uses `app_events` table correctly
4. ✅ **Database Client** - Proper Pool setup
5. ✅ **Jobs Service Interface** - JobRow interface matches schema

---

## 🎯 SUCCESS CRITERIA

Backend is production-ready when:
- ✅ `npm run build` compiles with ZERO errors
- ✅ All routes use correct field names
- ✅ All services match Neon schema exactly
- ✅ State machine transitions work correctly
- ✅ Credit system works end-to-end
- ✅ Stripe webhook processes events
- ✅ Workers can run independently
- ✅ Tests pass

---

## 📝 NEXT STEPS

1. **Immediate:** Fix schema mismatches in routes and services
2. **Next:** Create missing folder structure and core files
3. **Then:** Complete payment and payout services
4. **Finally:** Add workers, tests, and deployment configs

**Recommended:** Start with Phase 1 (Critical Schema Fixes) - this will make the backend functional with the existing Neon database.

