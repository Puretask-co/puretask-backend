# Ledger Entry Rules Spec
(Micro/Unit Spec #3)

## Scope
Defines how ledger rows are written and validated for all credit movements.

## Types (examples)
- wallet_purchase
- subscription_credit
- escrow_hold
- escrow_release
- escrow_reversal
- refund
- admin_credit / admin_debit
- earning / negative_adjustment (if stored in ledger)

## Requirements
- Every wallet change must have a ledger row.
- Sign/meaning consistent: hold decreases wallet; release does not change wallet; refund increases wallet; etc.
- job_id required for escrow* and earning-related rows.
- user_id required for all user-ledger rows.
- Amount uses consistent precision (DECIMAL scale).

## Validation
- Prevent zero or negative where not meaningful (e.g., wallet_purchase must be >0).
- Prevent missing foreign keys (user/job).
- Prevent duplicate ledger rows for same source operation (use idempotency keys).

## Atomicity
- Wallet updates and ledger inserts must occur in one transaction.
- On failure, neither should persist.

## Integrity Checks
- Sum derived from ledger must equal wallet_credits_balance (see wallet math spec).
- For a job: escrow_hold - escrow_release - escrow_reversal = active escrow for that job.

