# DB Constraints & Validation Spec
(Micro/Unit Spec #7)

## Scope
Defines required database constraints and validation rules to prevent orphaned or inconsistent financial/job data.

## Core Constraints
- Foreign keys:
  - credit_ledger.user_id → users.id (NOT NULL)
  - credit_ledger.job_id → jobs.id (NOT NULL for escrow/earning-related types)
  - earnings.cleaner_id → cleaners.id (NOT NULL)
  - earnings.job_id → jobs.id (NOT NULL for normal earnings)
  - payouts.cleaner_id → cleaners.id
  - job_photos.job_id → jobs.id; job_photos.cleaner_id → cleaners.id
- Uniqueness/identity (where applicable):
  - stripe_events.event_id unique
  - One primary earnings row per job (unless multi-cleaner feature exists)
- Not-null / type guards:
  - ledger.amount DECIMAL with fixed scale; amount > 0 for purchase/subscription/hold; amount ≥ 0 where sensible.
  - wallet_credits_balance NOT NULL, DECIMAL with fixed scale.
  - job.status constrained to allowed enum.

## Validation Rules (application-level)
- Prevent ledger rows with missing job_id for escrow*/earning-related types.
- Prevent negative wallet updates unless an explicit “debt” policy is active.
- Prevent earnings without corresponding escrow_release.
- Prevent payouts without linked earnings; payout.total must equal sum of linked earnings.
- Time/order validations:
  - approved_at ≥ completed_at ≥ check_in_at ≥ accepted_at
  - payout paid_at ≥ created_at

## Integrity Checks (periodic)
- Wallet vs ledger balance per user.
- Escrow per job: hold - release - reversal = active escrow.
- Earnings vs escrow_release sums.
- Payout sums vs paid earnings.
- Stripe events: all processed events exist once; no unprocessed critical events stuck.

## Failure Handling
- On constraint violation: reject transaction, log error.
- On integrity check mismatch: alert/flag for manual remediation.

