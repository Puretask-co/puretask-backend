# Incident Playbook: Notification Delivery Failure

## Symptoms

- **Alert from:** Sentry on SendGrid/Twilio API errors, or `notification_outbox` rows with `status='failed'` accumulating.
- **Visible signal:** Customers stop receiving job-status emails or SMS, or cleaners stop receiving job-offer pushes.
- **Where to confirm:**
  - SendGrid dashboard → Activity → recent sends + bounce rate.
  - Twilio Console → Monitor → Errors.
  - `SELECT channel, status, COUNT(*) FROM notification_outbox WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY channel, status;`

## Severity

- **P1** if a whole channel is down (e.g. all SMS failing).
- **P2** if a fraction of sends fail (bounces, single user).

## First 5 minutes

1. Identify the failing channel (email / SMS / push).
2. Check provider status page (SendGrid, Twilio, OneSignal).
3. Run the outbox count query above; capture the failure rate.
4. Post: `INVESTIGATING <channel> delivery failures, <rate>% over <window>`.

## Diagnosis steps

1. **Provider auth:** rotated keys recently? `SENDGRID_API_KEY` / `TWILIO_AUTH_TOKEN` / `ONESIGNAL_API_KEY` in Railway vs provider dashboard.
2. **Provider quotas:** SendGrid free-tier daily cap, Twilio number throughput limits.
3. **Provider outage:** check their status pages.
4. **Our code:** `git log --since='1 day ago' -- src/services/email* src/services/sms* src/services/push*`.
5. **Bad recipient data:** if only specific users fail, look for malformed phone numbers or email addresses in those rows.

## Common root causes

| Cause | Fix |
|---|---|
| Provider key revoked or expired | Rotate, update Railway, redeploy |
| Hit daily/monthly quota | Upgrade plan, OR throttle non-essential notifications |
| Provider outage | Wait; queue in `notification_outbox` will drain on retry |
| Bad data (missing `+` on phone, malformed email) | Patch validation in `src/services/<channel>Service.ts` |
| Webhook for delivery status not being recorded | Check `src/routes/webhooks` for the corresponding provider |

## Mitigation

- The `notification_outbox` retry worker will re-attempt failed sends automatically. If failures are temporary, no manual action needed.
- If a specific recipient is blocking the queue (e.g. SendGrid is bouncing one address repeatedly), mark that row `status='abandoned'` with a `reason`.

## Resolution

- Fix the root cause. If it was a provider outage, file a follow-up to confirm our retry logic actually drained the backlog after they recovered.
- If validation caught it late, tighten input validation at the create-notification step in `src/services/notificationService.ts`.

## Post-incident

- Postmortem in `docs/active/incidents/postmortems/`.
- Add an alert: bounce rate >2% sustained over 30 min should page.
