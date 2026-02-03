# Phase 4 — Stripe, Webhooks & Integrations — Status

**Purpose:** Track Phase 4 (Section 4) progress.  
**Runbook:** [SECTION_04_STRIPE_WEBHOOKS.md](../sections/SECTION_04_STRIPE_WEBHOOKS.md).

---

## Current state

| Item | Status | Notes |
|------|--------|-------|
| **Raw body for Stripe** | ✅ | index.ts mounts express.raw() for `/stripe/webhook`; handler uses Buffer only (no JSON.stringify). |
| **Signature verification** | ✅ | First line of handler; 400 if missing or invalid. |
| **webhook_events (canonical)** | ✅ | Migration 042; insert before process; ON CONFLICT DO NOTHING → idempotent. |
| **Stripe handler idempotency** | ✅ | Intake via webhook_events; handleStripeEvent uses stripe_events_processed. |
| **Return 200 quickly** | ✅ | Handler: verify → store → process; 200 on duplicate or after process. |
| **Payment state machine** | ✅ | [PAYMENT_STATE_MACHINE.md](../sections/PAYMENT_STATE_MACHINE.md); enforced via paymentService/payoutsService. |
| **Ledger tables** | ✅ | credit_ledger append-only; 902 constraints; payout_items 903. |
| **Payout idempotency** | ✅ | idempotencyKey to Stripe; uniq_payout_items_ledger_entry. |
| **delivery_log** | ✅ | message_delivery_log (026). |
| **Async worker** | — | Optional; handler processes inline. |

---

## Section 4 checklist

All MASTER_CHECKLIST Section 4 items are done. Optional: async worker for webhook_events (current handler processes inline); n8n replay protection (4.11); observability alerts (4.12); replay/failure-injection tests (4.13).

## Links

- [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 4 checklist
- [SECTION_04_STRIPE_WEBHOOKS.md](../sections/SECTION_04_STRIPE_WEBHOOKS.md) — Runbook
- [PAYMENT_STATE_MACHINE.md](../sections/PAYMENT_STATE_MACHINE.md) — State machine

**Status:** Section 4 complete. Proceeding to Phase 5 (Database & Migration Hygiene).

**Last updated:** 2026-01-31
