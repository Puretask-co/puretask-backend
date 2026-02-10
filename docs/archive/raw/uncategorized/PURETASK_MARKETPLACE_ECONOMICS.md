# PURETASK_MARKETPLACE_ECONOMICS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of This Document

Defines the economic model of PureTask: money flows, incentives, penalties, platform value capture, financial safety, and long-term sustainability. Economics are enforced via Credit, Pricing, Payout, Reliability, and Risk engines.

---

## 2. Core Economic Principles

- Prepaid, escrow-based marketplace: all client spending prepaid via credits and held in escrow until work verified. Ensures no unpaid labor, clear refunds, reduced fraud, predictable cash flow.  
- Alignment through incentives: reward reliability, consistency, long-term relationships, predictable behavior; penalize no-shows, late cancellations, disputes, abuse.  
- Platform risk containment: never pay out unverified or disputable work; never expose to unbounded losses; risk is priced and controlled.

---

## 3. Money Flow Overview

Standard job flow: client purchases credits -> credits reserved in escrow -> job completes -> credits split into cleaner earnings and platform fee -> cleaner earnings paid on schedule.  
Subscription job flow: same mechanics, with auto-generated jobs, possible subscription discounts, and cleaner continuity preference.

---

## 4. Platform Revenue Model

Primary revenue: percentage take rate per completed job.  
Secondary (optional/future): subscription fees, instant payout fees, boosts/priority visibility, premium support.

---

## 5. Take Rate Logic

Applied after discounts and before payouts, per job. May vary by service type, market, or tier (future). Must be predictable, internally transparent, and adjustable by admin policy.

---

## 6. Cleaner Earnings Model

Earnings are job price minus platform fee, subject to penalties/bonuses, and held until eligible for payout. Earnings are credits, not cash.

---

## 7. Incentives

Positive: higher matching priority, access to instant payouts, better job density, tier-based benefits.  
Negative: reduced visibility, earnings holds, temporary restrictions, permanent removal in extreme cases.

---

## 8. Penalties and Loss Absorption

- Cleaner penalties: cancellation penalties, no-show penalties, dispute losses; may reduce earnings or visibility and affect tier.  
- Client penalties: late cancellation fees, forfeited credits, restrictions for abuse.  
- Platform absorption: platform may absorb losses to preserve trust or resolve ambiguity; all absorption logged and measured.

---

## 9. Refund Economics

Refunds reduce gross revenue and may or may not reduce platform fees depending on policy. Tracked as cost of quality. High refund rates trigger pricing, matching, and risk review.

---

## 10. Unit Economics (Conceptual)

Per-job metrics: gross job value, platform revenue, cleaner payout, operational cost, dispute cost, net margin. Tracked via Analytics Engine.

---

## 11. Interaction With Other Engines

- Pricing: determines gross price and discounts.  
- Credit & Payment: manages escrow and refunds.  
- Payout: converts earnings to cash.  
- Reliability: influences incentives.  
- Risk: prices risk via restrictions.  
- Analytics: measures margins and trends.  

---

## 12. Automation and Workers

Workers: creditEconomyMaintenance, weeklySummary. Detect margin anomalies, surface loss patterns, track incentive ROI.

---

## 13. Canonical Rules

- No revenue without completed work.  
- Incentives must be earned.  
- Penalties must be predictable.  
- Losses must be visible.  
- Economics must reconcile daily.  

---

## 14. Versioning Guidance

- V1: Simple take rate.  
- V2: Incentives and penalties.  
- V3: Subscriptions and add-ons.  
- V4+: Advanced monetization.  

---

End of document.

