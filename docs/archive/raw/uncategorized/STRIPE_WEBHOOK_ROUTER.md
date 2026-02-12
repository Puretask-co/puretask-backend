# Stripe Webhook Router Spec
(Infrastructure Spec)

## Scope
Defines routing of Stripe events to domain handlers after ingest/signature verification, leveraging idempotency rules.

## Flow
1) Ingest: signature verify, store raw event (stripe_events), idempotency check on event_id.
2) Router: dispatch by event.type to handler.
3) Handler: perform domain logic with object-level idempotency.

## Event Map (core)
- payment_intent.succeeded → Credit Purchase (wallet_purchase)
- payment_intent.payment_failed → Payment failure handling
- invoice.paid → Subscription credit grant
- invoice.payment_failed → Subscription dunning
- charge.refunded → Refund handler (purchase/subscription/job-refund path)
- charge.dispute.created → Chargeback handler (freeze/flag)
- charge.dispute.closed → Resolve chargeback outcome
- payout.paid → Payout confirmation (mark payouts/earnings paid)
- payout.failed → Payout failure handler (reset earnings/payout status)

## Idempotency
- Primary: event_id; Secondary: object id (PI, invoice, charge, payout).
- Store processed flags; handlers transactionally guard against replays.

## Error Handling
- Unknown events: log, 200 OK (no-op).
- Handler failure: log + retry (n8n/backoff).

## Security
- Signature verification required; reject on failure.
- Minimal payload exposure; only necessary fields forwarded to handlers.

