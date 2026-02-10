# PURETASK_AUTOMATION_WORKER_MODEL

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of This Document

Defines how PureTask operates without humans: automation philosophy, worker architecture, scheduling, idempotency, failure recovery, and division between code-based workers and orchestration tools like n8n. Automation is a first-class system component.

---

## 2. Automation Philosophy

- Automation over intervention: any time-based, rule-based, deterministic task must be automated; humans intervene only for judgment, high risk, or ambiguity.  
- Workers enforce reality: enforce time windows, correct missed events, detect stuck states, maintain integrity. Workers are not optional.  
- Eventual consistency with guarantees: tolerate delayed events but guarantee convergence, no silent failure, no permanent corruption.

---

## 3. Worker Categories

- Time-based workers: scheduled (auto-cancel, expire confirmations, weekly payouts, daily KPI snapshots).  
- Event-recovery workers: repair missed/failed events (retry webhooks, retry notifications, detect stuck jobs).  
- Maintenance workers: long-term health (backups, ledger reconciliation, credit economy maintenance).  
- Analytics and monitoring workers: observational (snapshots, summaries, alerts).

---

## 4. Canonical Worker List (Final Form)

- Booking and lifecycle: autoCancelJobs, autoExpireAwaitingApproval, stuckJobDetection.  
- Payments and economics: creditEconomyMaintenance, payoutWeekly, payoutRetry, webhookRetry.  
- Messaging: retryFailedNotifications.  
- Reliability and incentives: reliabilityRecalc, cleaningScores, goalChecker, expireBoosts.  
- Subscriptions: subscriptionJobs.  
- Analytics and ops: kpiDailySnapshot, weeklySummary, backupDaily.  
- Queue and orchestration: queueProcessor.  

---

## 5. Scheduling Model

Scheduled via cron, queue triggers, or n8n flows. Schedules are explicit, documented, and configurable per environment.

---

## 6. Idempotency Rules

Every worker must be idempotent: safe to run multiple times or after partial failure; no double-charging, double-payouts, or duplicate notifications. Enforced via unique references, state checks, and ledger snapshots.

---

## 7. Failure Detection and Recovery

Failure types: worker crash, partial execution, external service failure, data inconsistency. Recovery: retry with backoff, escalate to admin after repeats, log and alert, never silently ignore.

---

## 8. n8n vs Code-Based Workers

- Code-based (default): core business logic, state mutations, ledger changes, reliability scoring, payouts. Benefits: typing, version control, testing.  
- n8n workflows: orchestration, notifications, external integrations, multi-step flows with retries, low-risk side effects. Benefits: fast iteration, visual debugging, ops ownership.  
- Canonical rule: anything mutating money, reliability, or job state lives in code; n8n orchestrates, not decides.

---

## 9. Observability and Logging

Each worker logs start/end, items processed, failures, retries. Logs are structured, searchable, and correlated by job/payout/dispute IDs.

---

## 10. Interaction With Engines

Workers interact with Booking (state enforcement), Credit & Payment (reconciliation), Payout (execution/retry), Reliability (recalculation), Analytics (snapshots), Risk (safety checks). Workers never bypass engine rules.

---

## 11. Failure and Edge Case Handling

Handle partial data, missing references, race conditions, out-of-order events. Workers must fail safely and visibly.

---

## 12. Canonical Rules

- No silent failure.  
- Idempotency everywhere.  
- Money mutations require strong guards.  
- Automation is observable.  
- Humans are the last resort.  

---

## 13. Versioning Guidance

- V1: Core lifecycle and payout workers.  
- V2: Reliability and subscription automation.  
- V3: Incentive and optimization workers.  
- V4+: Predictive and adaptive automation.  

---

End of document.

