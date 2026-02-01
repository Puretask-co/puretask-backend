# State Sync & Idempotency Spec
(Infra/Micro bridge)

## Scope
Defines object-level idempotency and state-sync rules for Stripe-driven flows (PI, invoice, charge, payout, dispute) and internal state (wallet/escrow/earnings/payouts).

## Object-Level Idempotency
- payment_intent: track processed_success/failed in payment_intents table; skip if already processed.
- invoice: track processed flag by invoice.id; skip duplicate grants/dunning.
- charge/refund: track by charge.id/payment_intent_id in a refund table or marker; prevent double refunds.
- dispute: track by dispute.id; prevent repeat freeze/clawback handling.
- payout: track by stripe_payout_id; prevent double paid/failed transitions.

## State Transitions
- Wallet/ledger: only mutate once per event; use transactions + processed markers.
- Escrow/earnings: approval → escrow_release → earnings once; refunds/chargebacks should not re-run if already reversed.
- Payout: earnings included in payout once; payout status changes are idempotent.

## Persistence
- Tables should store processed flags per object:
  - payment_intents.processed_success
  - invoice_events processed table (or extend stripe_events with object_id checks)
  - refund_events processed table keyed by charge.id/payment_intent_id
  - dispute_events processed table keyed by dispute.id
  - payouts keyed by stripe_payout_id

## Error/Retry Handling
- On failure mid-handler, leave processed=false so retry can re-run safely.
- Handlers should be idempotent and check object-level markers before side effects.

## Integrity Checks
- No duplicate ledger entries for the same source object.
- payout.total == sum(earnings) and paid payouts == paid earnings.
- wallet matches ledger-derived balance.

