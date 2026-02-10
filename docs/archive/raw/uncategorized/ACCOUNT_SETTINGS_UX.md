# Account Settings UX Spec
(UI/UX Spec)

## Goals
Allow users to manage profile, payment methods, notification preferences, and (for cleaners) payout details.

## Key Screens/Flows
- Profile: name, phone, email.
- Payment methods (clients): add/remove card; set default.
- Notifications: email/SMS/push toggles.
- Cleaner payout setup: connect Stripe account, show status (needs verification, restricted, active).

## Rules & Behaviors
- Sensitive actions require auth/reauth (e.g., change email, payment method).
- Show Stripe Connect status and required actions for cleaners.
- Validate phone/email formats; confirm changes.

## Edge/Error UX
- Payment method add failure: clear error, retry.
- Connect account restricted: show actionable checklist.
- Preference save failure: show retry, keep user input.

