# Cancellation Rules Spec
(Job Lifecycle Spec #6)

## 0. Scope & Purpose
Defines how cancellations are handled, fees/refunds, and reliability impacts for client and cleaner. Integrates with escrow and refund logic.

## 1. Actors & Timing
- Client cancellation: may be early or late relative to scheduled_start.
- Cleaner cancellation: after assignment/acceptance.
- System cancellations: e.g., no cleaner assigned in time (optional), force-majeure.

## 2. Policy Windows (configurable)
- Early window: full refund (e.g., >48h).
- Mid/late window: partial refund (e.g., 24–48h → 50% refund).
- Last-minute: no refund (e.g., <24h → 0% refund).
- Cleaner cancel: client receives full refund.

## 3. Financial Outcomes
- Escrow reversal:
  - Early: 100% back to wallet.
  - Mid/late: refund_amount = escrow * policy%; forfeit_amount = remainder (may be platform/cleaner policy).
  - Cleaner cancel: 100% refund to client.
- Ledger entries: escrow_reversal (refund portion), optional forfeit ledger entry (if tracked).
- Earnings: none created if canceled pre-approval.

## 4. Reliability Impacts
- Client late cancel: optional penalty to client risk/flex profile.
- Cleaner cancel after acceptance: negative reliability event; potential lockout.
- System cancel (no assignment): no penalty to client; optional to platform.

## 5. State Transitions
- Before in_progress: job → canceled_by_client or canceled_by_cleaner; escrow adjusted per policy.
- After in_progress: treat as dispute/inconvenience; may require partial refunds (handled via dispute/refund spec).

## 6. Sub-Scenarios
- Client cancels 3 days before: full refund.
- Client cancels 12 hours before: no refund (or policy %).
- Client cancels after check-in: treat as dispute/partial refund path, not pure cancel.
- Cleaner cancels 1 hour before: full client refund; cleaner penalty.
- System auto-cancel due to no assignment: full refund to client.

## 7. Failure Handling
- Cancellation requested after job approved → use refund/dispute path, not cancel.
- Double-cancel request → idempotent; no double ledger.
- If escrow missing → log/flag; do not create negative wallet.

## 8. Dependencies
- Escrow Lifecycle (reversal logic)
- Refund Logic (for post-approval cases)
- Job Status Machine (cancel states)
- Reliability/Client Risk (penalties)

