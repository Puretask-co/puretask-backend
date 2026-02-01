# Stripe Testing Cheat Sheet (PureTask)

Practical, repeatable steps to test payments, refunds, disputes, and payouts with Stripe + n8n.

---

## 0) Glossary (PureTask-specific)
- **n8n Ingest Workflow:** `01 – Stripe Webhook Ingest` (receives all Stripe webhooks, verifies signature, logs to DB, then calls the router).
- **n8n Router Workflow:** `02 – Stripe Event Router` (routes events by type to the correct handler workflows: payments, refunds, disputes, payouts, etc.).
- **Webhook URL (test+prod):** `https://puretask.app.n8n.cloud/webhook/stripe/webhook`

---

## 1) Prerequisites
- Stripe CLI installed and logged in: `stripe --version`, `stripe login`
- Stripe account in TEST mode (CLI defaults to test)
- n8n cloud workspace: https://puretask.app.n8n.cloud
  - Workflow `01 – Stripe Webhook Ingest` is active
- Backend running (recommended): `npm run dev`
- Webhook signing secret from `stripe listen` (example): `whsec_xxx...`
  - This is already configured in the Verify Stripe Signature node in n8n

---

## 2) Start the Stripe Listener (always first)
In a dedicated terminal:
```bash
stripe listen --forward-to https://puretask.app.n8n.cloud/webhook/stripe/webhook
```
Expected:
- “Ready! Your webhook signing secret is whsec_...”
- Lines like `payment_intent.succeeded` followed by `[200] POST .../stripe/webhook`

Leave this window open; do not type other commands here.

---

## 3) Quick Smoke Test
Use a separate terminal for triggers.

### Successful payment
```bash
stripe trigger payment_intent.succeeded
```
Expected:
- Listener shows `[200] POST .../stripe/webhook`
- n8n: `01 – Stripe Webhook Ingest` execution succeeds
  - Webhook node shows payload
  - Verify Stripe Signature: `verified: true`
  - Insert `stripe_events`: event logged to DB
  - Calls `02 – Stripe Event Router`

---

## 4) Common Stripe CLI Test Commands

### 4.1 Payment succeeded
```bash
stripe trigger payment_intent.succeeded
```
Use cases: first-time credit purchase, top-up, auto-refill. Expect wallet credit + ledger entry + webhook log.

### 4.2 Payment failed
```bash
stripe trigger payment_intent.payment_failed
```
Expect ingest + router → payment failure handling; job/payment status updated, event logged.

### 4.3 Refund
```bash
stripe trigger charge.refunded
```
Expect refund events logged; ledger refund; wallet reconciled; notifications as implemented.

### 4.4 Dispute
```bash
stripe trigger charge.dispute.created
```
Expect dispute handler: flag job/cleaner, freeze related credits/earnings if applicable, notify support.

### 4.5 Payout events (transfer.* not supported by CLI)
`stripe trigger transfer.paid` / `transfer.failed` are not supported by CLI. Use Stripe Dashboard to simulate payouts, or rely on live payout flows. For payouts, prefer dashboard/manual tests until fixtures are added.

---

## 5) Where to Look in n8n
- Open https://puretask.app.n8n.cloud → workflow `01 – Stripe Webhook Ingest` → Executions.
- For each execution:
  - **Webhook:** raw event.
  - **Verify Stripe Signature:** `verified: true` or failure if secret mismatch.
  - **Insert stripe_events:** immutable event log.
  - **Check Already Handled:** dedupe.
  - **Call “02 – Stripe Event Router”:** routes by event type.
  - **Mark Event Handled / Respond OK:** completes the flow (HTTP 200).

---

## 6) Typical Testing Sessions (Playbooks)

### 6.1 “Is everything alive?”
- Start backend: `npm run dev`
- Start listener
- Trigger: `stripe trigger payment_intent.succeeded`
- Expect: 200 in listener; new successful execution in n8n with `verified: true`

### 6.2 “Payment & Refund”
- `stripe trigger payment_intent.succeeded`
- `stripe trigger charge.refunded`
- Expect: both logged in n8n; refund handler runs; ledger/wallet adjust.

### 6.3 “Error path” (signature protection)
- Temporarily break secret in Verify node (add `-BROKEN`).
- Trigger `stripe trigger payment_intent.succeeded`
- Expect Verify to fail with “Invalid Stripe webhook signature.”
- Revert secret.

---

## 7) Notes & Gotchas
- Listener must be running for CLI triggers to hit n8n.
- One listener per machine/port.
- Test vs Live: CLI uses test; production uses a separate dashboard webhook + signing secret.
- Idempotency: ingest logs events and dedupes before routing; safe against retries.

---

## 8) Canonical Stripe Events Used by PureTask

| Event | Purpose | Internal effect |
|-------|---------|-----------------|
| `payment_intent.succeeded` | One-off credit purchase | Wallet credits added, ledger `wallet_purchase`, webhook log |
| `invoice.paid` | Subscription renewal | Add recurring credits (+bonus), ledger, notify |
| `invoice.payment_failed` | Subscription dunning | Flag/retry, banner/email, no credits added |
| `charge.refunded` | Refund prior purchase | Ledger refund, reduce wallet if available, log |
| `payout.paid` | Cleaner payout success | `payouts.status=paid`, set `stripe_payout_id`, mark earnings paid, notify |
| `payout.failed` | Cleaner payout failed | `payouts.status=failed`, store reason, alert/retry |
| `account.updated` | Connect onboarding state | Update cleaner connect status/requirements, drive onboarding reminders |

---

## 9) Validation Checklist (per run)
- Listener running and receiving events (HTTP 200).
- Signature verified in n8n.
- Correct router branch executed.
- Event logged in `stripe_events` (or webhook log table).
- Ledger/wallet/payout rows updated as expected.
- No duplicate processing (dedupe node passes).
- Notifications (if applicable) fired.


