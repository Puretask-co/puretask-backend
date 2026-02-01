# ENGINE_PRICING

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Pricing Engine

The Pricing Engine determines how much a job costs, how that price is broken down, and how pricing adapts based on job characteristics, cleaner tier and reliability, add-ons and service type, subscriptions and discounts, and risk or operational constraints. Pricing must be deterministic, explainable, auditable, and compatible with the credit economy. Pricing calculates amounts; it does not move money.

---

## 2. Design Philosophy

- Deterministic pricing: same inputs produce the same output; no surge unless explicitly enabled in future.  
- Separation of concerns: pricing calculates what should be charged; Credits & Payments handles how it is paid; Payouts handles how cleaners are paid.  
- Transparency: pricing components visible to clients, cleaners, and admins.

---

## 3. Core Pricing Inputs

Job attributes: service type, estimated duration, property size (optional), add-ons, location (optional future).  
Cleaner attributes: tier, reliability band, eligibility constraints.  
Client attributes: subscription status, risk flags, promotions applied.

---

## 4. Base Pricing Model

Base price = base_hourly_rate * estimated_hours. Base rates may differ by service type, market (future), or cleaner tier (future). Duration constraints enforce minimum billable duration and maximum caps; adjustments handled as pricing modifiers.

---

## 5. Add-Ons and Modifiers

Add-ons (deep clean, appliances, move-out, extra rooms, special supplies) have fixed price or multiplier, eligibility constraints, and visibility rules.

---

## 6. Tier-Based Pricing

Tiers may influence eligibility, earnings share, or optional price premiums. Rules must be simple and predictable, cannot change after booking, and must not introduce hidden costs.

---

## 7. Subscription Pricing

Subscriptions modify pricing by offering discounted rates, cleaner continuity, and reduced booking friction. Applied before credits are authorized, cannot stack with incompatible promotions, and must be reversible on cancellation.

---

## 8. Discounts and Promotions

Discounts may be fixed or percentage, one-time or recurring. They apply only to eligible components, platform fees are calculated after discounts, and discounts never reduce cleaner earnings below minimum thresholds unless explicitly allowed.

---

## 9. Platform Fees

Platform fees are a percentage of gross job price or fixed per job. Fees are invisible to cleaners, visible to admins, and accounted for in the Credit & Payment Engine.

---

## 10. Risk-Based Pricing Adjustments

The Risk Engine may require prepayment, removal of discounts, or higher minimum charges. Risk adjustments are additive constraints, visible to the client at booking time, and do not alter base pricing logic.

---

## 11. Pricing Output Structure

Outputs: gross_price, discounts_applied, net_client_price, platform_fee, cleaner_earnings_estimate, credits_required. This feeds the Credit & Payment Engine.

---

## 12. Interaction With Other Engines

- Booking: requests pricing before job creation; locks pricing at booking.  
- Credit & Payment: uses credits_required; handles escrow and settlement.  
- Payout: uses cleaner earnings estimate as reference; final earnings may differ due to penalties or disputes.  
- Reliability & Tier: supplies tier and eligibility inputs.  
- Risk & Fraud: supplies pricing constraints and overrides.  
- Admin & Ops: can override pricing manually; all overrides logged with reason codes.

---

## 13. Automation and Workers

Pricing is synchronous. Workers may validate anomalies, audit outputs, and flag suspicious patterns.

---

## 14. Failure and Edge Case Handling

Must handle missing inputs, invalid add-on combinations, tier downgrades post-booking, subscription changes mid-cycle. Pricing must fail closed (no undercharging).

---

## 15. Canonical Rules

- Pricing is locked at booking.  
- No retroactive pricing changes (except via disputes).  
- All components are itemized.  
- Pricing logic is versioned.  

---

## 16. Versioning Guidance

- V1: Base pricing + add-ons.  
- V2: Tier-aware pricing.  
- V3: Subscription pricing.  
- V4+: Advanced risk and market-based pricing.  

---

End of document.

