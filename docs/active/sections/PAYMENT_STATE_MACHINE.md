# Payment State Machine (Section 4)

**Purpose:** Document internal payment/PaymentIntent states and allowed transitions. No service should set status arbitrarily — only defined transitions.

**Reference:** [SECTION_04_STRIPE_WEBHOOKS.md](./SECTION_04_STRIPE_WEBHOOKS.md) § 4.8.

---

## Stripe PaymentIntent (source: Stripe)

| State | Description | Set by |
|-------|-------------|--------|
| `requires_payment_method` | Awaiting payment method | Stripe |
| `requires_confirmation` | Ready to confirm | Stripe |
| `requires_action` | 3DS or other action | Stripe |
| `processing` | Payment processing | Stripe |
| `succeeded` | Payment completed | Stripe webhook |
| `requires_capture` | Auth-only, capture later | Stripe |
| `canceled` | Canceled | Stripe / API |

**Our handling:** We react to `payment_intent.succeeded` and `payment_intent.payment_failed` webhooks. We do not set Stripe status; we update internal `payment_intents` and `credit_ledger` based on these events.

---

## Internal payment_intents table status

| Status | Meaning |
|--------|--------|
| `created` | Record created; Stripe PI not yet finalized |
| `succeeded` | Webhook received; credits applied |
| `failed` | Webhook received; payment failed |
| `canceled` | Intent canceled |

**Transitions:** `created` → `succeeded` | `failed` | `canceled` (driven by Stripe webhooks only).

---

## Payout status (payouts table)

| Status | Meaning |
|--------|--------|
| `pending` | Payout record created; not yet sent to Stripe |
| `paid` | Stripe transfer created; payout completed |
| `failed` | Transfer failed (retry queue or manual) |

**Transitions:** `pending` → `paid` | `failed`. No direct writes; use payoutsService / Stripe transfer result.

---

## Ledger (credit_ledger)

Append-only. **Reasons:** `purchase`, `job_escrow`, `job_release`, `refund`, `adjustment`, `payout`, `bonus`, `expiry`.  
Unique constraints (see `DB/migrations/hardening/902_ledger_idempotency_constraints.sql`) prevent duplicate escrow, release, refund per job.

---

## Enforcement

- **Stripe:** Status comes from Stripe only; we only read and react.
- **payment_intents:** Updated only in `handlePaymentIntentSucceeded` / `handlePaymentIntentFailed` (paymentService).
- **payouts:** Updated only in payoutsService after Stripe transfer create/result.
- **credit_ledger:** Inserts only via creditsService / paymentService / cancellation flows; unique indexes prevent duplicates.

**See also:** [SECTION_04_STRIPE_WEBHOOKS.md](./SECTION_04_STRIPE_WEBHOOKS.md), [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) Section 4.
