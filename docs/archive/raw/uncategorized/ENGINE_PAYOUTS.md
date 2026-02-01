# ENGINE_PAYOUTS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Payout Engine

The Payout Engine converts internal cleaner earnings (credits) into real-world cash payouts. Goals: pay cleaners reliably, protect the platform from overpayment, handle disputes/refunds/chargebacks safely, reconcile internal ledgers with Stripe settlements, and support both scheduled and on-demand payouts. Correctness is prioritized over speed.

---

## 2. Design Philosophy

- Earnings are not payouts. Earnings are internal credits; payouts are external cash transfers. Earnings may exist without payouts; payouts may be delayed, batched, or reversed.  
- Batch-first strategy: payouts are primarily batched, scheduled, and reconciled. Instant payouts are optional and gated by reliability, risk, and thresholds.  
- Platform safety first: never pay out credits that are disputable, refunded, or flagged.

---

## 3. Core Concepts

- Cleaner earnings: credits released from escrow, stored in cleaner wallet, available for payout after holding rules.  
- Payout: transfer of funds via Stripe, backed by a snapshot of cleaner wallet balance, immutable once initiated.  
- Holding period: earnings may be held for dispute windows, risk checks, or new cleaner probation; rules are configurable.

---

## 4. Payout Types

- Weekly scheduled payouts (default): fixed cadence, includes eligible earnings, enforces minimum threshold, preferred for most cleaners.  
- Instant payouts (optional): cleaner-initiated, subject to tier/reliability thresholds and possible fees; may exclude recent earnings.

---

## 5. Payout Lifecycle

1) Eligibility calculation: determine available, held, restricted credits, and net payable amount.  
2) Payout creation: record created; ledger snapshot taken; Stripe transfer/payout initiated; status PENDING.  
3) Completion: Stripe confirms; status COMPLETED; ledger marked paid.  
4) Failure: Stripe failure; status FAILED; credits remain; retry scheduled or admin notified.

---

## 6. Reconciliation

- Internal reconciliation ensures sum of payouts does not exceed eligible earnings and no double payouts; all paid credits are marked.  
- Stripe reconciliation verifies IDs and amounts, handles failed or reversed payouts.

---

## 7. Clawbacks and Negative Balances

- Clawbacks occur for disputes resolved against cleaner after payout, chargebacks, or fraud.  
- Strategy: cleaner wallet may go negative; future earnings offset deficit; visibility may be restricted; admin intervention allowed.

---

## 8. Interaction With Other Engines

- Credit & Payment: supplies cleaner wallet balances; applies reversals before payout if possible.  
- Dispute: freezes earnings; triggers clawbacks if resolved post-payout.  
- Risk & Fraud: can block payouts, extend holding periods, or require manual approval.  
- Reliability & Tier: determines eligibility for instant payouts and influences holding durations.  
- Admin & Ops: can trigger manual payouts, pause or reverse payouts, override holding rules.  
- Analytics: tracks payout volume, failure rates, cleaner liquidity metrics.

---

## 9. Automation and Workers

Workers: payoutWeekly, payoutRetry, backupDaily. Responsibilities: scheduled payout runs, retry failed payouts, alert on anomalies, maintain audit trail. Workers must be idempotent, safe to rerun, and Stripe-aware.

---

## 10. Data Model (Conceptual)

Key entities: payouts, payout_items, payout_batches, payout_failures. Payouts reference immutable ledger snapshots.

---

## 11. Failure and Edge Case Handling

Must handle partial Stripe outages, currency conversion errors, bank account changes, duplicate webhook events, mid-cycle disputes, admin overrides during payout windows. The system must never lose money silently.

---

## 12. Canonical Rules

- No payout without confirmed earnings.  
- No payout of held or disputed credits.  
- No mutation of past payout records.  
- All payouts must reconcile with Stripe.  
- Negative balances are allowed but controlled.  

---

## 13. Versioning Guidance

- V1: Weekly payouts only, manual oversight acceptable.  
- V2: Better reconciliation, fewer manual interventions.  
- V3: Instant payouts and incentives.  
- V4+: Advanced risk-adjusted payout logic.  

---

End of document.

