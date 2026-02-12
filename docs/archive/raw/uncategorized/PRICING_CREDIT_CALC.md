# Pricing & Credit Calculation Spec
(Job Lifecycle Spec #2)

## 0. Scope & Purpose
Defines how job price is calculated in credits: inputs, formulas, and integration with escrow and booking. Assumes credits are the unit; cash is only for purchasing credits.

## 1. Inputs
- Estimated duration (hours)
- Base rate per hour (by region/tier/cleaning type)
- Cleaning type / add-ons
- Client/cleaner tier modifiers (optional)
- Minimum/maximum caps (policy)
- Rounding rules (credits precision)

## 2. Core Calculation
```
base = hours * rate_per_hour
modifiers = add_on_surcharges + tier_adjustments + regional/special fees
price_credits = base + modifiers
```
Then:
- Apply caps (min/max job price if configured)
- Round to configured credit precision (e.g., 0.01)
- Result = `required_credits`

## 3. Data & Configuration
- Rates table (or config): rate_per_hour by region/cleaning_type/tier.
- Add-ons table/config: fixed or per-hour surcharges.
- Caps: MIN_JOB_CREDITS, MAX_JOB_CREDITS (optional).
- Precision: decimal scale used for credits (match wallet/ledger).

## 4. Integration Points
- Booking: computed `required_credits` → escrow_amount.
- Auto-refill: shortfall = required_credits - wallet_balance.
- Escrow: hold exactly required_credits at booking.
- Approval/Earnings: earning defaults to escrow_amount (unless fees/ splits added later).

## 5. Business Rules
- Deterministic: same inputs → same price (versioned config).
- Versioning: store `pricing_version` or the resolved components on the job for audit.
- No hidden surcharges: all modifiers explicit.
- Rounding: only at final step; internal math uses full precision then rounds once.

## 6. Sub-Scenarios
- Standard clean: duration * rate, no add-ons.
- With add-ons: add fixed/per-hour surcharges.
- Tiered pricing: client/cleaner tier discounts or uplift.
- Regional variance: different base rate by region.
- Caps enforced: below min or above max adjusts to cap.

## 7. Failure Modes
- Missing rate for region/type → reject booking with clear error.
- Negative or zero duration → reject.
- Overflow (extreme duration) → reject by max cap rule.

## 8. Validation & Integrity
- Store resolved pricing breakdown on job (base, modifiers, total, version).
- Escrow amount must equal required_credits used at booking.
- Later audits (disputes, refunds) use stored breakdown, not recomputed live.

## 9. Dependencies
- Consumed by Booking System spec.
- Feeds Escrow (amount) and Approval→Earnings (default earning amount).
- Tied to Wallet precision and Ledger consistency.

