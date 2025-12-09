# Earnings Math Spec
(Micro/Unit Spec #5)

## Scope
Defines arithmetic and constraints for earnings (positive and negative) to align with escrow releases and payouts.

## Core Identity
- For each job (base case): earning.amount == escrow_release.amount (unless fees/splits apply).
- System-wide: Σ(earnings.amount) ≈ Σ(escrow_release.amount) ± adjustments.
- Paid payouts total should equal Σ(earnings paid + applied negatives).

## Status flow
- pending → in_payout → paid
- reversed (if refund before payout)
- negative_adjustment (clawbacks) applied in payout math

## Payout math (per cleaner)
```
net_for_payout = Σ(positive earnings pending) + Σ(negative adjustments pending)
```
Apply caps if configured; if net <= 0, no payout this cycle.

## Validation
- No earning without job_id/cleaner_id.
- No duplicate earnings per job unless explicitly supported.
- Negative earnings must link to a cause (refund/dispute/admin).
- For a paid payout: sum of linked earnings = payout.total_amount_credits.

