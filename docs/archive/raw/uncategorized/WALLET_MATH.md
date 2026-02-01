# Wallet Math Spec
(Micro/Unit Spec #4)

## Scope
Defines arithmetic and constraints for wallet_credits_balance to ensure it matches ledger-derived value.

## Formula (per user)
```
wallet_balance
  = Σ(wallet_purchase + subscription_credit + admin_credit)
  - Σ(escrow_hold)
  + Σ(escrow_release)
  + Σ(escrow_reversal)
  - Σ(refund + admin_debit)
  (± other defined types)
```

## Rules
- wallet_balance must never be negative (unless explicit debt flag policy).
- Precision: DECIMAL with fixed scale; round only at operation boundaries.
- All wallet changes must come from ledger inserts inside a transaction.

## Validation Query
Compute derived balance from ledger and compare to stored wallet_credits_balance; mismatch → alert/flag.

## Edge Cases
- Fractional credits (allow precision; avoid float).
- Concurrent updates: use row-level locks/atomic update to prevent race.
- No direct writes to wallet without ledger.

