# Refund & Chargeback SOP (Manual Mode)

## Purpose
While automation is disabled, all Stripe refunds and chargebacks must be handled manually to avoid unintended financial changes. This SOP outlines the steps for ops/admins.

## Scope
- Stripe `charge.refunded`
- Stripe `charge.dispute.created/closed`
- Job-related or purchase/subscription refunds triggered by Stripe or support.

## Current System Behavior
- Refund processor: logs `refund_processor_manual_required`, does not change wallet/ledger.
- Chargeback processor: logs `chargeback_processor_manual_required`, does not freeze/clawback.
- Stripe webhook events are still received and logged; no financial side effects occur automatically.

## Manual Refund Procedure (purchase/subscription or job)
1) Identify context:
   - PaymentIntent/charge ID
   - Client (customer) and optional job_id
   - Amount refunded, currency
2) Decide refund path:
   - Purchase/subscription: return credits to client wallet.
   - Job-related: follow dispute/cancel policy; if refunding client, also evaluate cleaner earnings/clawback.
3) Execute manually:
   - Add ledger entry for client (+credits) with reason `refund`.
   - If job was approved and cleaner paid, create a negative adjustment/clawback per policy (once a dedicated reason exists).
4) Record:
   - Admin, reason, paymentIntent/charge IDs, job_id, client_id, amount/credits.
5) Verify:
   - Run integrity checks (wallet vs ledger, earnings vs payouts).

## Manual Chargeback Procedure
1) On `charge.dispute.created`:
   - Flag the related job/payout manually (e.g., set a note/flag in admin UI).
   - Avoid paying out related earnings until resolved.
2) On `charge.dispute.closed`:
   - If lost: apply client-side refund as above; add negative adjustment/clawback for cleaner if they were paid.
   - If won: clear flags; no financial changes.
3) Record and verify with integrity checks.

## When Ready to Re-Enable Automation
- Define policies:
  - How to map plan→credits for subscriptions.
  - Refund rules for job vs. purchase vs. subscription.
  - Chargeback handling: freeze, clawback, thresholds.
  - Ledger reasons for clawbacks (add a dedicated type).
- Implement and test:
  - Re-enable refundProcessor and chargebackProcessor with idempotency.
  - Add object-level idempotency guards for invoice/charge/dispute/payout.
  - Run scenario tests and integrity SQL.

