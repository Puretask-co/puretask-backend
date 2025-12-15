# V1 COMPLETION PLAN

## Status
Canonical – V1 Launch Execution  
**Goal:** Ship a safe, correct marketplace with real money. Everything else can wait.

---

## V1 Mission Statement

Client can book → pay (credits) → get matched → job completes → cleaner gets paid → basic support/admin can resolve issues.

V1 is **stable, auditable, and operable with a small team**.

---

## Pre-Flight Checklist

Before starting, confirm:
- [ ] Blueprint documents exist in `/docs/blueprint/`
- [ ] `PURETASK_V1_SCOPE_LOCK.md` reviewed and agreed upon
- [ ] Current codebase inventory completed
- [ ] Team understands: **no features outside V1 scope**

---

## Phase 1: Schema Canonization (Days 1-2)

### Task 1.1: Fix Baseline Migration
**Files to touch:**
- `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`

**What to do:**
1. Ensure this is the **ONLY** migration that creates tables
2. Confirm `users.id` is `TEXT` (not UUID)
3. Find all foreign keys referencing `users(id)`:
   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE column_name LIKE '%user%' OR column_name LIKE '%cleaner%' OR column_name LIKE '%client%';
   ```
4. Change any `UUID` FKs to `TEXT` to match `users.id`
5. Remove any commented-out `CREATE TABLE` blocks
6. Remove any migrations that recreate tables already in baseline

**Test:**
```bash
# Create fresh Neon DB
# Run ONLY 000_CONSOLIDATED_SCHEMA.sql
# Start app: npm run dev
# Must boot without schema errors
```

**Done when:** Fresh DB boots app cleanly with zero FK type mismatches.

---

### Task 1.2: Add Hardening Migrations
**Files to create:**
- `DB/migrations/hardening/901_stripe_events_processed.sql`
- `DB/migrations/hardening/902_ledger_idempotency_constraints.sql`
- `DB/migrations/hardening/903_payout_items_uniqueness.sql`
- `DB/migrations/hardening/904_worker_runs_table.sql`

**What to do:**
1. Create `hardening/` subfolder
2. Copy migrations from `PURETASK_HARDENING_MIGRATIONS.md` (or generate them)
3. Apply to dev DB
4. Verify no breaking changes

**Test:**
```bash
npm run migrate  # or your migration command
# App still boots
# Existing flows still work
```

**Done when:** Migrations applied, no errors, app functional.

---

## Phase 2: Code Hardening (Days 3-5)

### Task 2.1: Stripe Webhook Idempotency
**Files to touch:**
- `src/routes/stripe.ts` (or wherever webhook handler lives)
- `src/services/stripeService.ts` (if separate)

**What to do:**
1. Import/create `markStripeEventProcessedOnce()` function
2. Wrap webhook handler:
   ```ts
   // BEGIN transaction
   // Check if event already processed
   // If yes → return 200 immediately
   // If no → apply effects + mark processed
   // COMMIT
   ```
3. Use `stripe_events_processed` table with unique constraint

**Test:**
```bash
# Send same Stripe webhook 3 times
# Credits should only increase once
# Check ledger_entries for duplicates
```

**Done when:** Webhook replay does not duplicate credits.

---

### Task 2.2: Escrow Reservation Idempotency
**Files to touch:**
- `src/services/creditsService.ts`
- `src/routes/jobs.ts` (booking endpoint)

**What to do:**
1. Wrap escrow reservation in `insertLedgerOnce()` with unique constraint
2. Ensure booking endpoint can be retried safely

**Test:**
```bash
# Send same create-job request twice (or near-duplicate)
# Verify no single job has two escrow reserves
# Check ledger_entries uniqueness
```

**Done when:** Booking retries don't double-reserve escrow.

---

### Task 2.3: Job Completion Atomic Guard
**Files to touch:**
- `src/routes/jobs.ts` (completion endpoint)
- `src/services/jobService.ts`

**What to do:**
1. Use atomic state transition:
   ```ts
   UPDATE jobs 
   SET state = 'COMPLETED' 
   WHERE id = $1 AND state = 'IN_PROGRESS'
   ```
2. If `rowCount === 0` → return 409 (already completed/invalid)
3. Then apply escrow release + earnings credit (idempotent ledger inserts)

**Test:**
```bash
# Call complete endpoint twice
# First call succeeds
# Second call returns 409
# Cleaner earnings credited exactly once
```

**Done when:** Double completion calls don't duplicate earnings.

---

### Task 2.4: Weekly Payout Lock + Idempotency
**Files to touch:**
- `src/workers/payoutWeekly.ts`

**What to do:**
1. Add `withAdvisoryLock()` wrapper (from code snippets)
2. Use `payout_items` table with unique `ledger_entry_id`
3. Insert eligible earnings into `payout_items` (conflicts ignored)
4. Compute totals from `payout_items`, not raw ledger

**Test:**
```bash
# Run payout-weekly twice immediately
# First run creates payout
# Second run creates nothing
# Verify payout_items unique constraint prevents duplicates
```

**Done when:** Payout reruns don't double-pay.

---

### Task 2.5: Worker Concurrency Guards
**Files to touch:**
- `src/workers/index.ts`
- Each worker file

**What to do:**
1. Wrap each worker in `runWorkerSafely()` with advisory lock
2. Add `worker_runs` logging

**Test:**
```bash
# Trigger same worker twice concurrently
# Only one should run
# Other should exit cleanly
```

**Done when:** Workers don't overlap.

---

## Phase 3: Environment & Guards (Day 6)

### Task 3.1: Environment Lockdown
**Files to create:**
- `.env.example`
- `.env.development`
- `.env.production` (DO NOT COMMIT)

**What to do:**
1. Copy template from `ENVIRONMENT_LOCKDOWN.md`
2. Add boot-time validation:
   ```ts
   const required = ['DATABASE_URL', 'JWT_SECRET', 'STRIPE_MODE', ...];
   required.forEach(k => {
     if (!process.env[k]) throw new Error(`Missing: ${k}`);
   });
   ```
3. Validate Stripe mode matches key prefix

**Test:**
```bash
# Start app with missing env var → must crash
# Start app with STRIPE_MODE=test and sk_live_ → must crash
```

**Done when:** App refuses to start if misconfigured.

---

### Task 3.2: Production Guard Flags
**Files to touch:**
- `src/index.ts` (boot checks)
- `src/routes/*.ts` (guard middleware)

**What to do:**
1. Add route guards:
   - `BOOKINGS_ENABLED`
   - `CREDITS_PURCHASE_ENABLED`
   - `PAYOUTS_ENABLED`
   - `REFUNDS_ENABLED`
2. Add worker master toggle:
   - `WORKERS_ENABLED`
   - Per-worker toggles

**Test:**
```bash
# Set BOOKINGS_ENABLED=false
# POST /jobs → 503
```

**Done when:** All guards functional.

---

## Phase 4: Testing Gates (Days 7-8)

### Task 4.1: Unit & Integration Tests
**Files to create/update:**
- `src/tests/smoke/`
- `src/tests/integration/`

**What to test:**
- [ ] Health check
- [ ] DB connection
- [ ] Full booking → completion flow
- [ ] Cancellation → refund flow
- [ ] Credit purchase → ledger correctness

**Done when:** All tests pass.

---

### Task 4.2: Worker Dry Run
**Execute in order:**
1. `npm run worker:webhook-retry`
2. `npm run worker:retry-notifications`
3. `npm run worker:auto-expire`
4. `npm run worker:auto-cancel`
5. `npm run worker:stuck-detection`
6. `npm run worker:payout-retry`
7. `npm run worker:payout-weekly` (only after completed jobs exist)
8. `npm run worker:backup-daily`

**Verify:**
- Each worker runs without crashing
- No duplicate ledger entries
- No duplicate payouts
- Jobs don't get stuck

**Done when:** All workers behave correctly.

---

### Task 4.3: Stripe E2E Test
**Follow:** `STRIPE_END_TO_END_TEST_SCRIPT.md`

**Verify:**
- Credits purchase → webhook → ledger correct
- Booking → escrow reserved
- Completion → escrow released + earnings credited
- Payout-weekly → sends once, rerun sends nothing

**Done when:** All Stripe flows idempotent.

---

## Phase 5: Deployment (Days 9-10)

### Task 5.1: Railway Setup
**Follow:** `RAILWAY_DEPLOYMENT_PLAN_V1.md`

**Steps:**
1. Create `api` service (WORKERS_ENABLED=false)
2. Create `worker` service (WORKERS_ENABLED=true)
3. Configure env vars
4. Set up Stripe webhook endpoint
5. Configure cron schedules

**Done when:** Staging deploy successful.

---

### Task 5.2: Production Launch Sequence
**Follow:** `LAUNCH_DAY_RUNBOOK.md`

**Steps:**
1. Deploy API first
2. Validate health + webhook endpoints
3. Enable workers one-by-one
4. Monitor logs for 1 hour
5. Run smoke tests

**Done when:** Production stable for 24 hours.

---

## V1 Done Criteria (Non-Negotiable)

✅ All tests pass  
✅ Schema canonical (one baseline, no drift)  
✅ Webhook replay doesn't duplicate credits  
✅ Completion doesn't duplicate earnings  
✅ Payout rerun doesn't double-pay  
✅ Workers don't overlap  
✅ Admin can refund/reassign  
✅ Env guards prevent misconfig  
✅ Production runs for 7 days without incidents  

---

## Kill Switches Available

If anything breaks:
- `WORKERS_ENABLED=false` → stops all workers
- `PAYOUTS_ENABLED=false` → stops payouts
- `BOOKINGS_ENABLED=false` → stops new bookings
- `CREDITS_PURCHASE_ENABLED=false` → stops credit purchases

---

## What NOT to Build in V1

❌ Subscriptions  
❌ Boosts  
❌ Auto-matching  
❌ Complex analytics  
❌ Risk automation  
❌ Instant payouts  

These belong in V2-V5.

---

End of document.

