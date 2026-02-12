# PURETASK_FINAL_BLUEPRINT_OVERVIEW

## Status
Canonical - Single Source of Truth  
Derived exclusively from PureTask internal documents, system specs, and platform design materials.

---

## 1. Purpose of This Document

This document defines PureTask in its final, fully realized form.

It is not:
- A V1 spec
- A marketing description
- A partial or aspirational outline

It is:
- The authoritative blueprint of what PureTask is designed to become
- The architectural foundation against which all versions (V1-V5) are measured
- The reference used to align product, engineering, operations, and automation

All subsequent blueprint files expand on the engines and concepts introduced here.

---

## 2. What PureTask Is (Final Form)

PureTask is a fully automated, reliability-driven service marketplace platform designed to efficiently coordinate real-world service work between clients and independent service providers (cleaners) using:

- A credit-based economic system
- An escrow-first payment architecture
- A rule-driven job lifecycle
- A smart matching engine
- A reliability and risk enforcement layer
- A worker- and automation-first operational model

PureTask is intentionally designed to scale from small, local operations to a multi-market, multi-vertical service platform without changing its core architecture.

---

## 3. Core Design Principles

### 3.1 Automation First
Any process that can be time-based, rule-based, or deterministic is automated via workers or orchestration (n8n / cron / queues). Humans intervene only where judgment is required.

### 3.2 Reliability Over Raw Growth
PureTask optimizes for completion rate, on-time performance, low cancellation/no-show rates, trust, and predictability. Growth that degrades reliability is intentionally constrained.

### 3.3 Credits as the Source of Truth
All economic activity flows through credits, not raw currency. Credits represent prepaid purchasing power, sit in escrow, are converted to cleaner earnings, and are adjusted via refunds, penalties, and disputes. This abstraction allows safer payouts, clear ledgering, simpler refunds, and reduced Stripe edge cases.

### 3.4 Explicit State Machines
Jobs, disputes, payouts, subscriptions, and reliability states all operate as explicit state machines, not implicit flags. State transitions are validated, logged, automatable, and auditable.

### 3.5 Risk Is Managed, Not Ignored
PureTask does not assume all users are trustworthy. Risk is measured, scored, categorized, and acted upon gradually (soft to hard restrictions). The platform adapts behavior based on observed risk.

---

## 4. System Actors

### 4.1 Client
A customer who books services, prepays using credits, communicates with cleaners, can dispute outcomes, and can subscribe to recurring services.

### 4.2 Cleaner
An independent service provider who sets availability and service areas, accepts or declines jobs, performs work, earns credits, receives payouts, and accumulates reliability and tier status.

### 4.3 Admin / Ops
Internal operators who monitor jobs and payouts, resolve disputes, adjust wallets, review risk flags, intervene in edge cases, and oversee platform health.

### 4.4 System / Automation Layer
Non-human actors including scheduled workers, event-driven processors, retry engines, notification dispatchers, and analytics snapshotters. These actors enforce platform rules continuously.

---

## 5. High-Level Marketplace Model

### 5.1 Economic Flow (Simplified)
Client purchases credits -> Credits held in escrow -> Job completed -> Credits converted to cleaner earnings -> Earnings batched into payouts -> Payouts sent via Stripe. Adjustments can occur at any stage via refunds, disputes, penalties, and risk holds.

### 5.2 Job-Centric Worldview
Everything revolves around jobs. Payments, messages, reliability, analytics, and subscriptions all derive from job events. Jobs are the atomic unit of the platform.

---

## 6. The 12 Core System Engines (Final Architecture)

PureTask is composed of 12 tightly coordinated engines, each responsible for a specific domain:

1) Booking Engine  
2) Credit + Payment Engine  
3) Payout Engine  
4) Pricing Engine  
5) Smart Match Engine  
6) Reliability & Tier Engine  
7) Dispute Engine  
8) Messaging & Notifications Engine  
9) Subscription Engine  
10) Analytics & KPI Engine  
11) Fraud & Risk Engine  
12) Admin & Ops Engine  

---

## 7. Automation & Worker Philosophy

PureTask relies heavily on background processing for time-based enforcement, lifecycle transitions, reconciliation, notifications, analytics, and safety checks. Workers are first-class system components; failure handling, retries, and idempotency are core design concerns.

---

## 8. Inter-Engine Relationships (High-Level)

- Booking Engine drives everything.
- Credit Engine gates economic actions.
- Payout Engine consumes completed job data.
- Reliability Engine influences Matching and Pricing.
- Risk Engine constrains Booking and Payments.
- Messaging Engine mirrors lifecycle events.
- Analytics Engine observes all engines.
- Admin Engine can override any engine.

---

## 9. Versioning Philosophy (Preview)

- V1: Core marketplace functionality with manual tolerance.  
- V2: Reliability, matching, disputes, ops confidence.  
- V3: Subscriptions and incentive economics.  
- V4: Risk intelligence and fraud mitigation.  
- V5: Platform generalization and scale.  

The final form described here is the superset from which all versions are derived.

---

## 10. Next Documents in This Blueprint

This overview is the root. Each of the following documents expands one engine or system area in full detail:

- ENGINE_BOOKING.md
- ENGINE_CREDITS_PAYMENTS.md
- ENGINE_PAYOUTS.md
- ENGINE_PRICING.md
- ENGINE_MATCHING.md
- ENGINE_RELIABILITY_TIERS.md
- ENGINE_DISPUTES.md
- ENGINE_MESSAGING_NOTIFICATIONS.md
- ENGINE_SUBSCRIPTIONS.md
- ENGINE_ANALYTICS_KPIS.md
- ENGINE_RISK_FRAUD.md
- ENGINE_ADMIN_OPS.md
- PURETASK_JOURNEYS.md
- PURETASK_MARKETPLACE_ECONOMICS.md
- PURETASK_AUTOMATION_WORKER_MODEL.md
- PURETASK_DATA_MODEL.md

---

## 11. Canonical Rule

If any future document, code path, or feature conflicts with this blueprint: this blueprint wins. All divergence must be intentional and documented.

---

End of document.

