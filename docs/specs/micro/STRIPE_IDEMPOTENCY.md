# Stripe Idempotency Spec
(Micro/Unit Spec #2)

## Scope
Ensures re-delivered Stripe events do not cause duplicate side-effects.

## Keys & Checks
- Primary: Stripe event_id (unique per webhook).
- Secondary: object IDs (payment_intent.id, invoice.id, charge.id, payout.id).
- Store processed event_ids; on repeat, no-op.
- For business actions, check by object ID to avoid double ledger/wallet updates.

## Persistence
- stripe_events: event_id, object_id, type, processed_at, status.
- Handlers must transactionally:
  - Assert not processed (event_id/object_id)
  - Perform domain updates
  - Mark processed

## Scenarios
- payment_intent.succeeded delivered twice → one wallet_purchase only.
- charge.refunded delivered twice → one refund only.
- payout.paid delivered twice → payout/earnings marked paid once.

## Failure Handling
- If processing fails mid-way, leave processed flag unset so retry can re-run safely (handlers must be idempotent themselves).

