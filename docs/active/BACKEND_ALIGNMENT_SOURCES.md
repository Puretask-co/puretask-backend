# Backend Alignment Checklist — PureTask source citations

This doc supplies **actual PureTask code, schema, and route references** for every checklist question. Use with [BACKEND_ALIGNMENT_CHECKLIST.md](./BACKEND_ALIGNMENT_CHECKLIST.md).

---

## 0) Context — sources

- **job_id:** `jobs.id` UUID; `credit_ledger.job_id` REFERENCES jobs(id). No booking_id in DB or `src/types/db.ts`.
- **Credits/payouts:** `credit_ledger.delta_credits` INTEGER; `getUserBalance()` = SUM(delta_credits). `payouts` has amount_credits, amount_cents (migration).
- **State machine:** `src/state/jobStateMachine.ts`, `src/constants/jobStatus.ts`; transition path: `src/services/jobsService.ts` `applyStatusTransition`; alternate: `src/services/jobTrackingService.ts` (direct UPDATE + publishEvent).

---

## A) Job status — exact values and locations

**Status enum (8):** `requested` | `accepted` | `on_my_way` | `in_progress` | `awaiting_approval` | `completed` | `disputed` | `cancelled`  
- `src/types/db.ts` JobStatus type  
- `DB/migrations/000_MASTER_MIGRATION.sql` CREATE TYPE job_status AS ENUM (...); jobs.status column

**Event types (10):** job_created, job_accepted, cleaner_on_my_way, job_started, job_completed, client_approved, client_disputed, dispute_resolved_refund, dispute_resolved_no_refund, job_cancelled  
- `src/state/jobStateMachine.ts` JobEventType, allowedTransitions, eventPermissions

**Tracking event_type (written to job_events):** job.approved, job.disputed, job.checked_in, job.checked_out, job.cleaner_en_route, job.cleaner_arrived, cleaner.location_updated  
- `src/services/jobTrackingService.ts` publishEvent({ eventName: "..." })

**Transition route:** POST /jobs/:jobId/transition (body: eventType) — `src/routes/jobs.ts` ~line 863, calls applyStatusTransition.  
**Tracking routes:** POST /tracking/:jobId/approve, POST /tracking/:jobId/dispute, etc. — tracking router.

**job_events schema:** id UUID, job_id UUID NOT NULL, actor_type TEXT NOT NULL, actor_id UUID, event_type TEXT NOT NULL, payload JSONB DEFAULT '{}', created_at TIMESTAMPTZ.  
- `000_MASTER_MIGRATION.sql` CREATE TABLE job_events. Written by logJobEvent (jobEvents.ts) and publishEvent (events.ts).

---

## B) Ledger — schema and code

**credit_ledger CREATE TABLE (000_MASTER_MIGRATION.sql):**
```sql
CREATE TABLE IF NOT EXISTS credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  delta_credits   INTEGER NOT NULL,
  reason          credit_reason NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Indexes: idx_credit_ledger_user_id, idx_credit_ledger_job_id, idx_credit_ledger_user_balance.

**credit_reason (DB enum):** purchase, wallet_topup, job_escrow, job_release, refund, adjustment.  
(TS CreditReason in db.ts also has subscription_credit, invoice_payment.)

**902 idempotency indexes:**  
- uniq_ledger_credit_purchase ON credit_ledger (user_id, reason, (job_id::TEXT)) WHERE reason IN ('purchase','wallet_topup')  
- uniq_ledger_escrow_reserved_job WHERE reason = 'job_escrow' AND job_id IS NOT NULL  
- uniq_ledger_escrow_released_job WHERE reason = 'job_release' AND job_id IS NOT NULL  
- uniq_ledger_refund_job WHERE reason = 'refund' AND job_id IS NOT NULL  

**Balance:** `src/services/creditsService.ts` getUserBalance() — `SELECT COALESCE(SUM(delta_credits), 0) AS balance FROM credit_ledger WHERE user_id = $1`. No stored balance table used for derivation.

**Escrow/release/refund:** creditsService.escrowJobCredits (negative, job_escrow), releaseJobCreditsToCleaner (positive, job_release), refundJobCreditsToClient (positive, refund). addLedgerEntry checks existing for job_escrow, job_release, refund, purchase when jobId present.

---

## C) Payments — routes and Stripe

**Mount:** `src/index.ts` — apiRouter.use("/payments", paymentsRouter); use("/credits", creditsRouter); use("/stripe", stripeRouter). App mounted at "/" and "/api/v1". Webhook also at "/api/webhooks/stripe/webhook".

**Payments routes (src/routes/payments.ts):**  
- POST /payments/credits (requireIdempotency) — createWalletTopupIntent  
- POST /payments/checkout — createCheckoutSession  
- POST /payments/job/:jobId — createJobPaymentIntent  
- GET /payments/balance, GET /payments/history, GET /payments/pricing  

**Credits routes (src/routes/credits.ts):**  
- GET /credits/packages (public), GET /credits/balance, POST /credits/checkout, GET /credits/ledger (history), GET /credits/purchases  

**Stripe routes (src/routes/stripe.ts):**  
- POST /stripe/webhook — signature verification, then handleStripeEvent(event)  
- POST /stripe/create-payment-intent (legacy)  
- GET /stripe/payment-intent/:jobId  

**Idempotency:** Header Idempotency-Key; `src/lib/idempotency.ts` — store/get in table idempotency_keys (idempotency_key TEXT PRIMARY KEY, endpoint, method, status_code, response_body, created_at). Applied on POST /payments/credits. On replay returns stored response.

**Stripe webhooks:** handleStripeEvent (paymentService.ts) switch on event.type: payment_intent.succeeded, payment_intent.payment_failed, invoice.paid, invoice.payment_failed, charge.refunded, charge.dispute.created/closed, payout.paid/failed, transfer.created/updated/reversed. Idempotency: stripe_events_processed (event id), stripe_object_processed (object id) to avoid double ledger/payment_intents update.

---

## D) Paste-ready snippets

**Job status enum (copy from code):**
```ts
// src/types/db.ts
export type JobStatus =
  | "requested" | "accepted" | "on_my_way" | "in_progress"
  | "awaiting_approval" | "completed" | "disputed" | "cancelled";
```

**Transition function:** `src/services/jobsService.ts` — export async function applyStatusTransition(options: { jobId, eventType, payload?, requesterId, role }). Route: POST /jobs/:jobId/transition.

**Ledger CREATE TABLE:** See B) above (credit_ledger + 902 indexes).

**Payments/router summary:** payments.ts (POST /credits, /checkout, /job/:jobId; GET /balance, /history, /pricing). credits.ts (GET /balance, /ledger, POST /checkout). stripe.ts (POST /webhook, GET /payment-intent/:jobId). idempotency_keys table (migration 039 in 000_MASTER_MIGRATION.sql).

---

All of the above are taken from the PureTask backend codebase (src/, DB/migrations/) and reflect current schema and behavior.
