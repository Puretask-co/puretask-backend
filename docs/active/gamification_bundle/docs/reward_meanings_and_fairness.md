# Step 9 — What rewards mean in practice (implementation rules)

## "Priority visibility" / "Better visibility"
Implemented as a multiplier on the ranking score used to order cleaners in the customer's list.

Fairness constraints:
- only among eligible cleaners (distance/availability/service match)
- capped per region (default cap 1.35)
- never a guarantee; customers can always scroll/select

## "Early exposure"
For X minutes after a request is created, the cleaner receives a small bump inside ranked ordering.
Default bump multiplier: 1.08 (config knob).
Cap early exposure minutes: 30 (governor cap).

## Add-on Spotlight
Multiplier applies only when job includes add-ons.

## Maintenance pause
If a cleaner is paused:
- levels never go down
- effects become neutral (visibility=1, early=0, etc.)
- rewards resume once pause clears

## Debug visibility
GET /cleaners/:id/rewards/effects?region_id=...
