# ENGINE_DISPUTES

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Dispute Engine

The Dispute Engine governs how disagreements about job outcomes are handled. Goals: resolve conflicts fairly and consistently, protect clients from poor outcomes, protect cleaners from abuse, preserve economic correctness, minimize manual ops load, and prevent cascading failures across payments and payouts. Disputes are structured workflows, not ad-hoc tickets.

---

## 2. Design Philosophy

- Job-centric disputes: every dispute ties to a single job; no global disputes.  
- Economic safety first: disputes may pause escrow release, reverse earnings, or delay payouts, but must never corrupt the ledger.  
- Gradual escalation: most disputes should resolve automatically or semi-automatically; human intervention reserved for high-value, repeat abuse, or fraud cases.

---

## 3. When Disputes Can Be Created

Initiated when a job is COMPLETED, NO_SHOW, or certain CANCELLED reasons. Must be filed within a defined window after completion or cancellation.

---

## 4. Dispute Types

Examples: job not completed, poor quality, cleaner no-show, property damage, incorrect charges, unauthorized add-ons. Each type has allowed evidence, default resolution paths, and maximum refund limits.

---

## 5. Dispute Lifecycle States

States: CREATED, EVIDENCE_COLLECTION, UNDER_REVIEW, RESOLVED_CLIENT, RESOLVED_CLEANER, ESCALATED, CLOSED.

- CREATED: dispute submitted; initial metadata recorded; economic effects paused.  
- EVIDENCE_COLLECTION: client uploads evidence; cleaner may respond; time-bound.  
- UNDER_REVIEW: system or admin evaluates; automated rules may apply.  
- RESOLVED_CLIENT: outcome favors client; refunds or credits issued; cleaner penalties applied if needed.  
- RESOLVED_CLEANER: outcome favors cleaner; escrow released if held; dispute closed without penalty.  
- ESCALATED: manual admin review required; higher scrutiny.  
- CLOSED: final state; all economic and reliability effects applied.  

---

## 6. Economic Effects

- Escrow handling: fully released, partially released, or fully refunded; decisions ledgered.  
- Cleaner earnings: pre-payout adjusted directly; post-payout uses clawback logic.  
- Platform fees: may be reduced or forfeited; platform may absorb cost in some cases.

---

## 7. Reliability and Tier Impact

Dispute outcomes feed into reliability score adjustments, tier demotions for repeated losses, and risk flags. Severity depends on type, outcome, and frequency.

---

## 8. Interaction With Other Engines

- Booking: supplies job context; prevents state changes during disputes.  
- Credit & Payment: executes refunds and reallocations; ensures ledger correctness.  
- Payout: freezes or reverses payouts; applies clawbacks.  
- Messaging: manages dispute communications; notifies parties.  
- Risk & Fraud: monitors abuse; escalates suspicious behavior.  
- Admin & Ops: provides review tools; applies overrides; logs decisions.

---

## 9. Automation and Workers

Workers: queueProcessor, retryFailedNotifications. They enforce time limits, advance states automatically, trigger reminders, and detect stuck disputes.

---

## 10. Evidence Handling

Evidence types include photos, messages, check-in/out timestamps, cleaner notes. Evidence storage is immutable, auditable, and linked to dispute records.

---

## 11. Failure and Edge Case Handling

Handle late submissions, missing evidence, conflicting accounts, partial fault cases, repeat offenders. System must always resolve to CLOSED.

---

## 12. Canonical Rules

- Disputes are time-bound.  
- Economic actions are ledgered.  
- Outcomes affect reliability.  
- Admin overrides are logged.  
- No silent resolution.  

---

## 13. Versioning Guidance

- V1: Basic disputes with manual resolution.  
- V2: Automated flows and rules.  
- V3: Abuse detection and smarter escalation.  
- V4+: Advanced fraud integration.  

---

End of document.

