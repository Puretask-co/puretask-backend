# Master Checklist — Execution Guide (How to Complete Every Task)

**Purpose:** Step-by-step guide to complete every task in [MASTER_CHECKLIST.md](../versions/MASTER_CHECKLIST.md) (V1–V5). For each task this doc explains **what it does**, **why it matters**, and **how to complete it**.  
**Use with:** Check off items in the checklist as you go; use this guide for the “how” and “why.”

---

## How to use this guide

- **Task format:** Each task has **What it does**, **Why it matters**, **How to complete**, and **Verify**.
- **Order:** Do tasks in the order they appear in the checklist (V1 → V2 → …). Prerequisites are stated per version.
- **Tests:** Where the checklist says “Test: …”, run the suggested test before marking done.
- **References:** See [SETUP.md](./SETUP.md), [RUNBOOK.md](./RUNBOOK.md), [ARCHITECTURE.md](./ARCHITECTURE.md) for env, ops, and code layout.

---

# V1: SAFE MARKETPLACE LAUNCH

**Goal:** Ship a safe, correct marketplace with real money. V1 focuses on schema consistency, idempotency (no double credits/earnings/payouts), env guards, tests, and deployment.

---

## Phase 1: Schema Canonization

### Task 1.1: Fix Baseline Migration

**What it does:** Ensures the single baseline migration (`000_COMPLETE_CONSOLIDATED_SCHEMA.sql` or `000_CONSOLIDATED_SCHEMA.sql`) uses one consistent type for `users.id` (TEXT) and that every foreign key referencing `users(id)` matches. Removes dead code (commented CREATE TABLEs, migrations that recreate existing tables) so a fresh DB boots the app with no FK type mismatches.

**Why it matters:** If `users.id` is TEXT but some FKs are UUID (or vice versa), Postgres will reject joins or migrations. One canonical schema avoids drift between dev/staging/prod and makes restores and new environments reliable.

**How to complete:**
1. Open `DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql` (or `000_CONSOLIDATED_SCHEMA.sql`).
2. Confirm `users.id` is `TEXT` (e.g. `id TEXT PRIMARY KEY`).
3. Search for all `REFERENCES users(id)` and any `uuid`-typed columns that reference users; change those columns to `TEXT` so they match `users.id`.
4. Remove any commented-out `CREATE TABLE` blocks.
5. Remove or merge migrations that recreate tables already created in the baseline (so the baseline is the single source of truth).
6. Run a fresh migration: drop DB (or use a new DB), run `npm run db:migrate` (or apply the consolidated schema only), then start the app and hit `/health` and a protected route.

**Verify:** Fresh DB boots with zero FK type mismatches; app starts and connects to DB; no migration errors.

---

### Task 1.2: Add Hardening Migrations

**What it does:** Adds four hardening migrations in `DB/migrations/hardening/`: (901) table to record processed Stripe events so webhooks are idempotent; (902) constraints so ledger entries are idempotent; (903) uniqueness on payout_items so the same ledger entry cannot be paid twice; (904) worker_runs table to log and coordinate worker execution. Applying them to dev ensures the app and workers still work.

**Why it matters:** These migrations are the DB foundation for “no double credits, no double payouts, no overlapping workers.” Without them, code-level idempotency is harder to enforce and duplicate runs can cause financial or data bugs.

**How to complete:**
1. Create `DB/migrations/hardening/` if it doesn’t exist.
2. Add `901_stripe_events_processed.sql`: table keyed by Stripe event id (or use existing `stripe_events` / `webhook_events` if already present—see migration `020_stripe_object_processed.sql`).
3. Add `902_ledger_idempotency_constraints.sql`: unique constraint(s) on credit_ledger so the same business key (e.g. job_id + type) cannot be inserted twice.
4. Add `903_payout_items_uniqueness.sql`: unique constraint on `payout_items(ledger_entry_id)` so one ledger entry appears in at most one payout.
5. Add `904_worker_runs_table.sql`: table for worker run id, worker name, started_at, finished_at, status (running/success/failure).
6. Apply in order: run `npm run db:migrate`; start app and run a few flows (create job, complete, run payout worker if applicable).

**Verify:** Migrations apply with no errors; app boots; existing flows (bookings, credits, payouts) still work.

---

## Phase 2: Code Hardening

### Task 2.1: Stripe Webhook Idempotency

**What it does:** Ensures each Stripe webhook event (e.g. `payment_intent.succeeded`) is processed at most once. Before applying credits or updating state, the handler checks whether the event id is already recorded; if so, returns 200 without changing anything. Prevents duplicate credits when Stripe retries or when the same event is replayed.

**Why it matters:** Stripe can retry webhooks. Without idempotency, a single payment could add credits twice (or more), causing revenue loss and incorrect balances.

**How to complete:**
1. Locate the webhook handler: `src/routes/stripe.ts`.
2. Use the table from 901 (or existing `stripe_events` / `webhook_events` from migration 020/042).
3. At the start of the handler: get Stripe event id from the payload; check if already processed (SELECT or INSERT … ON CONFLICT DO NOTHING then check); if already processed, return 200 immediately.
4. Only if not processed: verify signature, process the event (e.g. add credits), then record the event id as processed.
5. Test: send the same webhook payload 3 times (Stripe CLI or test script); credits should increase only once.

**Verify:** Replaying the same webhook 3x results in credits increasing once; no duplicate ledger rows for the same event.

---

### Task 2.2: Escrow Reservation Idempotency

**What it does:** Ensures that when a booking is created (or credits are reserved for a job), the “reserve escrow” step is idempotent: retrying the same booking/reservation does not double-reserve credits. Implemented by a unique business key (e.g. job_id + entry type) and INSERT with ON CONFLICT or a “insert once” helper.

**Why it matters:** Network or client retries can send “create booking” twice. Without idempotency, the same job could reserve escrow twice and lock double the credits.

**How to complete:**
1. Open `src/services/creditsService.ts`; find the path that inserts a “reservation” or “escrow” ledger entry when a job is created or booked.
2. Use a unique key (job_id, entry_type) and INSERT with ON CONFLICT DO NOTHING (or check-before-insert). If the row already exists, treat as success.
3. Test: create the same booking twice (same idempotency key or retry); escrow balance should reflect one reservation, not two.

**Verify:** Booking retries do not double-reserve escrow.

---

### Task 2.3: Job Completion Atomic Guard

**What it does:** Makes job completion atomic and idempotent: only one transition from “in progress” to “completed” is allowed; duplicate completion requests return 409 and do not release escrow or add earnings again.

**Why it matters:** Double completion could release escrow twice and credit earnings twice, causing incorrect balances and potential double payouts.

**How to complete:**
1. Find the completion endpoint (e.g. `src/routes/tracking.ts` or `src/routes/jobs.ts`) and the service that updates job state and releases escrow.
2. Use atomic UPDATE: `UPDATE jobs SET status = 'COMPLETED', ... WHERE id = $1 AND status = 'IN_PROGRESS'`. If UPDATE affects 0 rows, return 409 Conflict.
3. Only after successful transition: release escrow and add earnings (idempotent ledger entries).
4. Test: call completion twice for the same job; second call returns 409; earnings and escrow change only once.

**Verify:** Double completion calls do not duplicate earnings; second call returns 409.

---

### Task 2.4: Weekly Payout Lock + Idempotency

**What it does:** Ensures the weekly payout worker runs at most one logical “payout run” at a time (advisory lock) and that the same ledger entries are not paid twice. Payout amounts are derived from `payout_items` with unique constraint on `ledger_entry_id`; rerunning the worker does not create duplicate payout items.

**Why it matters:** Without a lock, two instances could run payouts concurrently; without idempotency, a rerun could pay the same earnings again.

**How to complete:**
1. Open `src/workers/v1-core/payoutWeekly.ts`. Wrap the payout logic in an advisory lock (e.g. `pg_advisory_lock` with a key for `'payout_weekly'`).
2. When creating payout items, respect unique constraint on `ledger_entry_id`; use ON CONFLICT DO NOTHING or check before insert so the same ledger entry is never added twice.
3. Compute totals from existing `payout_items` for the period so reruns don’t add new items.
4. Test: run the worker twice; second run should not create duplicate payouts.

**Verify:** Payout reruns do not double-pay; advisory lock prevents concurrent runs.

---

### Task 2.5: Worker Concurrency Guards

**What it does:** Ensures background workers do not run overlapping copies. Each worker is wrapped in a “run safely” helper that takes an advisory lock (or uses `worker_runs` to detect an already-running instance), runs the worker, and logs the run. Prevents duplicate processing.

**Why it matters:** Overlapping workers can double-apply payouts, notifications, or state changes.

**How to complete:**
1. Implement `runWorkerSafely(workerName, fn)`: acquire advisory lock for workerName (or insert “running” in worker_runs), run fn(), release lock (or set “success”/“failure”).
2. Wrap each worker entry point (e.g. in `src/workers/scheduler.ts` or each worker file) with `runWorkerSafely('worker-name', async () => { ... })`.
3. Test: trigger the same worker twice in quick succession; only one should perform the work.

**Verify:** Workers do not overlap; worker_runs shows one run at a time per worker.

---

## Phase 3: Environment & Guards

### Task 3.1: Environment Lockdown

**What it does:** Ensures the app has a clear list of required env vars and refuses to start if critical ones are missing or invalid (e.g. Stripe key prefix must match NODE_ENV). `.env.example` documents required vars; boot-time validation in `src/config/env.ts` throws on misconfiguration.

**Why it matters:** Running in production with a test Stripe key or missing DB URL causes data or money to go to the wrong place.

**How to complete:**
1. Create `.env.example` with every required variable (no secrets).
2. In `src/config/env.ts`: at app start, read required vars (DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, etc.) and throw a clear error if any are missing.
3. Add a check that Stripe key prefix matches environment (sk_live_ in production, sk_test_ in development).
4. Test: start the app with a required var unset; app should crash with a clear message.

**Verify:** App crashes on missing or invalid critical env.

---

### Task 3.2: Production Guard Flags

**What it does:** Adds feature toggles (WORKERS_ENABLED, BOOKINGS_ENABLED, CREDITS_ENABLED, PAYOUTS_ENABLED, REFUNDS_ENABLED, plus per-worker toggles) and route guards so you can disable workers or high-risk features without redeploying.

**Why it matters:** If something goes wrong (e.g. payout bug), you can turn off payouts immediately.

**How to complete:**
1. Add env vars for each flag; in worker runner, skip workers whose flag is false; in routes (bookings, credits, payouts, refunds), check the flag and return 503 or 403 if disabled.
2. Test: set a flag to false; verify the related actions are blocked.

**Verify:** All guards work; disabling a feature prevents the corresponding actions.

---

## Phase 4: Testing Gates

### Task 4.1: Unit & Integration Tests

**What it does:** Adds or extends tests for: health check, DB connection, full booking → completion flow, cancellation → refund flow, credit purchase → ledger. Catches regressions before deploy.

**Why it matters:** Without tests, changes can break money or booking flows in production.

**How to complete:**
1. Add health check test (GET /health, GET /health/ready) and DB connection test.
2. Add integration test: create booking → accept → start → complete; assert job state and ledger/escrow.
3. Add cancellation → refund test; add credit purchase (or webhook) test.
4. Run `npm run test` and `npm run test:integration`.

**Verify:** All tests pass; critical paths covered.

---

### Task 4.2: Worker Dry Run

**What it does:** Run each worker once in a safe environment to confirm it doesn’t crash and doesn’t create duplicates. Workers: webhook-retry, retry-notifications, auto-expire, auto-cancel, payout-weekly (after completed jobs), backup-daily, etc.

**Why it matters:** Workers often have edge cases; a dry run catches crashes and duplicate behavior.

**How to complete:**
1. Use a test DB; run each worker via its npm script.
2. Check logs for errors; check DB for duplicate rows when run twice (e.g. payout_items, notifications).

**Verify:** No worker crashes; no duplicates when run twice.

---

### Task 4.3: Stripe E2E Test

**What it does:** End-to-end validation: credit purchase → webhook → ledger; booking → escrow reserved; completion → escrow released + earnings; payout-weekly runs once and rerun does not double-pay. Validates that all Stripe and money flows are idempotent and correct.

**Why it matters:** This is the “money path” validation.

**How to complete:**
1. Use Stripe CLI to send payment_intent.succeeded; verify ledger increases once; replay and verify no second increase.
2. Create a booking and verify escrow; complete job and verify escrow release and earnings; run payout-weekly twice and verify no duplicate payout.
3. Automate where possible (integration test with Stripe test mode).

**Verify:** All flows idempotent; ledger and payouts match expectations.

---

## Phase 5: Deployment

### Task 5.1: Railway Setup

**What it does:** Creates API service (WORKERS_ENABLED=false) and worker service (WORKERS_ENABLED=true) on Railway, with env vars, Stripe webhook URL, and cron/scheduler configured.

**Why it matters:** Separating API and workers allows scaling and avoids workers blocking the API.

**How to complete:**
1. Create `api` service: build and start from DEPLOYMENT.md; set env; WORKERS_ENABLED=false.
2. Create `worker` service: same codebase, run scheduler; WORKERS_ENABLED=true; same DB/Stripe env.
3. Configure Stripe webhook to API URL (e.g. `https://your-api.railway.app/stripe/webhook`).
4. Configure cron or Railway scheduler for workers.
5. Deploy and run smoke tests.

**Verify:** Staging deploy successful; health and webhook respond; workers run on schedule.

---

### Task 5.2: Production Launch

**What it does:** Deploys API first, validates health and webhooks, enables workers one by one while monitoring. Smoke tests and 24 hours stable.

**How to complete:**
1. Deploy API to production; leave workers disabled initially.
2. Validate health and Stripe webhook; enable workers one by one; watch logs (Sentry, Railway).
3. Run smoke tests; monitor 1 hour then 24 hours.

**Verify:** Production stable 24 hours; no critical errors.

---

## V1 Done Criteria (recap)

All tests pass; schema canonical; webhook replay does not duplicate credits; completion does not duplicate earnings; payout rerun does not double-pay; workers don’t overlap; admin can refund/reassign; env guards prevent misconfig; production 7 days without incidents. Then wait 2–4 weeks before V2.

---

# V2–V5: Summary of What Each Task Does and Why

*(Full “how to complete” for every V2–V5 task would make this document very long. Below is a concise pass: what each task does and why it matters. Use the same pattern as V1 for “how to complete”: identify the right files from ARCHITECTURE.md and RUNBOOK.md, implement the behavior, add tests, then verify.)*

---

## V2: Trust & Reliability Layer

**Goal:** Reduce manual ops, increase trust. **Prerequisite:** V1 stable 2–4 weeks.

| Task | What it does | Why it matters |
|------|----------------|----------------|
| **1.1 Availability UI** | GET/POST `/cleaner/availability`, time-off, service-areas so cleaners can set when/where they work. | Matching must respect availability or you get no-shows and cancellations. |
| **1.2 Admin matching uses availability** | Filter suggested/assignable cleaners by availability window, time off, service area. | Only available cleaners should appear for a job. |
| **2.1 Verify reliability worker** | Confirm reliabilityRecalc runs nightly and updates scores/tiers from job events. | Scores drive tier, visibility, and pay; stale scores break fairness. |
| **2.2 Admin views reliability** | GET `/admin/cleaner/:id/reliability` returns score, tier, history. | Ops need to debug “why is this cleaner’s tier low?” |
| **2.3 Tier assignment** | Define tier thresholds; assign tiers from score (and job count); store in tier_history. | Tiers drive pricing and matching; must be consistent. |
| **3.1 Dispute creation** | POST `/jobs/:id/dispute` creates dispute record (state=CREATED) linked to job with reason. | Single, auditable path to start resolution. |
| **3.2 Evidence upload** | POST `/disputes/:id/evidence` for photos/files; cleaner can respond. | Resolution needs evidence in one place. |
| **3.3 Admin resolution** | GET `/admin/disputes`, POST `/admin/disputes/:id/resolve` with outcome; apply refunds/adjustments and update reliability. | Centralized resolution keeps outcomes consistent and auditable. |
| **3.4 Dispute SLA (optional)** | Flag disputes in EVIDENCE_COLLECTION > 7 days; surface to admin. | Reduces stale disputes. |
| **4.1 Delivery tracking** | Log every notification send to notification_log; admin can view. | Debug “did they get the email?” and improve reliability. |
| **4.2 Confirmation nudges** | Remind cleaner to confirm; remind before job start; cancel reminder if job cancelled. | Reduces no-shows and last-minute cancellations. |

---

## V3: Automation & Growth Layer

**Goal:** Scale volume without scaling ops. **Prerequisite:** V2 stable 2–4 weeks.

| Task | What it does | Why it matters |
|------|----------------|----------------|
| **1.1 Eligibility filtering** | Before ranking, filter out cleaners who are unavailable, on time off, outside area, inactive, below min tier, or have conflicting job. | Ranking only makes sense among eligible cleaners. |
| **1.2 Ranking & scoring** | Score eligible cleaners (reliability, tier, distance, recency); return top 3–5. | Good ranking improves fill rate without auto-assignment. |
| **1.3 Suggestion endpoint** | GET `/jobs/:id/suggested-cleaners` returns top 3–5; admin still approves. | Reduces manual search; keeps human-in-the-loop. |
| **1.4 Preference matching (optional)** | Factor in job-type preferences, preferred cleaner, subscription continuity into rank. | Improves acceptance and retention. |
| **2.1 Tier-aware pricing** | Pricing uses cleaner tier (bands); price snapshot at booking so tier changes don’t change agreed price. | Fair pricing and predictable revenue. |
| **2.2 Pricing visibility** | API returns breakdown: base, tier adjustment, platform fee, total. | Transparency and compliance. |
| **3.1 Subscription creation** | POST `/subscriptions` with service type, frequency, time window, optional preferred cleaner; state=ACTIVE. | Foundation for recurring revenue. |
| **3.2 Recurring job generation** | Worker creates one job per subscription per cycle; idempotent; reserve credits. | Core of “recurring” behavior. |
| **3.3 Subscription lifecycle** | Pause, resume, cancel endpoints; job generation skips paused/cancelled. | Client control; reduces churn. |
| **3.4 Cleaner continuity (optional)** | Prefer subscription’s preferred cleaner when generating job if available. | Same cleaner improves quality. |
| **3.5 Subscription billing (optional)** | Charge per cycle; retry and notify on failure. | Reliable billing and communication. |
| **4.1 Earnings dashboard** | GET `/cleaner/earnings`: pending, paid, next payout date in simple language. | Clear visibility reduces support and builds trust. |

---

## V4: Optimization & Monetization Layer

**Goal:** Increase LTV and engagement safely. **Prerequisite:** V3 stable 4–6 weeks.

| Task | What it does | Why it matters |
|------|----------------|----------------|
| **1.1 Boost purchase** | POST `/cleaner/boosts/purchase` (type, duration); deduct credits; store in boosts; cap (e.g. 1/day). | Monetization with guardrails. |
| **1.2 Boost in matching** | Add rank bonus for active boost (capped); don’t override eligibility. | Boosts increase visibility fairly. |
| **1.3 Boost expiration** | Worker marks boosts past expires_at as EXPIRED. | Expired boosts must not affect rank. |
| **1.4 Boost analytics** | Admin sees purchases, effectiveness, revenue from boosts. | Product and ops need to measure. |
| **2.1 Daily KPI snapshot** | Worker writes jobs created/completed/cancelled, completion rate, no-show, fill rate, revenue, active users to kpi_daily_snapshots. | Historical KPIs for dashboards. |
| **2.2 Analytics endpoints** | GET `/admin/analytics/dashboard`, cleaners, financial, trends (read-only). | Single place for health and trends. |
| **2.3 Weekly summary** | Worker aggregates daily into weekly rollup; optional email. | Weekly view for reporting. |
| **3.1 Risk score** | Compute risk score from cancellation rate, payment failures, disputes; store in risk_scores. | Single signal for ops to prioritize review. |
| **3.2 Risk flags** | Create discrete flags (HIGH_CANCELLATION_RATE, etc.) when thresholds exceeded; store in risk_flags. | Easier for ops to act on than raw score. |
| **3.3 Admin risk queue** | GET `/admin/risk/review`; admin can clear flag or apply restriction; all logged. | Central place for risk without auto-ban. |
| **3.4 Risk visibility (optional)** | Show risk flags/history in admin user profile. | Context for support and disputes. |

---

## V5: Platform Maturity (Optional)

**Goal:** High automation, governance, expansion. **Prerequisite:** V4 stable 6–8 weeks.

| Task | What it does | Why it matters |
|------|----------------|----------------|
| **1.1 Confidence-based assignment** | Compute confidence for top suggestion; auto-assign if above threshold, else require admin; log; cleaner can decline (with penalty). | Reduces ops for “obvious” matches. |
| **1.2 SLA enforcement** | Enforce assignment/confirmation/check-in SLAs; auto-escalate if violated. | Keeps quality and predictability. |
| **1.3 Auto-reassignment** | On last-minute cancel or no-show, auto-find replacement, assign, notify; apply penalties to original. | Reduces client impact and ops load. |
| **2.1 Auto-refunds** | In clear cases (no-show, late cancel, not started 30 min), auto-refund and log; admin can override. | Fast resolution and trust. |
| **2.2 Auto-penalties** | Apply reliability/visibility penalties for no-show, late cancel, repeats; reversible by admin. | Consistent consequences. |
| **2.3 Auto-credits** | No-show or quality issue → auto-credit client and log. | Fast remediation. |
| **3.1 Strikes system** | Track strikes; 3 → suspension, 5 → ban (reversible); strikes decay over time. | Progressive discipline. |
| **3.2 Appeals** | User can appeal strike/ban/penalty; admin reviews and decides; logged. | Fairness and compliance. |
| **3.3 Reinstatement** | Admin can reinstate and remove strikes (with reason); logged. | Correct mistakes. |
| **4.1 Market configuration** | Store market configs (pricing, areas, policies, tax); link jobs to market. | Required for multi-city/country. |
| **4.2 Localized pricing** | Pricing considers market (base, tier, add-ons per market). | Pricing scales to markets. |
| **4.3 Expansion checklist** | Document process to add a new market (configure, onboard, pricing, launch). | Repeatable expansion. |

---

# End of guide

Use this document with [MASTER_CHECKLIST.md](../versions/MASTER_CHECKLIST.md): for each task, read **What it does** and **Why it matters** here, then follow **How to complete** (for V1) or the same pattern for V2–V5 using ARCHITECTURE.md and RUNBOOK.md. Check off the checklist as you go.

**Last updated:** 2026-02 (aligned with MASTER_CHECKLIST.md V1–V5).
