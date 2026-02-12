# n8n Orchestration Spec
(Infrastructure Spec)

## Scope
Defines how n8n workflows orchestrate Stripe events, payouts, refunds, and retries.

## Core Workflows (representative)
- 01 Stripe Webhook Ingest: verify signature, log event, route.
- 02 Stripe Event Router: dispatch to domain-specific flows.
- Credit Purchase Handler: PI succeeded → ledger/wallet update.
- Subscription Renewal Handler: invoice.paid → subscription_credit.
- Refund Handler: charge.refunded → apply refund logic.
- Dispute/Chargeback Handler: charge.dispute.* → freeze/resolve.
- Payout Processor: batch earnings, create payouts.
- Payout Webhook Handler: payout.paid/failed → update payouts/earnings.
- Auto-Refill (optional): create PI when booking shortfall detected (if done via n8n hook).

## Patterns
- Idempotency enforced in workflows (event_id/object_id checks).
- Use queues or wait nodes for retries; backoff on failure.
- Minimal logic in router; domain logic in handlers.

## Error/Retry
- Log failures with context.
- Retry transient errors; escalate/alert on repeated failures.

## Security
- Keep secrets in environment; do not log sensitive data.

## Monitoring
- Track success/fail counts per workflow.
- Surface alerts for stuck retries or repeated idempotency blocks (potential duplicates).

