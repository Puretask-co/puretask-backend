# Stripe Event Handling Spec
(Micro/Unit Spec #1)

## Scope
Defines ingest and routing behavior for Stripe webhooks (payment_intent.*, invoice.*, charge.refunded, charge.dispute.*, payout.*), ensuring correct validation, logging, and dispatch to domain handlers.

## Core Requirements
- Verify Stripe signature; reject on failure.
- Supported events only; unknown events logged safely.
- Idempotent by Stripe event ID and object ID (handled further in Idempotency spec).
- Persist raw event (stripe_events) before processing.
- Route by event type to correct handler.

## Event Coverage
- Payments: payment_intent.succeeded, payment_intent.payment_failed
- Subscriptions: invoice.paid, invoice.payment_failed
- Refunds: charge.refunded (and invoice.refunded if used)
- Disputes: charge.dispute.created, charge.dispute.closed
- Payouts: payout.paid, payout.failed

## Processing Flow
1) Ingest: signature check; store raw event with event_id; skip if duplicate.
2) Router: match event.type to handler.
3) Handler: perform business logic (wallet/credits, refunds, payouts, etc.) with idempotency.
4) Respond 2xx quickly after queuing/processing.

## Failure Handling
- Invalid signature → 400.
- Unsupported event → 200 with log (no-op).
- Handler failure → log + retry strategy (n8n/backoff).

## Integrity
- No state changes without stored raw event.
- No double-processing of the same event.

