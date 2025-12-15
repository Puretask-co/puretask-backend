# ENGINE_RISK_FRAUD

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Risk and Fraud Engine

Protects PureTask from financial loss, abuse, chargebacks, and systemic reliability degradation. Goals: detect risky behavior early, apply proportional and explainable restrictions, minimize false positives, preserve trust for good users, and integrate with payments, payouts, booking, and reliability. Risk is managed, not eliminated.

---

## 2. Design Philosophy

- Progressive enforcement: observation -> soft friction -> hard restriction; allow self-correction.  
- Deterministic and rule-based: threshold-driven, explainable to admins; ML optional and additive.  
- Behavior over identity: focus on behavioral signals, not static identity alone.

---

## 3. Core Concepts

- Risk score: composite from behavioral patterns, transaction history, reliability signals, disputes, chargebacks; recalculated periodically.  
- Risk flags: discrete concerns (high cancellation, payment failures, repeated disputes, suspicious booking patterns, abnormal payout behavior); flags are auditable and time-bound.  
- Restrictions: require prepayment, disable instant payouts, extend holds, limit booking, freeze activity, require admin review; restrictions are reversible.

---

## 4. Risk Signals (Illustrative)

Client signals: high dispute rate, frequent last-minute cancellations, repeated refund requests, failed payments, chargebacks.  
Cleaner signals: no-shows, repeated cancellations, earnings volatility, payout failures, dispute losses.  
Platform signals: unusual volume spikes, geographic anomalies, duplicate accounts (future), automation abuse.

---

## 5. Risk Scoring Model (Conceptual)

Bounded score (e.g., 0-100), weighted by severity, time-decayed, influenced by reliability tier. Severe events (e.g., chargebacks) override gradual decay.

---

## 6. Risk States

Example states: NORMAL, MONITORED, RESTRICTED, SUSPENDED. Each state defines allowed actions.

---

## 7. Enforcement Actions

- Booking restrictions: require full prepayment, limit concurrent bookings, block certain job types.  
- Payment restrictions: disable credits purchase, restrict refund methods, require manual approval.  
- Payout restrictions: disable instant payouts, extend holding periods, freeze payouts.  

---

## 8. Interaction With Other Engines

- Booking: blocks or modifies booking behavior.  
- Credit & Payment: enforces prepayment; restricts refunds.  
- Payout: applies holds or blocks payouts.  
- Reliability & Tier: supplies behavior signals; receives risk outcomes.  
- Dispute: feeds outcomes and triggers escalations.  
- Messaging: communicates restrictions and warnings.  
- Admin & Ops: reviews cases, applies overrides, clears flags.

---

## 9. Automation and Workers

Workers: goalChecker, creditEconomyMaintenance, stuckJobDetection. Responsibilities: periodic risk evaluation, flag expiry, alert generation, safety checks. Workers must be idempotent, avoid repeated penalties, and log all actions.

---

## 10. Data Model (Conceptual)

Key entities: risk_scores, risk_flags, risk_actions, risk_history. All actions are logged and auditable.

---

## 11. Failure and Edge Case Handling

Handle false positives, rapid behavior change, admin overrides, flag conflicts. System should contain risk without freezing the platform.

---

## 12. Canonical Rules

- Risk actions are proportional.  
- Restrictions are reversible.  
- Severe events override decay.  
- All decisions are logged.  
- Admins can intervene.  

---

## 13. Versioning Guidance

- V1: Basic flags and manual review.  
- V2: Automated restrictions.  
- V3: Cross-engine risk propagation.  
- V4+: Predictive risk modeling.  

---

End of document.

