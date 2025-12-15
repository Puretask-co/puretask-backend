# ENGINE_CREDITS_PAYMENTS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Credit and Payment Engine

The Credit and Payment Engine defines how money moves through PureTask. It abstracts real currency into credits, holds value safely in escrow, converts credits into cleaner earnings, supports refunds, disputes, penalties, and adjustments, minimizes Stripe complexity and failure risk, and provides a clean, auditable ledger. All downstream economic systems (payouts, disputes, subscriptions, risk) depend on this engine.

---

## 2. Design Philosophy

### 2.1 Credits as the Canonical Currency
Clients purchase credits; credits are the only unit used for booking, refunds, penalties, and payouts. Stripe is treated as an external settlement layer. This ensures deterministic accounting, easier reversals, safer payouts, and reduced edge-case handling.

### 2.2 Escrow-First Architecture
Credits used for a job are authorized at booking, held in escrow until job completion, and released only after verification. No cleaner earnings exist before escrow release.

### 2.3 Ledger-Based Accounting
All credit movement is recorded as append-only ledger entries. Balances are derived, not stored as truth.

---

## 3. Core Concepts

### 3.1 Credits
- Integer or fixed-decimal units.  
- Purchased by clients.  
- Non-withdrawable and non-transferable between users.  
- Expirable only by policy (optional future).  

### 3.2 Wallets
- Client wallet stores purchased credits and feeds escrow.  
- Cleaner wallet stores earned credits and feeds payouts.  
- Platform wallet stores platform fees and receives penalties and forfeits.  

### 3.3 Escrow
Escrow is a logical hold, not a separate Stripe account. Escrow credits are deducted from client wallet, are not yet credited to cleaner wallet, and can be refunded or adjusted.

---

## 4. Credit Lifecycle (Job-Based)

- Purchase: client buys credits via Stripe; PaymentIntent created; credits issued on successful charge; ledger entry recorded.  
- Authorization (booking): required credits calculated; credits reserved into escrow; client wallet decreases; escrow ledger entry created.  
- Completion: escrow credits released; cleaner earnings credited; platform fee extracted; ledger entries recorded.  
- Refund/adjustment: credits refunded to client wallet, partially forfeited, redirected to platform wallet, or reversed from cleaner earnings (pre-payout). All actions are ledgered.

---

## 5. Ledger Model

### 5.1 Ledger Entry Structure
Each ledger entry includes id, wallet_id, credit_amount (positive or negative), reason_code, reference_type (job, dispute, payout, refund), reference_id, created_at. Ledger entries are immutable.

### 5.2 Balance Calculation
Wallet balance is computed as sum(ledger_entries.credit_amount). No balance field is authoritative.

---

## 6. Stripe Integration Model

Stripe is used for client payments (PaymentIntents), cleaner payouts (Transfers/Payouts), and refund execution. Stripe is not used for internal balances, escrow logic, or business rules. Every Stripe object is recorded once, checked before reprocessing, and tied to a unique internal reference. Webhook handlers must be idempotent.

---

## 7. Refund Logic

Refunds depend on job state, cancellation timing, dispute outcome, and risk flags. Refunds may be full, partial, credit-only, or cash-to-original-payment (rare). Refunds always produce ledger entries.

---

## 8. Interaction With Other Engines

- Booking: requests credit authorization; triggers escrow release or refund.  
- Payout: consumes cleaner wallet balances; converts credits to cash payouts.  
- Dispute: freezes escrow or earnings; issues reversals or reallocations.  
- Risk & Fraud: may require prepayment; may block refunds; may hold credits.  
- Subscription: pulls credits on a schedule; manages recurring escrow flows.  
- Analytics: tracks GMV, net revenue, refunds; derives financial KPIs.  

---

## 9. Automation and Workers

Workers: creditEconomyMaintenance, webhookRetry, payoutRetry, backupDaily. They handle reconciliation, cleanup, retry of failed Stripe events, and detection of imbalance anomalies.

---

## 10. Failure and Edge Case Handling

Must safely handle Stripe webhook delays, partial refunds, duplicate events, negative cleaner balances, dispute reversals post-completion, currency mismatches, platform fee overrides. The system must always converge to a correct ledger state.

---

## 11. Canonical Rules

- No direct balance mutation.  
- No earnings before escrow release.  
- No payout without sufficient credits.  
- All Stripe events are idempotent.  
- Ledger is append-only.  
- Every economic action has a reason_code.  

---

## 12. Versioning Guidance

- V1: Core credits, escrow, basic refunds.  
- V2: Dispute-driven adjustments, better reconciliation.  
- V3: Subscriptions and incentives.  
- V4+: Risk-based prepayment and holds.  

---

End of document.

