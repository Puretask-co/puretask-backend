# Payment Failure UX Spec
(UI/UX Spec)

## Goals
Handle payment/auto-refill failures gracefully, guiding clients to fix issues and preventing bad states.

## Key Screens/Flows
- Failure notification on booking/auto-refill.
- Payment method update prompt.
- Retry payment flow.

## Rules & Behaviors
- If auto-refill/payment fails: booking does not proceed; no escrow hold.
- Present clear reason if available (card declined, expired).
- Offer to choose another card or add new.
- Preserve booking form state so client can retry quickly.

## Edge/Error UX
- Repeated failures: suggest contact support.
- Partial/in-flight UI state: ensure no duplicate bookings on retries.

