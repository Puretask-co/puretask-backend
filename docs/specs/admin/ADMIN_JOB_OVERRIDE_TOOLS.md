# Admin Job Override Tools Spec
(Admin/Ops Spec)

## Scope
Admin abilities to intervene on jobs when necessary (extreme cases), while minimizing control over cleaner methods.

## Actions
- Reassign job (per Job Reassignment spec).
- Cancel job (policy-based refunds).
- Adjust scheduled time (with client/cleaner consent).
- Mark no-show (after verification).
- Force-complete/approve only with explicit evidence and audit (rare).

## Rules
- Every override is audited (admin, reason, evidence).
- Financial effects follow Escrow/Refund/Earnings specs (no ad-hoc wallet edits).
- Avoid suspensions unless extreme behavior; rely on risk flags and visibility filters instead.

## UI/Flow
- Job detail with current state, escrow info, photos/check-in.
- Buttons for: reassign, cancel, mark no-show, approve/complete (with warning), adjust time.
- Confirmation modal requiring reason.

