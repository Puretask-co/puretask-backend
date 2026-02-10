# Dispute UX Spec
(UI/UX Spec)

## Goals
Provide a clear, fair flow for clients to raise disputes and for cleaners/admins to see status and outcomes.

## Key Screens/Flows
- Client: “Report an issue”/dispute entry from job detail; collect reason, photos/notes.
- Dispute status view: submitted, in review, resolved (client/cleaner wins, partial).
- Cleaner: view disputes on their jobs, see outcomes and potential impact.
- Admin (UX stub): review queue, evidence view.

## Rules & Behaviors
- Dispute window enforced (e.g., within 24h of completion/approval).
- Cannot dispute after resolution or beyond window; show policy.
- Show evidence (job photos, check-in) in the dispute detail.
- Outcomes reflected in balances (handled by backend), but UX must show result and next steps.

## Edge/Error UX
- Duplicate dispute submit: idempotent or merged.
- Missing required fields: block submit with inline errors.
- Resolution notification: clear messaging on refunds/adjustments and any cleaner impact.

