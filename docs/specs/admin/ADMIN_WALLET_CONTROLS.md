# Admin Wallet Controls Spec
(Admin/Ops Spec)

## Scope
Admin tools for manual credits/debits and wallet freezes. All actions must be ledger-backed and auditable.

## Actions
- Manual credit (courtesy/compensation).
- Manual debit (correction/abuse).
- Freeze/unfreeze wallet (suspicious activity).

## Rules
- Every change writes a ledger entry (admin_credit/admin_debit) with admin_id, reason.
- No silent balance edits.
- Prevent driving wallet negative unless “debt” policy allows; flag if so.
- Log/audit all actions with timestamps and actor.

## UI/Flow (ops)
- Select user → view wallet/ledger → apply credit/debit with reason.
- Freeze toggle; shows warning that client cannot book while frozen.

