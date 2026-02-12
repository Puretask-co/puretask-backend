# ENGINE_ADMIN_OPS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Admin and Ops Engine

Provides controlled human oversight over PureTask. Goals: resolve edge cases automation cannot, enforce policy consistently, maintain financial and operational integrity, minimize support burden through tooling, and enable a small ops team to manage a large marketplace. Admins do not replace automation; they govern it.

---

## 2. Design Philosophy

- Automation by default, humans by exception: admin actions for edge cases, risk review, disputes, overrides; frequent tasks should be automated.  
- Safe power: all actions logged, require reason codes, high-risk actions need elevated permissions.  
- Observability over guesswork: admins see what happened, why, and what will happen next.

---

## 3. Core Admin Capabilities

- Job management: view full lifecycle; cancel or reassign; override state transitions; trigger re-matching; resolve stuck jobs; all overrides logged.  
- User management: view profiles, reliability/risk history; apply restrictions or suspensions; reset flags with justification.  
- Wallet and financial controls: view ledgers; issue manual credits/debits; freeze wallets; trigger refunds; pause payouts; all financial actions require reason codes.  
- Dispute resolution: review evidence; communicate via dispute threads; resolve or escalate; apply penalties or reversals.  
- Subscription oversight: view history; pause/cancel; correct billing issues; trigger job regeneration.

---

## 4. Admin Roles and Permissions

Example roles: Support Agent, Ops Manager, Finance Admin, Super Admin. Permissions are explicit, least-privilege, and auditable.

---

## 5. Audit Logging

All admin actions generate actor, action type, target entity, before/after snapshot, reason code, timestamp. Audit logs are immutable.

---

## 6. Dashboards and Views

Access to live job queues, stuck jobs, disputes queue, risk review queue, payout status, KPI summaries. Dashboards are read-only unless action is taken.

---

## 7. Interaction With Other Engines

- Booking: overrides states; triggers reassignment.  
- Credit & Payment: executes manual adjustments; freezes or releases funds.  
- Payout: pauses or retries payouts; handles payout failures.  
- Reliability & Tier: applies manual adjustments (rare); views history.  
- Risk & Fraud: reviews flags; applies or clears restrictions.  
- Messaging: injects system messages; communicates decisions.  
- Analytics: consumes dashboards; monitors trends.

---

## 8. Automation and Workers

Workers: stuckJobDetection, backupDaily, queueProcessor. They surface anomalies, ensure data integrity, and protect against silent failure.

---

## 9. Data Model (Conceptual)

Key entities: admin_actions, audit_logs, admin_notes, override_requests. All admin actions reference immutable records.

---

## 10. Failure and Edge Case Handling

Handle conflicting overrides, partial execution, admin error, concurrent actions. System must prevent silent corruption and prefer safety over speed.

---

## 11. Canonical Rules

- No admin action without a reason.  
- All overrides are logged.  
- Financial actions are auditable.  
- Automation remains primary; humans intervene sparingly.  

---

## 12. Versioning Guidance

- V1: Core admin controls.  
- V2: Better dashboards and queues.  
- V3: Permission granularity.  
- V4+: Ops automation and suggestions.  

---

End of document.

