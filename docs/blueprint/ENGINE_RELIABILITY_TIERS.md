# ENGINE_RELIABILITY_TIERS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Reliability and Tier Engine

This engine quantifies how trustworthy a cleaner is and translates that signal into platform behavior. Goals: increase completion and on-time performance, reduce cancellations and no-shows, reward consistent behavior, gradually restrict risky behavior, and provide deterministic inputs to matching, pricing, payouts, and risk systems. Reliability is earned, not assumed.

---

## 2. Design Philosophy

- Behavior over ratings: rely on attendance, timeliness, completion, cancellations, disputes; ratings are secondary.  
- Gradual enforcement: penalties escalate from warnings to soft and hard restrictions; aim to correct before excluding.  
- Deterministic and explainable: outcomes are consistent and auditable; no hidden penalties.

---

## 3. Core Concepts

- Reliability score: bounded numeric score (e.g., 0-100), decays over time, weighted toward recent jobs, updated via workers.  
- Tier: discrete classification (e.g., Bronze, Silver, Gold, Platinum) derived from reliability and tenure; influences matching priority, payout eligibility, and job visibility.  
- Events: reliability updated from job events (on-time check-in, late arrival, completion, cleaner cancellation, no-show, dispute outcome).

---

## 4. Reliability Inputs

Positive signals: on-time check-in, successful completion, consecutive completed jobs, high client ratings (secondary).  
Negative signals: late check-in, cleaner-initiated cancellation, no-show, dispute loss, repeated declines of eligible jobs (optional).

---

## 5. Scoring Model (Conceptual)

Weighted events with decay and severity classes; recent events outweigh older ones. Scores recover gradually with good behavior; severe events have longer impact; recovery per window is capped to prevent gaming.

---

## 6. Tier Assignment

Tiers assigned based on reliability score, minimum job count, and time on platform. Promotions are gradual; demotions may be immediate after severe events. All tier changes are logged and auditable.

---

## 7. Downstream Effects

- Matching: higher tiers ranked higher; low reliability may exclude from certain jobs.  
- Pricing: tier-based pricing eligibility; optional premiums for high tiers (future).  
- Payouts: holding periods adjusted by tier; instant payouts gated by tier.  
- Risk & Fraud: low reliability increases scrutiny; repeated severe events trigger risk flags.

---

## 8. Risk-Based UI States

Engine feeds risk-based UI states such as warning banners, prepayment requirements, temporary restrictions, limited job visibility. UI states are explicit, actionable, and reversible with good behavior.

---

## 9. Interaction With Other Engines

- Booking: supplies job outcomes; applies restrictions based on reliability.  
- Matching: uses reliability and tier for ranking and eligibility.  
- Pricing: enforces tier eligibility.  
- Payout: adjusts holding rules; gates instant payouts.  
- Dispute: feeds outcomes back into scoring.  
- Admin & Ops: views scores and history; applies manual overrides (logged).

---

## 10. Automation and Workers

Workers: reliabilityRecalc, cleaningScores, goalChecker. Responsibilities: periodic score recalculation, tier updates, goal/incentive checks. Workers must be idempotent, process deltas efficiently, and avoid double-counting.

---

## 11. Data Model (Conceptual)

Key entities: reliability_scores, reliability_events, tier_history, cleaner_goals (optional). Updates are event-driven.

---

## 12. Failure and Edge Case Handling

Handle sparse data for new cleaners, dispute reversals, manual admin corrections, score drift over time. System must converge to a valid tier.

---

## 13. Canonical Rules

- Reliability is behavior-based.  
- Tiers are derived, not manually set.  
- Severe events override gradual decay.  
- All changes are logged.  
- UI states must reflect reliability accurately.  

---

## 14. Versioning Guidance

- V1: Basic penalties and tiering.  
- V2: Full scoring and downstream effects.  
- V3: Incentives and goals.  
- V4+: Advanced risk modeling.  

---

End of document.

