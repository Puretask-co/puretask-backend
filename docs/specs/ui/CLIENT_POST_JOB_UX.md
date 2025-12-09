# Client Post-Job UX Spec
(UI/UX Spec)

## Goals
Let clients review the job, approve or dispute, and leave feedback with clear evidence (photos, timestamps).

## Key Screens/Flows
- Job detail: before/after photos, check-in time/location, duration, notes.
- Approve flow: confirm acceptance; shows credits already held in escrow.
- Dispute/deny flow: collect reason, optional photos/notes; starts dispute path.
- Rating/review: after approval (optional), with low-score guardrails.

## Rules & Behaviors
- Approval allowed only if job is completed; blocks if disputed or already approved.
- Dispute window (configurable): show remaining time to dispute.
- Cannot dispute after resolution/settlement beyond window.

## Edge/Error UX
- Missing photos or check-in: show that to client; if absent, encourage dispute or support.
- Double-approval attempts: idempotent success without duplicate effects.
- Late dispute beyond window: show support contact or policy notice.

