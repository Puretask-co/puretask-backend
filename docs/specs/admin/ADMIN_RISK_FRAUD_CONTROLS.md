# Admin Risk & Fraud Controls Spec
(Admin/Ops Spec)

## Scope
Admin tools to flag/mitigate risky clients/cleaners, and to react to chargebacks/fraud patterns.

## Controls
- Mark user (client/cleaner) as high risk; optional block on new jobs or payouts.
- Pause payouts for a cleaner under investigation.
- Track repeated chargebacks or disputes.
- Require additional verification (ID, photos) for flagged users.

## Rules
- All flag changes logged with admin, reason, timestamp.
- Flags affect business logic: e.g., payout processor skips blocked cleaners; booking denied for blocked clients.
- Clear runbooks for unblocking after review.

