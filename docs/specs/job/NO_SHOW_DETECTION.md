# No-Show Detection Spec
(Job Lifecycle Spec #7)

## 0. Scope & Purpose
Defines how the system detects and handles cleaner no-shows, ensuring client protection and proper refunds/penalties.

## 1. Criteria for No-Show
- Cleaner accepted/assigned but did not check-in by scheduled_start + grace period (configurable).
- Optional: client reports no-show; combined with lack of check-in to confirm.

## 2. Detection Logic
- Scheduled job watcher checks upcoming jobs:
  - If current_time > scheduled_start + grace AND no check-in AND not canceled → mark no_show.
- Manual/admin override: admin can mark no_show based on client report.

## 3. Financial Outcome
- Escrow reversal: full refund to client wallet.
- Ledger: escrow_reversal (full amount); no earnings.

## 4. Reliability Outcome
- Cleaner reliability penalty (heavy).
- Optional: auto-suspension after repeated no-shows.

## 5. State Transition
- Job status → no_show (terminal or leads to reschedule flow if supported).
- Prevents approval/earnings/payout from this job.

## 6. Sub-Scenarios
- Cleaner never checks in; system auto-flags after grace.
- Client reports no-show; admin confirms → mark no_show.
- Cleaner checks in late but within extended grace → allowed with reliability hit (configurable).

## 7. Failure Handling
- If escrow missing, log anomaly; do not create negative wallet.
- If client already refunded via other path, ensure idempotency (no double refund).
- If cleaner did check-in but location invalid: treat via dispute/quality, not no-show (policy choice).

## 8. Dependencies
- Escrow Lifecycle (refund)
- Reliability Score (penalty)
- Job Status Machine (no_show state)

