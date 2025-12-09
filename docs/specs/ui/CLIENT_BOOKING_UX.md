# Client Booking UX Spec
(UI/UX Spec)

## Goals
Make booking clear, prevent surprises, guide users through credits/auto-refill, and surface errors early.

## Key Screens/Flows
- Booking form: address, date/time window, duration, cleaning type/add-ons, notes.
- Price/credits summary: “You have X credits; this job costs Y credits.” If short: show auto-refill or buy-credits CTA.
- Confirmation screen: shows scheduled time, assigned/“finding cleaner” status.
- Error states: invalid address/time, insufficient credits (if auto-refill off), service area not supported.

## Rules & Behaviors
- Validate address and time before submit (lead time, service area).
- Deterministic price display from Pricing spec; show credits required and wallet balance.
- Auto-refill path: if enabled, present confirmation of top-up; otherwise prompt to buy credits.
- Idempotent booking submit: avoid duplicate jobs on retries.

## Edge/Error UX
- Payment failure (auto-refill): show clear message, retry option.
- Service not available: show alternative times/areas.
- Long duration/price exceeds cap: explain limit.

