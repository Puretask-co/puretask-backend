# Admin Dispute Resolution Spec
(Admin/Ops Spec)

## Scope
Admin adjudication of client-cleaner disputes with clear financial outcomes.

## Capabilities
- View dispute details: job data, photos, check-in, chat logs, history.
- Decide outcome: client wins, cleaner wins, partial.
- Trigger financial actions:
  - Client wins: refund/escrow reversal; reverse earnings/negative adjustment if post-payout.
  - Cleaner wins: approve job (if not yet), earnings kept/created.
  - Partial: split refund/earnings per policy.
- Apply reliability penalties/relief as per rules.

## Rules
- One active dispute per job.
- Decision writes audit log (admin, reason, evidence).
- Idempotent decisions: reapplying same outcome should not double refund/pay.

## UI/Flow
- Dispute queue → detail view → choose outcome → confirm → trigger refund/earnings actions.

