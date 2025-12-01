# PureTask Backend - Complete Build Plan for Cursor AI

## 🎯 Current State Analysis

### ✅ What EXISTS (Working)
- Basic Express server (`src/index.ts`)
- Database client (`src/db/client.ts`) with Neon Pool
- Environment config (`src/config/env.ts`)
- Basic auth middleware (`src/middleware/auth.ts`) - STUB
- Job routes (`src/routes/jobs.ts`) - PARTIAL
- Admin routes (`src/routes/admin.ts`) - PARTIAL
- Health route (`src/routes/health.ts`)
- Job state machine (`src/state/jobStateMachine.ts`) - NEEDS SCHEMA ALIGNMENT
- Services: jobsService, creditsService, paymentService, jobEvents - ALL PARTIAL
- Database migrations exist in `DB/migrations/`

### ❌ What's MISSING (Critical)
1. **Complete folder structure** - Missing many files from spec
2. **Stripe integration** - No webhook route, no real payment service
3. **n8n router** - `/events` route doesn't exist
4. **Workers** - No auto-cancel, payout, KPI workers
5. **Tests** - No test files
6. **Logging system** - No centralized logger
7. **Full credit system** - Credits service incomplete
8. **Payouts** - No Stripe Connect implementation
9. **Notifications** - No SendGrid/Twilio/OneSignal
10. **Type definitions** - Missing `src/types/db.ts` and `src/types/api.ts`
11. **Validation middleware** - No Zod validation helpers
12. **Event system** - Job events service incomplete
13. **Dockerfile** - Not created
14. **.env.example** - Not created

### ⚠️ What's INCOMPLETE (Started but not finished)
1. **Auth system** - Stub only, no JWT generation
2. **Job state machine** - Statuses don't match Neon schema exactly
3. **Jobs service** - Column names may not match DB
4. **Credits service** - Uses wrong table name (`credit_ledger` vs `credit_transactions`)
5. **Payment service** - References non-existent `payment_intents` table
6. **Job events** - Uses `job_events` table but schema has `app_events`
7. **Admin service** - Basic only, missing KPIs, disputes, overrides

## 📋 Build Priority Order

### Phase 1: Foundation (Do First)
1. ✅ Fix database schema alignment - Match ALL code to Neon migrations
2. ✅ Create missing folder structure (`lib/`, `types/`, `workers/`, `tests/`)
3. ✅ Fix state machine to match Neon `job_status` enum exactly
4. ✅ Create proper TypeScript types matching DB schema
5. ✅ Fix credits service to use `credit_transactions` table
6. ✅ Fix job events to use `app_events` table
7. ✅ Create centralized logger (`src/lib/logger.ts`)
8. ✅ Create validation middleware (`src/lib/validation.ts`)

### Phase 2: Core Services (Do Second)
9. ✅ Complete jobs service with correct column names
10. ✅ Implement full credit system (hold, release, charge, refund)
11. ✅ Create Stripe webhook route (`src/routes/stripe.ts`)
12. ✅ Create n8n events route (`src/routes/events.ts`)
13. ✅ Implement payment service with Stripe SDK
14. ✅ Create payout service with Stripe Connect
15. ✅ Complete admin service (KPIs, disputes, overrides)

### Phase 3: Workers & Automation (Do Third)
16. ✅ Create worker: `autoCancelStaleJobs.ts`
17. ✅ Create worker: `payoutWeekly.ts`
18. ✅ Create worker: `kpiDailySnapshot.ts`
19. ✅ Create worker: `retryFailedNotifications.ts`

### Phase 4: Testing & Deployment (Do Last)
20. ✅ Create smoke tests (`src/tests/smoke/jobLifecycle.test.ts`)
21. ✅ Create integration tests
22. ✅ Create Dockerfile
23. ✅ Create `.env.example`
24. ✅ Update package.json with missing dependencies

## 🔧 Exact Neon Schema Reference

From `DB/migrations/001_core_schema.sql`:

**Job Status Enum:**
```sql
'created', 'request', 'accepted', 'en_route', 'in_progress', 
'awaiting_client', 'approved', 'disputed', 'cancelled'
```

**Jobs Table Columns:**
- `scheduled_start_at` (not `scheduled_start`)
- `scheduled_end_at` (not `scheduled_end`)
- `check_in_at`, `check_out_at` (not `actual_start_at`, `actual_end_at`)
- `check_in_lat`, `check_in_lng`, `check_out_lat`, `check_out_lng`
- `escrow_credits_reserved` (not `total_credits`)
- `snapshot_base_rate_cph`, `snapshot_addon_rate_cph`, `snapshot_total_rate_cph`
- `payout_percentage_at_accept`
- `final_charge_credits`, `refund_credits`
- `dispute_status`, `dispute_reason`, `dispute_details`

**Credit Transactions Table:**
- Table name: `credit_transactions` (NOT `credit_ledger`)
- Columns: `id`, `client_id`, `job_id`, `type`, `amount_credits`, `balance_after`, `note`, `created_at`

**App Events Table:**
- Table name: `app_events` (NOT `job_events`)
- Columns: `id`, `job_id`, `actor_type`, `actor_id`, `event_name`, `payload_json`, `occurred_at`

## 🎯 Success Criteria

Backend is "production-ready" when:
- ✅ `npm run build` compiles with ZERO TypeScript errors
- ✅ `npm run dev` starts server without crashes
- ✅ All routes return proper JSON responses
- ✅ State machine enforces all transitions correctly
- ✅ Credit system works end-to-end (hold → charge → refund)
- ✅ Stripe webhook processes events
- ✅ Workers can run independently
- ✅ Tests pass
- ✅ Docker container builds and runs

