# Payout Processor Spec
(Infrastructure Spec)

## Scope
Implements payout batching and initiation to Stripe Connect for cleaners, consuming earnings and negative adjustments.

## Inputs
- Earnings with status=pending (normal and negative_adjustment).
- Cleaner payout eligibility (Connect account active, not blocked).

## Processing Steps
1) Select cleaners with eligible earnings (pending).
2) Compute net_for_payout per cleaner:
   - gross_positive + total_negative (apply caps if configured).
3) If net_for_payout > 0:
   - Create payout row (status=pending, period_start/end).
   - Attach earnings (set payout_id, status=in_payout).
   - Call Stripe payout to cleaner’s Connect account; store stripe_payout_id; set payout.status=processing.
4) If net_for_payout ≤ 0: no payout; carry negative forward.

## Webhook Handling
- payout.paid: mark payout paid; earnings paid; idempotent.
- payout.failed: mark payout failed; earnings reverted to pending/pending_retry; alert admin/cleaner.

## Safeguards
- Idempotency: earnings included once; payout.paid retried safely.
- Caps: optional limit on % of payout consumed by negatives.
- Skip cleaners without Connect accounts; leave earnings pending.

## Integrity
- payout.total_amount_credits == sum linked earnings.amount
- Paid payouts == sum of paid earnings (credits) system-wide.

