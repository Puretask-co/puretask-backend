# Backend Alignment Checklist - PureTask

**Purpose:** Single reference answering the full Backend Alignment Checklist using **actual PureTask code, schema, and routes**. Every answer cites source files, DB schema, or route paths. Use for doc/backend alignment and frontend contract.

**Source of truth:** `src/` (TypeScript), `DB/migrations/` (SQL), `src/index.ts` (route mounting).

---

## 0) Quick context questions

### Canonical entity ID
- **job_id (UUID).** One job = one booking. No `booking_id` in schema.
- **Evidence:** `jobs` table has `id UUID`; no `booking_id` column. `credit_ledger.job_id` references `jobs(id)`. `src/types/db.ts` — Job interface uses `id`; no booking entity.

### Credits and payouts - same unit?
- **Hybrid.** Ledger: integer **credits** only (`credit_ledger.delta_credits` INTEGER). Payouts: `payouts` table has `amount_credits` and `amount_cents`; Stripe transfers in USD. Client/job flow in credits; payout to cleaner in USD.
- **Evidence:** `DB/migrations/000_MASTER_MIGRATION.sql` — `credit_ledger.delta_credits INTEGER NOT NULL`. `src/services/creditsService.ts` — balance = `SUM(delta_credits)`. Payouts table (migration): amount_credits, amount_cents; Stripe Connect for transfers.

### Status transitions in one place?
- **Partly.** State machine defined in one place; two code paths update status.
- **Evidence:** State machine: `src/state/jobStateMachine.ts` (allowedTransitions, getNextStatus, validateTransition) and `src/constants/jobStatus.ts` (JOB_STATUSES, JOB_EVENT_TYPES). Single transition that uses it: `src/services/jobsService.ts` — `applyStatusTransition()` (calls validateTransition, getNextStatus, updates job, writes job_events). Alternative path: `src/services/jobTrackingService.ts` — `approveJob`, `disputeJob`, `checkIn`, `checkOut`, `startEnRoute` do direct `UPDATE jobs SET status = ...` and `publishEvent()` with **dot-notation** event names (e.g. `job.approved`, `job.disputed`, `job.checked_in`), not the canonical event types (`client_approved`, `client_disputed`, `job_completed`).

---

## A) Job status enum and transitions

### A1) Enum alignment
**Exact backend status strings:** `requested` | `accepted` | `on_my_way` | `in_progress` | `awaiting_approval` | `completed` | `disputed` | `cancelled` (8 values).

**Evidence:** `src/types/db.ts` lines 17–25 — `JobStatus` type. `DB/migrations/000_MASTER_MIGRATION.sql` — `CREATE TYPE job_status AS ENUM ('requested', 'accepted', 'on_my_way', 'in_progress', 'awaiting_approval', 'completed', 'disputed', 'cancelled')`. `src/constants/jobStatus.ts` — `JOB_STATUSES` array (same 8). `jobs.status` column type: `job_status NOT NULL DEFAULT 'requested'`.

**Events (canonical):** job_created, job_accepted, cleaner_on_my_way, job_started, job_completed, client_approved, client_disputed, dispute_resolved_refund, dispute_resolved_no_refund, job_cancelled (10). **Evidence:** `src/state/jobStateMachine.ts` — `JobEventType` and `allowedTransitions` keys; `eventPermissions` defines who can trigger each.

**Pass:** Backend returns only these statuses. No aliases. **Red flag:** If doc has scheduled/approved/completed_pending_payout - backend does not; align doc to above. disputed is not terminal (allowedTransitions: disputed -> dispute_resolved_refund -> cancelled, or dispute_resolved_no_refund -> completed).

### A2) Transition enforcement
**Where:** Authoritative: `src/services/jobsService.ts` — `applyStatusTransition()` (imports getNextStatus, validateTransition from jobStateMachine; updates job; calls logJobEvent with eventType). Route: `src/routes/jobs.ts` — `POST /:jobId/transition` (body: eventType), line ~863. Alternative: `src/services/jobTrackingService.ts` — approveJob (publishEvent eventName: "job.approved"), disputeJob ("job.disputed"), checkIn ("job.checked_in"), checkOut ("job.checked_out"), startEnRoute ("job.cleaner_en_route"), recordLocation ("cleaner.location_updated"); these do direct `UPDATE jobs SET status` and do not call getNextStatus.

**Validation:** applyStatusTransition: validateTransition (role + state); job_completed requires job_checkins existence and MIN_BEFORE/MIN_AFTER photos (env). Tracking: status checks (e.g. awaiting_approval for approve) and 409 on duplicate.

**Idempotent:** approveJob: UPDATE ... WHERE status = 'awaiting_approval' then 409 if no row updated. applyStatusTransition: no idempotency; same event sent twice can throw or double-write event.

**Pass:** One authoritative function; illegal transitions 400 (BAD_TRANSITION). **Red flag:** Two code paths; tracking writes dot-notation event_type to job_events.

### A3) Timeline
**job_events table:** Yes. **Evidence:** `DB/migrations/000_MASTER_MIGRATION.sql` — `CREATE TABLE job_events (id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id), actor_type TEXT NOT NULL, actor_id UUID, event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ)`. Indexes: idx_job_events_job_id, idx_job_events_event_type. **Who writes:** applyStatusTransition calls logJobEvent (src/services/jobEvents.ts) with canonical eventType. publishEvent (src/lib/events.ts) writes to job_events with eventName (tracking uses: job.approved, job.disputed, job.checked_in, job.checked_out, job.cleaner_en_route, job.cleaner_arrived, cleaner.location_updated). **Pass:** Lifecycle reconstructable; event_type values are mixed (canonical vs dot-notation).

---

## B) Ledger schema and invariants

### B1) Ledger schema
**Tables:** credit_ledger only. No balances table; balance = SUM(delta_credits).

**Row fields:** id (UUID), user_id (TEXT), job_id (UUID nullable), delta_credits (INTEGER), reason (credit_reason), created_at.

**Evidence:** `000_MASTER_MIGRATION.sql` — `CREATE TABLE credit_ledger (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES users(id), job_id UUID REFERENCES jobs(id), delta_credits INTEGER NOT NULL, reason credit_reason NOT NULL, created_at TIMESTAMPTZ)`. DB enum `credit_reason`: `purchase`, `wallet_topup`, `job_escrow`, `job_release`, `refund`, `adjustment` (migration line ~83). TypeScript `CreditReason` in src/types/db.ts also has subscription_credit, invoice_payment. **Uniqueness:** 902: uniq_ledger_credit_purchase (user_id, reason, job_id::TEXT) WHERE reason IN ('purchase','wallet_topup'); uniq_ledger_escrow_reserved_job, uniq_ledger_escrow_released_job, uniq_ledger_refund_job for job_escrow, job_release, refund. **Application:** src/services/creditsService.ts — addLedgerEntry checks existing row for job_escrow, job_release, refund, purchase when jobId present; returns existing to avoid duplicate. **Stripe:** payment_intents table (stripe_payment_intent_id, purpose, credits_amount) links to flows; ledger has no stripe column.

### B2) Balance
Computed on the fly: SUM(delta_credits). No stored balance. **Evidence:** src/services/creditsService.ts — getUserBalance() runs `SELECT COALESCE(SUM(delta_credits), 0) AS balance FROM credit_ledger WHERE user_id = $1`. credit_accounts table exists in migration but balance is derived from ledger in app. **Evidence:** creditsService.getUserBalance = SUM(delta_credits) FROM credit_ledger. **Pass:** Pure ledger sum.

### B3) Escrow
**Book:** escrowJobCredits -> one row negative delta_credits, reason job_escrow, job_id set. **Approve:** releaseJobCreditsToCleaner -> one row positive, reason job_release. **Refund:** refundJobCreditsToClient -> addLedgerEntry positive, reason refund. **Evidence:** src/services/creditsService.ts — escrowJobCredits(clientId, jobId, creditAmount) calls addLedgerEntry({ userId: clientId, jobId, deltaCredits: -creditAmount, reason: "job_escrow" }). releaseJobCreditsToCleaner(cleanerId, jobId, creditAmount) calls addLedgerEntry(..., deltaCredits: creditAmount, reason: "job_release"). refundJobCreditsToClient(...) reason "refund". All rows have job_id. No separate escrow bucket table. **Pass:** book->hold, approve->release, refund->refund; all have job_id.

### B4) Invariants
1. Completed only with escrow resolved: Yes - approveJob/release in same transaction. 2. Net correct per job: One escrow, one release or refund(s); 902 prevents double. 3. No edit; compensating entries: No UPDATE on ledger. 4. Stripe event -> ledger: Idempotent handling and addLedgerEntry. **Pass.**

---

## C) Payments routes and Stripe

### C1) Endpoints
POST /payments/credits (PaymentIntent buy credits), POST /payments/checkout (Checkout Session), POST /payments/job/:jobId (PaymentIntent job charge), GET payment intents for client. POST /stripe/webhook (handleStripeEvent). GET /credits/balance, GET /credits/ledger, POST /credits/checkout. Refunds via refund processor and ledger. **Pass:** Each frontend flow has a backend route.

### C2) Idempotency
Idempotency-Key header read; stored in idempotency_keys table. On retry returns stored response. Applied on POST /payments/credits and create job / tracking where mounted. Stripe: stripe_events_processed / event id; ledger: addLedgerEntry idempotent. **Pass.**

### C3) Capture
Card-paid jobs: PaymentIntent capture on success; on payment_intent.succeeded backend adds credits and escrows for job_charge. No separate auth-hold then capture. **Pass.**

### C4) Webhooks
Stripe webhook verified; handleStripeEvent processes payment_intent.succeeded (ledger update); idempotent. **Pass.**

---

## D) Snippets for alignment

**Job status enum:** See src/types/db.ts JobStatus type (8 values above).

**Transition function:** src/services/jobsService.ts applyStatusTransition. Route: see jobs router for POST transition. Tracking: POST /tracking/:jobId/approve, POST /tracking/:jobId/dispute.

**Ledger CREATE TABLE:** credit_ledger (id UUID, user_id TEXT NOT NULL, job_id UUID, delta_credits INTEGER NOT NULL, reason credit_reason NOT NULL, created_at TIMESTAMPTZ). Indexes and 902 unique constraints as in migrations.

**Payments routes:** payments.ts (credits, checkout, job/:jobId), credits.ts (balance, ledger, checkout), stripe.ts (webhook, create-payment-intent). idempotency.ts + idempotency_keys table.

---

## E) Verdict

| Section | Result | Notes |
|--------|--------|--------|
| 0 Context | OK | job_id only; credits integer; state machine exists but tracking bypasses it |
| A1 Enum | OK | Doc must match 8 statuses exactly |
| A2 Transitions | Warning | One authoritative path; tracking does direct updates; recommend single path + canonical event_type |
| A3 Timeline | OK | job_events present; event_type naming mixed (job.approved vs client_approved) |
| B Ledger | OK | Integer, job_id, idempotency, invariants met |
| C Payments | OK | Endpoints, idempotency, capture, webhooks |

**Doc changes:** List exact 8 statuses and 10 events; booking = job; escrow = job_escrow -> job_release or refund.

**Backend fixes:** Route all status changes through one path using getNextStatus/validateTransition; write canonical event_type to job_events; optional idempotent transition (same event+status return current).

**Minimum safe escrow spec:** Met; integer ledger, one escrow/release/refund per job, idempotent, Stripe webhook.
