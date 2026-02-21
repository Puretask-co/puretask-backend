# Section 4 — Stripe, Webhooks & Integrations (Full Runbook)

**Objective:** Payments and external events (Stripe, n8n, SendGrid, Twilio, OneSignal) are authentic, idempotent, recoverable, auditable, observable.

**Exit condition:** A duplicate webhook, out-of-order event, or provider outage cannot create incorrect balances, payouts, bookings, or state transitions.

---

## 4.1 Threat Model

- Forged events (fake “payment succeeded”)  
- Replay attacks (same event sent multiple times)  
- Out-of-order delivery (refund before success)  
- Partial processing (DB updated, downstream not notified)  
- Double-processing (two workers process same event)  
- Provider outages, network timeouts  

---

## 4.2 Stripe Architecture Standard

- **Source of truth:** Stripe **webhooks** are the source of truth for final payment status; API responses are not final.  
- **Every transaction must persist:** stripe_payment_intent_id, stripe_customer_id (if applicable), amount, currency, status, stripe_status, idempotency_key, metadata (jobId, bookingId, userId).

**Rule:** If a transaction lacks a Stripe ID and metadata linkage, it is not production-safe.

---

## 4.3 Raw Body Handling (Stripe Webhook)

- `/stripe/webhook` must receive **raw bytes** exactly as Stripe sent them.  
- Webhook route mounted **before** JSON body parsing.  
- Use `express.raw({ type: 'application/json' })`.  
- Signature check is **first** line of logic; if signature fails → 400 immediately.  
- **Fix:** If `Buffer.isBuffer(req.body)`, pass `req.body` directly to `constructEvent`; do not `JSON.stringify(req.body)`.

---

## 4.4 Response Time & Retry Behavior

- Webhook handler does **minimal** work: verify signature, persist event, enqueue processing, respond 200.  
- Heavy work happens **asynchronously** (worker).  
- If handler is slow, Stripe retries and you get duplicates.

---

## 4.5 webhook_events Table (Canonical)

| Column | Purpose |
|--------|---------|
| id | uuid |
| provider | stripe, twilio, etc. |
| event_id | Stripe event.id (unique) |
| event_type | string |
| received_at | timestamp |
| signature_verified | boolean |
| payload_json | jsonb |
| processing_status | pending \| processing \| done \| failed |
| attempt_count | int |
| last_error | text |
| processed_at | timestamp |

**Rule:** No webhook is processed directly without being stored first.

---

## 4.6 Idempotency

- **Provider event:** Insert event_id with unique constraint; if already exists → return 200 without reprocessing.  
- **Business:** “Complete job,” “Release escrow,” “Issue payout” must be idempotent (unique operation key, transaction, safe no-op on duplicates).

---

## 4.7 Processing Pipeline

- **Phase 1 (intake):** Verify signature → store event → enqueue job → respond 200.  
- **Phase 2 (worker):** Lock event row → apply state changes in DB transaction → write ledger entries → mark event processed → emit internal events.  
- **Concurrency:** event transitions pending → processing → done/failed must be atomic (e.g. FOR UPDATE SKIP LOCKED).

---

## 4.8 Payment State Machine

Define and document internal states: initiated, requires_payment_method, processing, succeeded, failed, refunded, disputed, chargeback. Each state has allowed transitions and downstream actions. No service sets random statuses — only state machine transitions.

**Implemented:** [PAYMENT_STATE_MACHINE.md](./PAYMENT_STATE_MACHINE.md) — PaymentIntent, internal payment_intents, payouts, credit_ledger; updates only in paymentService and payoutsService.

---

## 4.9 Ledger / Escrow Integrity

- Append-only ledger (or equivalent): ledger_entries with user_id, job_id, type (charge, escrow_hold, escrow_release, payout, refund, adjustment), amount, currency, source (stripe_event_id / admin_action_id), created_at.  
- Balances derived from or auditable through ledger.  
- Optional: reconciliation job comparing internal totals vs Stripe balance transactions.

---

## 4.10 delivery_log (Outbound Messaging)

Store each outbound attempt: channel (email/sms/push), template_key, provider_message_id, to, status (queued/sent/failed), error_code, error_message, attempt, metadata (jobId, userId), timestamps. Enables retries and support (“did we notify them?”).

---

## 4.11 n8n / Internal Events

- All internal events to n8n: HMAC signed, timestamped, replay-protected (nonce or event id).  
- Reject stale timestamps (e.g. older than 5 minutes); short-term nonce cache (Redis or DB unique key).

---

## 4.12 Observability

- Correlation IDs on every external event; logged consistently; passed into downstream internal events.  
- Alerts: webhook failures > N in 10 min; payout failures; duplicate event spikes; provider outage patterns.

---

## 4.13 Test Plan

- Webhook replay: send same Stripe event twice → process once.  
- Out-of-order events → state not corrupted.  
- Failure injection: DB failure mid-process → retry safe, no duplication.  
- Provider outage simulation: SendGrid down → logs show failed; retry policy kicks in; no infinite loops.

---

## 4.14 Done Checklist

- [x] Stripe webhook signature uses raw body correctly (Buffer only; 400 if not)
- [x] Webhook intake persists events before processing (webhook_events table; 042)
- [x] Unique constraints prevent duplicate event processing (provider, event_id; stripe_events_processed)
- [ ] Async worker processes events with concurrency locks (optional; current handler inline)
- [x] Payment state machine documented and enforced ([PAYMENT_STATE_MACHINE.md](./PAYMENT_STATE_MACHINE.md))
- [x] Ledger or equivalent audit trail exists (credit_ledger + 902; payout_items 903)
- [x] delivery_log exists for outbound messaging (message_delivery_log)
- [ ] n8n/internal events signed and replay-protected (per 4.11)
- [ ] Observability metrics and basic alerts defined
- [ ] Replay and failure injection tests pass  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 4 checklist.
