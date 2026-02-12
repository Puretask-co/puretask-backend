# Admin Refund Controls Spec
(Admin/Ops Spec)

## Scope
Admin-initiated refunds (wallet credits or Stripe refunds) with correct ledger/escrow/earnings handling.

## Actions
- Refund credit purchase/subscription (Stripe or wallet adjustment).
- Job-based refund (pre-approval, post-approval, post-payout).
- Partial refunds.

## Rules
- Use Refund Processor logic: no double refunds; cap by original amount/unused credits.
- If post-payout: create negative earnings adjustment for cleaner.
- All refunds ledger-backed; record admin_id, reason.
- Stripe refunds: ensure mapping to original charge/invoice; idempotent.

## UI/Flow
- Select user/job/payment; choose refund type/amount; confirm; processor executes updates; show result/alerts.

