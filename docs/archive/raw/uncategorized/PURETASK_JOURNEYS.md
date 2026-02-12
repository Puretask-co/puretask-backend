# PURETASK_JOURNEYS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of This Document

Describes end-to-end experience for clients and cleaners, connecting user flows to system engines, automation, rules, and policies. Every step maps to one or more engines defined in the blueprint.

---

## 2. Customer Journey (End-to-End)

### 2.1 Discovery and Account Creation
User actions: visit, create account, verify email/phone.  
System actions: user record, risk baseline, wallet created empty.  
Engines: Admin/Ops, Risk & Fraud, Credit & Payments.

### 2.2 First Booking
User: select service, time window, add-ons, see price, confirm.  
System: pricing calculated/locked; credits authorized; job created (CREATED -> AWAITING_ASSIGNMENT); matching starts.  
Engines: Booking, Pricing, Credit & Payments, Matching, Messaging.

### 2.3 Pre-Job Period
User: view assigned cleaner, prepare, communicate via thread.  
System: assignment confirmation, reminders, reliability constraints enforced.  
Engines: Matching, Messaging, Reliability, Risk.

### 2.4 Job Execution
User: cleaner arrives, work performed.  
System: check-in validated; job IN_PROGRESS; monitor for no-show/late.  
Engines: Booking, Messaging, Reliability.

### 2.5 Job Completion
User: reviews work, optional rating.  
System: check-out verified; escrow released; earnings credited; job COMPLETED.  
Engines: Booking, Credit & Payments, Payouts, Reliability, Analytics.

### 2.6 Post-Job Outcomes
Happy path: no action; reliability improves; cleaner paid.  
Unhappy path: client files dispute; evidence collected; resolution applied.  
Engines: Disputes, Messaging, Credit & Payments, Reliability, Admin/Ops.

### 2.7 Subscription Adoption (Optional)
User: opts into recurring service; manages skips/pauses.  
System: subscription created; jobs generated automatically; cleaner continuity attempted.  
Engines: Subscriptions, Booking, Matching, Pricing, Credit & Payments.

---

## 3. Cleaner Journey (End-to-End)

### 3.1 Onboarding
User: create cleaner account, profile, availability, service areas, accept policies.  
System: cleaner role activated; reliability initialized; tier baseline; wallet created.  
Engines: Admin/Ops, Reliability, Matching, Risk.

### 3.2 Job Visibility and Assignment
User: receives offers; accepts/declines.  
System: eligibility checked; ranking applied; confirmation windows enforced.  
Engines: Matching, Booking, Messaging, Reliability.

### 3.3 Pre-Job Preparation
User: review details; communicate with client.  
System: reminders; no-show safeguards.  
Engines: Messaging, Booking, Reliability.

### 3.4 Job Execution
User: check-in; perform work; upload verification if required.  
System: IN_PROGRESS state; time tracked.  
Engines: Booking, Messaging, Reliability.

### 3.5 Job Completion and Earnings
User: check-out; see earnings update.  
System: escrow released; earnings credited; reliability updated.  
Engines: Credit & Payments, Payouts, Reliability, Analytics.

### 3.6 Payouts
User: receives weekly payout; may request instant payout (if eligible).  
System: eligibility calculated; Stripe payout initiated; failures retried.  
Engines: Payouts, Risk & Fraud, Reliability, Admin/Ops.

### 3.7 Disputes and Penalties (If Any)
User: responds to dispute; submits evidence.  
System: earnings frozen or adjusted; reliability penalties applied.  
Engines: Disputes, Reliability, Credit & Payments, Messaging.

---

## 4. System Touchpoints Summary

| Journey Step | Engines |
|-------------|---------|
| Booking | Booking, Pricing, Payments |
| Assignment | Matching, Reliability |
| Communication | Messaging |
| Execution | Booking |
| Completion | Payments, Payouts |
| Disputes | Disputes, Admin |
| Analytics | Analytics |
| Risk | Risk & Fraud |

---

## 5. UX and System Alignment Rules

- UI must reflect system truth.  
- No optimistic UI without confirmation.  
- State transitions must be visible.  
- Errors must be explainable.  
- Users must understand consequences of actions.  

---

## 6. Canonical Rules

- Journeys are job-centric.  
- Subscriptions generate jobs, not shortcuts.  
- Reliability affects experience.  
- Automation silently enforces rules.  
- Admins intervene only when necessary.  

---

End of document.

