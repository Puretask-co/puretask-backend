# Payout Failure UX Spec
(UI/UX Spec)

## Goals
Inform cleaners when payouts fail and provide a clear path to resolve (update bank/Connect info).

## Key Screens/Flows
- Notification of payout failure.
- View failure reason (if available).
- CTA to update payout details (Stripe Connect onboarding/verification).
- Resubmission or wait-for-next-cycle messaging.

## Rules & Behaviors
- Do not show “paid” if payout failed; show “needs action”.
- Once details updated, mark earnings to retry in next payout run (policy).
- Avoid duplicate retries without status change.

## Edge/Error UX
- Connect account restricted: show specific requirements from Stripe.
- If admin/manual resolution needed: provide support contact/flow.

