# ENGINE_BOOKING

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Booking Engine

The Booking Engine is the central state machine of PureTask. It creates jobs, enforces lifecycle rules, manages time-based constraints, orchestrates transitions, and triggers downstream systems (payments, messaging, reliability, payouts, analytics). All other engines either react to booking events or place constraints on booking behavior. If the Booking Engine is correct, the marketplace behaves predictably.

---

## 2. Core Concepts

### 2.1 Job as an Atomic Unit
A Job represents a single, scheduled unit of work. Every job has exactly one client, has zero or one assigned cleaner at any moment, has a defined time window, has a deterministic lifecycle, and produces events used by other engines. Jobs are immutable in history; changes create events.

### 2.2 Explicit State Machine
Jobs move through explicit states, not inferred flags. State transitions are validated, logged, automatable, and auditable. No engine is allowed to mutate a job outside allowed transitions.

---

## 3. Job Lifecycle States (Final)

Primary states: DRAFT, CREATED, AWAITING_ASSIGNMENT, ASSIGNED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, EXPIRED, NO_SHOW, DISPUTED.

- DRAFT: Job exists client-side only; no payment captured; no cleaner visibility; no automation.
- CREATED: Job submitted by client; credits authorized/reserved; not yet visible for assignment.
- AWAITING_ASSIGNMENT: Job visible to eligible cleaners; Smart Match Engine engaged; time-based expiration rules apply.
- ASSIGNED: Cleaner selected (auto or manual); awaiting cleaner confirmation (if required); cancellation penalties not yet active.
- CONFIRMED: Cleaner has accepted; cancellation penalties active; notifications dispatched; check-in window scheduled.
- IN_PROGRESS: Cleaner has checked in; work underway; time tracking and verification active.
- COMPLETED: Cleaner checked out; job verified; credits released from escrow; reliability and payout events triggered.
- CANCELLED: Job cancelled by client, cleaner, or system; reason recorded; penalties/refunds per policy.
- EXPIRED: Job not accepted or confirmed within allowed time; system-initiated cancellation; credits refunded or adjusted.
- NO_SHOW: Cleaner failed to check in within window; automatic penalties applied; client remediation triggered.
- DISPUTED: Job outcome challenged; economic effects paused or reversed; Dispute Engine takes control.

---

## 4. Time Windows and Scheduling Rules

- Booking window: start_time, end_time, timezone captured.  
- Confirmation window: after assignment, cleaner has a fixed time to confirm; failure returns job to AWAITING_ASSIGNMENT or EXPIRES.  
- Check-in window: cleaner must check in within X minutes before start_time and Y minutes after start_time; outside window triggers NO_SHOW logic.  
- Auto-expiration: jobs expire if no cleaner assigned by cutoff or if cleaner does not confirm in time; enforced by workers.

---

## 5. Cancellation Rules (High-Level)

- Client cancellations: based on time before start, cleaner confirmation status, subscription vs one-off; outcomes include full refund, partial refund, or credit forfeiture.  
- Cleaner cancellations: based on time before start, reason code, cleaner reliability tier; outcomes include reliability penalty, visibility reduction, or economic penalty.  
- System cancellations: triggered by cleaner no-show, invalid state, risk engine lock, or manual admin intervention.

---

## 6. Job Modifications

Allowed modifications depend on state:

- DRAFT: all changes allowed.  
- CREATED: time window changes allowed.  
- AWAITING_ASSIGNMENT: time window changes allowed.  
- ASSIGNED: limited changes with cleaner approval.  
- CONFIRMED: very limited changes.  
- IN_PROGRESS/COMPLETED: no modifications.  

All modifications create job_events.

---

## 7. Automation and Workers

Workers: autoCancelJobs, autoExpireAwaitingApproval, stuckJobDetection, queueProcessor. They enforce time-based transitions, recover from invalid states, and act as safety nets. Workers must be idempotent, retry-safe, and observable.

---

## 8. Interactions With Other Engines

- Credit & Payment: authorizes credits at CREATED; releases or refunds credits at terminal states.  
- Smart Match: determines eligible cleaners and ranks candidates.  
- Messaging: creates job-linked threads; sends lifecycle notifications and reminders.  
- Reliability & Tier: consumes job outcomes; applies penalties or bonuses; updates tier status.  
- Payout: converts completed jobs into earnings; delays or reverses payouts if disputes arise.  
- Analytics: records job events for funnel metrics and KPIs.  
- Fraud & Risk: may block booking, force prepayment, or cancel/restrict jobs.  
- Admin & Ops: can override any state; can reassign, cancel, or adjust jobs.

---

## 9. Data Model (Conceptual)

Key entities: jobs, job_events, job_assignments, job_cancellations, job_verifications. All writes are append-only via events where possible.

---

## 10. Failure and Edge Case Handling

Must gracefully handle partial assignments, lost confirmations, worker crashes, webhook delays, payment authorization failures, messaging failures. The system must always converge to a valid terminal state.

---

## 11. Canonical Rules

- No job skips states.  
- No silent state mutation.  
- All time-based logic is enforced by workers.  
- Economic effects are reversible until COMPLETED.  
- COMPLETED is the point of no return (except disputes).

---

## 12. Versioning Guidance

- V1: Core lifecycle, basic cancellations, basic automation.  
- V2: Tighter enforcement, better matching, better penalties.  
- V3+: Advanced policies, subscriptions, dynamic windows.

---

End of document.

