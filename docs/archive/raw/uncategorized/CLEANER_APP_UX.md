# Cleaner App UX Spec
(UI/UX Spec)

## Goals
Give cleaners a clear, reliable workflow to accept, navigate, check-in, capture photos, complete jobs, and view payouts.

## Key Screens/Flows
- Job list: upcoming/assigned, with start times and locations.
- Job detail: address, client notes, required photos, estimated duration, pay (credits).
- Accept/decline (if applicable).
- Check-in flow: GPS permission prompt, status change to in_progress.
- Photo capture: before/during/after with minimum counts indicated.
- Complete job: only enabled after photo/check-in requirements met.
- Earnings/payout view: recent jobs, statuses, next payout estimate.

## Rules & Behaviors
- Check-in requires GPS on and within radius.
- Completion disabled until required after-photos exist.
- Late check-in messaging; show grace window if supported.
- Offline/poor network: queue uploads and check-in attempts; retry visibly.

## Edge/Error UX
- GPS denied: prompt to enable; block check-in.
- Upload failure: retry with clear status.
- Double-complete: idempotent; no duplicate events.

