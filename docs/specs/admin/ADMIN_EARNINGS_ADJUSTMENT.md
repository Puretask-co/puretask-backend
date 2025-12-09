# Admin Earnings Adjustment Spec
(Admin/Ops Spec)

## Scope
Admin ability to adjust cleaner earnings (bonus or clawback) outside normal job flow.

## Actions
- Bonus: add positive earning (type=bonus) linked to cleaner (and optionally job).
- Clawback: add negative earning (type=negative_adjustment) linked to job/refund.

## Rules
- Must be traceable (job/refund/admin reason).
- Included in payout math; subject to caps for negatives.
- No direct edits to existing earnings amounts; use adjustments instead.
- Audit log: admin, reason, amounts.

