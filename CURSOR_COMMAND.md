# 🚀 CURSOR AI COMMAND - Paste This Into Cursor Composer

## Copy and paste this ENTIRE block into Cursor's command box (Ctrl+K or Cmd+K):

---

You are the PureTask Backend AI Engineer. Your mission is to complete the entire backend to production-ready status.

## CRITICAL: Match Neon Schema Exactly

The database schema is in `DB/migrations/001_core_schema.sql`. NEVER guess column names. Always check the schema first.

**Key Schema Facts:**
- Job status enum: `'created', 'request', 'accepted', 'en_route', 'in_progress', 'awaiting_client', 'approved', 'disputed', 'cancelled'`
- Jobs table uses: `scheduled_start_at` (not `scheduled_start`), `check_in_at`/`check_out_at` (not `actual_start_at`/`actual_end_at`), `escrow_credits_reserved` (not `total_credits`)
- Credit table is `credit_transactions` (NOT `credit_ledger`)
- Events table is `app_events` (NOT `job_events`)

## Your Tasks (In This Order):

### STEP 1: Fix Existing Code to Match Schema
1. Read `DB/migrations/001_core_schema.sql` completely
2. Update `src/state/jobStateMachine.ts` to use correct status values: `created`, `request`, `accepted`, `en_route`, `in_progress`, `awaiting_client`, `approved`, `disputed`, `cancelled`
3. Fix `src/services/jobsService.ts` to use correct column names (`scheduled_start_at`, `check_in_at`, `check_out_at`, `escrow_credits_reserved`)
4. Fix `src/services/creditsService.ts` to use `credit_transactions` table (not `credit_ledger`)
5. Fix `src/services/jobEvents.ts` to use `app_events` table (not `job_events`)
6. Update all route handlers to use correct column names

### STEP 2: Create Missing Folder Structure
Create these folders if they don't exist:
- `src/lib/` (for shared utilities)
- `src/types/` (for TypeScript type definitions)
- `src/workers/` (for background jobs)
- `src/tests/smoke/` and `src/tests/integration/`

### STEP 3: Create Missing Core Files
1. **`src/lib/logger.ts`** - Centralized JSON logger (info, warn, error methods)
2. **`src/lib/validation.ts`** - Zod validation middleware helper
3. **`src/types/db.ts`** - TypeScript interfaces matching EXACT Neon schema:
   - `JobRow` with all columns from jobs table
   - `CreditTransaction` matching credit_transactions
   - `AppEvent` matching app_events
   - `User`, `CleanerEarning`, `Payout` types
4. **`src/types/api.ts`** - Request/response DTOs

### STEP 4: Complete Services
1. **`src/services/creditsService.ts`** - Full implementation:
   - `holdCreditsForJob()` - Escrow credits
   - `releaseHeldCredits()` - Release on cancel
   - `chargeCreditsForJob()` - Final charge
   - `refundCreditsForJob()` - Refund on dispute
   - Use `credit_transactions` table with proper transaction handling
2. **`src/services/paymentService.ts`** - Stripe integration:
   - `createPaymentIntent()` - Create Stripe PI
   - `handleStripeWebhook()` - Process webhook events
   - Store in `payment_intents` table (create if needed in migration)
3. **`src/services/payoutsService.ts`** - NEW FILE:
   - `createPayoutForCleaner()` - Create payout record
   - `processPayouts()` - Stripe Connect transfers
   - Use `payouts` and `cleaner_earnings` tables

### STEP 5: Create Missing Routes
1. **`src/routes/stripe.ts`** - NEW FILE:
   - `POST /stripe/webhook` - Handle Stripe webhooks
   - Use `express.raw()` for body parsing
   - Verify signature with `STRIPE_WEBHOOK_SECRET`
2. **`src/routes/events.ts`** - NEW FILE:
   - `POST /events` or `POST /n8n/events` - Accept events from n8n
   - Validate request, call `publishEvent()`

### STEP 6: Update Main App
1. Update `src/index.ts` to use logger
2. Update `src/app.ts` (or create if missing) to:
   - Mount `/stripe` and `/events` routes
   - Add request logging middleware
   - Add proper error handling

### STEP 7: Create Workers
1. **`src/workers/autoCancelStaleJobs.ts`** - Cancel jobs in `request` status >30 min old
2. **`src/workers/processPayouts.ts`** - Process pending payouts weekly
3. **`src/workers/kpiDailySnapshot.ts`** - Daily KPI aggregation

### STEP 8: Add Dependencies
Update `package.json` to include:
- `stripe` (for Stripe SDK)
- `jsonwebtoken` (for JWT auth)
- `@types/jsonwebtoken`
- `supertest` and `vitest` (for tests)

### STEP 9: Create Tests
1. **`src/tests/smoke/jobLifecycle.test.ts`** - Full lifecycle test
2. Use supertest to test endpoints

### STEP 10: Deployment Files
1. **`Dockerfile`** - Multi-stage build for production
2. **`.env.example`** - Template with all required env vars

## Rules:
- ✅ ALWAYS check `DB/migrations/001_core_schema.sql` before writing SQL
- ✅ Use TypeScript strict mode
- ✅ All database queries use `query<T>()` from `src/db/client.ts`
- ✅ All state changes go through state machine
- ✅ All state changes emit events via `publishEvent()`
- ✅ Use Zod for all request validation
- ✅ Log all errors with logger
- ✅ Return consistent JSON error format: `{ error: { code: string, message: string } }`

## Success Criteria:
- `npm run build` compiles with ZERO errors
- All services use correct table/column names
- State machine matches Neon schema exactly
- Credit system works end-to-end
- Stripe webhook processes events

Start with STEP 1 and work through each step systematically. Show me your progress after each major step.

---

## After pasting, click "Run" or press Enter in Cursor!

