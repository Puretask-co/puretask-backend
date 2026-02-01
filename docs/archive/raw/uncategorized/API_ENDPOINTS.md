# API Endpoint Spec
(Infrastructure Spec)

## Scope
Defines the API surface for core operations (auth, booking, jobs, credits, payouts, disputes, admin). Maps endpoints to responsible services and states. Ensures idempotency and validation rules.

## Principles
- Auth required where appropriate; role-based (client, cleaner, admin).
- Idempotency on mutating endpoints that can be retried (e.g., approve, complete, refund).
- Validation aligned with domain specs (pricing, escrow, status machine, photos, reliability).
- Errors clear and actionable.

## Core Endpoint Groups (representative)
- Auth: register/login/refresh/me.
- Wallet/Credits: get balance; purchase credits (initiate PI); history.
- Bookings/Jobs:
  - POST /jobs (create booking)
  - GET /jobs (list)
  - GET /jobs/:id
  - PATCH /jobs/:id/assign (admin/system)
  - POST /jobs/:id/accept (cleaner)
  - POST /jobs/:id/check-in (cleaner)
  - POST /jobs/:id/photos (upload metadata)
  - POST /jobs/:id/complete (cleaner)
  - POST /jobs/:id/approve (client)
  - POST /jobs/:id/dispute (client)
  - POST /jobs/:id/cancel (client/admin; policy aware)
- Cancellation/No-show:
  - POST /jobs/:id/cancel (client/admin)
  - POST /jobs/:id/no-show (admin/system)
- Disputes:
  - POST /jobs/:id/dispute
  - GET /disputes/:id
  - POST /disputes/:id/resolve (admin)
- Payouts (admin/cleaner views):
  - GET /payouts (admin filter)
  - GET /payouts/my (cleaner)
  - POST /payouts/trigger (admin/dev)
- Admin:
  - User management (suspend, roles)
  - Manual credits/debits (logged, ledger-backed)
  - Manual refunds (policy + ledger-backed)
  - Risk flags (client/cleaner)

## Request/Response Standards
- JSON; consistent error shape `{ error: { code, message } }`.
- Pagination on lists.
- Idempotency-Key header for idempotent operations (approve, refunds).
- Include versioning where needed (pricing_version on jobs).

## Validation & Side-Effects (examples)
- POST /jobs:
  - Validate address/time, pricing, wallet/auto-refill; create escrow_hold.
- POST /jobs/:id/approve:
  - Validate completion, photos, check-in; create escrow_release + earnings; idempotent.
- POST /jobs/:id/complete:
  - Validate check-in, photos; update status; reliability event.
- POST /jobs/:id/dispute:
  - Enforce dispute window; create dispute record; block approval; no double disputes.
- POST /jobs/:id/cancel:
  - Enforce policy windows; escrow reversal/partial; reliability impacts.
- Admin refunds/credits:
  - Ledger-backed; reason required; no double-refunds; optional Stripe refund path.

## Security
- Role checks per endpoint.
- Input validation (schemas/zod).
- Avoid leaking PII between roles.

## Idempotency Rules (key ones)
- Approve: multiple calls → one release/earning.
- Refunds: one refund per event; Stripe event idempotency enforced.
- Payout state updates: payout.paid/fail webhooks idempotent.

## Monitoring/Logging (tie-in)
- Log all mutation endpoints with actor, ids, and results.
- Surface errors for fraud/risk triggers.

## Dependencies
- Domain specs (Financial, Job Lifecycle, Micro, UI/UX).
- Stripe webhook processing (inbound events complement outbound API).

