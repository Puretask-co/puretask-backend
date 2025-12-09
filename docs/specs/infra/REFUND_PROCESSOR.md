# Refund Processor Spec
(Infrastructure Spec)

## Scope
Implements processing of refunds driven by Stripe events or admin actions, updating wallet/escrow/earnings per Refund Logic spec.

## Triggers
- Stripe: charge.refunded (purchase/subscription/job-related) and invoice.refunded (if used).
- Admin/manual refund requests (API).
- Dispute resolution (resolved in client’s favor).

## Steps
1) Idempotency check (event_id/object_id or admin request key).
2) Resolve context: user, job (if job refund), original purchase/subscription.
3) Determine refund type and timing (before approval, after approval pre-payout, after payout).
4) Apply financial changes:
   - Wallet/escrow reversals
   - Earnings reversal or negative adjustments (if post-payout)
   - Ledger entries (refund, escrow_reversal, etc.)
5) Update job/dispute status accordingly.

## Safeguards
- Do not refund more than original amount/remaining credits.
- Prevent double refunds.
- Transactional updates of wallet + ledger.

## Integration
- Stripe refund creation may be upstream (dashboard/admin); processor reflects it internally.
- Downstream effects on payouts handled via negative earnings and payout processor.

