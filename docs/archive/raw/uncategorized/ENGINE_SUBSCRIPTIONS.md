# ENGINE_SUBSCRIPTIONS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Subscription Engine

Enables recurring, predictable service relationships between clients and cleaners. Goals: reduce booking friction for repeat clients, improve cleaner income stability, increase retention, automate recurring job creation and billing, and preserve reliability, fairness, and flexibility. Subscriptions are job generators, not jobs themselves.

---

## 2. Design Philosophy

- Subscriptions generate jobs: each job follows the full Booking lifecycle; ensures consistent accounting, dispute handling, and reliability tracking.  
- Flexibility without chaos: clients can pause, skip, modify, or cancel, but changes are time-bound, explicit, logged, and predictable.  
- Cleaner continuity is a preference, never a guarantee.

---

## 3. Core Concepts

- Subscription defines service type, frequency (weekly/biweekly/monthly), preferred time window, pricing rules, preferred cleaner (optional), start and end conditions.  
- Subscription job is a standard job instance, created automatically, fully compatible with all engines.  
- Billing cycle occurs per job by default (per cycle optional future); always billed before execution.

---

## 4. Subscription Lifecycle States

ACTIVE, PAUSED, CANCELLED, EXPIRED.  
- ACTIVE: generates jobs as scheduled; billing and matching enabled.  
- PAUSED: no jobs generated; no billing; can resume.  
- CANCELLED: terminated by client or system; no future jobs generated.  
- EXPIRED: ended due to predefined condition; historical record preserved.  

---

## 5. Job Generation Logic

- Schedule: frequency defines cadence; jobs created ahead of time (configurable window).  
- Pricing lock: pricing calculated at job creation; subscription discounts applied; locked per job.  
- Credit authorization: credits authorized per job; failures trigger notifications and retries.

---

## 6. Cleaner Assignment and Continuity

- Preferred cleaner: system attempts same cleaner; checks availability and eligibility; falls back if unavailable.  
- Reliability constraints: cleaner must remain eligible; tier downgrades may break continuity.

---

## 7. Skip, Pause, and Modify Rules

- Skip: client may skip a single occurrence before cutoff; no job generated.  
- Pause: temporarily stops all future jobs; no billing during pause.  
- Modify: time window, frequency, add-ons, preferred cleaner; applies to future jobs only. All changes logged.

---

## 8. Cancellations and Refunds

Subscription cancellation does not cancel already-created jobs; those follow normal cancellation rules. Refunds apply per job via Credit & Payment Engine rules.

---

## 9. Interaction With Other Engines

- Booking: receives generated jobs; enforces lifecycle.  
- Pricing: applies subscription discounts; locks pricing per job.  
- Credit & Payment: handles recurring authorization and failed payments.  
- Matching: applies continuity preference and eligibility.  
- Reliability & Tier: tracks outcomes per job; may restrict eligibility.  
- Messaging: sends reminders; notifies of skips, pauses, failures.  
- Admin & Ops: views/modifies subscriptions; resolves edge cases.

---

## 10. Automation and Workers

Workers: subscriptionJobs, queueProcessor. Generate jobs, retry failed billing, notify clients of issues, prevent duplicate generation. Workers must be idempotent.

---

## 11. Data Model (Conceptual)

Key entities: subscriptions, subscription_schedules, subscription_jobs, subscription_events. All changes logged as events.

---

## 12. Failure and Edge Case Handling

Handle payment failures, cleaner unavailability, schedule drift, client inactivity, partial modifications. System must fail safely.

---

## 13. Canonical Rules

- Subscriptions generate jobs.  
- Jobs remain atomic.  
- Pricing locks per job.  
- Continuity is best-effort.  
- All changes are logged.  

---

## 14. Versioning Guidance

- V1: Basic recurring jobs.  
- V2: Continuity and skip/pause.  
- V3: Advanced billing models.  
- V4+: Subscription bundles and incentives.  

---

End of document.

