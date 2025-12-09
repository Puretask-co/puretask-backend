# Assignment Engine Spec (Marketplace-Safe)
(Infrastructure/Marketplace Spec)

## Goals
Offer jobs to cleaners without supervising how they work; preserve independence. Use score/tier-based ranking and long-wave visibility (e.g., 24h) instead of tight dispatch control.

## Principles
- PureTask facilitates visibility; cleaners choose to accept. No control of how/when work is performed beyond time window constraints inherent to the booking.
- Cleaners are independent contractors; we do not direct methods or means.
- Visibility is based on reliability/tier/score and proximity; no micromanagement.
- Waves are long (e.g., 24h) to avoid “on-demand” control appearance.

## Input Signals
- Job location & time window.
- Cleaner availability (opt-in schedule).
- Reliability score, tier.
- Distance radius (configurable).
- Optional: client repeat preference, language/skills.

## Visibility Model (Waves)
- Wave 1: top reliability/tier cleaners within radius see job for a long window (e.g., 24h or until accepted).
- Wave 2+: expand radius or lower tier threshold if unfilled after wave duration.
- Cleaner sees: job summary (time window, location zone, credits/pay), not dictated instructions.

## Acceptance Flow
- Cleaner opts in by accepting; status transitions per Job Status Machine.
- If no acceptance after wave N, job can be canceled or escalated to manual ops; no forced assignment.

## Matching Output
- Ranked candidate set (per wave) based on score/tier + distance + availability.
- No auto-assign unless explicitly enabled by policy; default is voluntary accept.

## Policy Controls
- Wave duration (default long: 24h).
- Radius expansion per wave.
- Minimum reliability/tier per wave.
- Max concurrent offers per cleaner (to avoid spam).

## Data/Logging
- Record which cleaners saw the offer and when.
- Record accepts/declines/no-response for reliability insights (optional, careful to avoid treating declines as control).

## Edge Cases
- Last-minute bookings: waves can be shorter but still maintain voluntary acceptance.
- High-risk clients/cleaners: can be filtered out based on risk flags.
- If no cleaners: inform client, allow reschedule or cancel with refund.

