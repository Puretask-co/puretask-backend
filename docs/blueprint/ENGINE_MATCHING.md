# ENGINE_MATCHING

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Smart Match Engine

The Smart Match Engine determines which cleaners are eligible for a job and how they are ranked. Goals: maximize job completion probability, respect availability and preferences, reward reliability, minimize cancellations/no-shows, preserve fairness, and support recurring continuity. Matching is deterministic, explainable, and rule-driven.

---

## 2. Design Philosophy

- Reliability over speed: prioritize likelihood of completion and historical reliability over fastest assignment.  
- Eligibility first, ranking second: phase 1 hard filters, phase 2 weighted scoring.  
- Predictability: same inputs produce the same ranked list; no randomness.

---

## 3. Core Matching Inputs

Job inputs: date/time window, service type, estimated duration, location, subscription vs one-off, special requirements.  
Cleaner inputs: availability schedule, time-off blocks, service areas/radius, reliability score and tier, preferences and exclusions, vehicle/supply flags, subscription continuity eligibility.

---

## 4. Eligibility Rules (Hard Filters)

- Availability: cleaner available for full window; no conflicts; not on time-off.  
- Service area: job location within cleaner area; distance/zip constraints enforced.  
- Capability: required service type accepted; required supplies/vehicle/pets acceptance met.  
- Reliability/tier: minimum thresholds enforced; tier eligibility for certain job types.  
- Risk/restrictions: cleaner not suspended; not blocked by client; not over daily job limits.

---

## 5. Ranking and Scoring (Soft Preferences)

Eligible cleaners are ranked by weighted score. Factors: reliability band, tier, distance, historical completion rate, cancellation/no-show history, recent activity balance. Preferences: job-type preferences, client preferred cleaner, subscription continuity. Fairness controls avoid starving new cleaners or overloading top cleaners, with soft caps per day/week.

---

## 6. Recurring and Subscription Matching

For subscription jobs: prefer same cleaner when possible, validate availability continuity, fall back to general matching if unavailable. Continuity is a preference, not a guarantee.

---

## 7. Assignment Modes

- Auto-assignment: system assigns top-ranked eligible cleaner; cleaner notified and given confirmation window.  
- Offer-based (optional): top N cleaners notified; first acceptance wins; used selectively based on market dynamics.

---

## 8. Assignment Lifecycle

1) Job enters AWAITING_ASSIGNMENT.  
2) Matching engine computes ranked list.  
3) Assignment mode selected.  
4) Cleaner notified.  
5) Confirmation awaited.  
6) Success -> CONFIRMED.  
7) Failure -> re-run matching or expire job.  

---

## 9. Interaction With Other Engines

- Booking: supplies lifecycle context; enforces confirmation windows.  
- Reliability & Tier: supplies scores/tiers; receives assignment outcome feedback.  
- Pricing: ensures pricing eligibility by tier.  
- Messaging: sends offers and reminders.  
- Risk & Fraud: can exclude cleaners or jobs dynamically.  
- Admin & Ops: can override, force assign, or reassign.

---

## 10. Automation and Workers

Workers: queueProcessor, stuckJobDetection. They trigger re-matching on failures, recover from missed confirmations, and detect stuck assignments.

---

## 11. Data Model (Conceptual)

Key entities: cleaner_availability, cleaner_time_off, cleaner_service_areas, cleaner_preferences, job_assignments, assignment_events.

---

## 12. Failure and Edge Case Handling

Handle last-minute cancellations, cleaner dropouts, overlapping jobs, availability changes post-assignment, partial confirmations. System must converge to CONFIRMED, CANCELLED, or EXPIRED.

---

## 13. Canonical Rules

- Eligibility rules are absolute.  
- Ranking rules are weighted.  
- Matching is deterministic.  
- Assignments are logged.  
- No hidden prioritization.  

---

## 14. Versioning Guidance

- V1: Basic availability + reliability filtering.  
- V2: Full scoring and preferences.  
- V3: Subscription continuity optimization.  
- V4+: Advanced fairness and optimization.  

---

End of document.

