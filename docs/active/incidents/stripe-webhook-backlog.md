# Incident Playbook: Stripe Webhook Backlog

## Symptoms

- **Alert from:** Sentry error spike on `/api/webhooks/stripe`, OR `webhook_events` table showing `processed_at IS NULL` rows older than 5 minutes.
- **Visible signal:** Orders staying in `awaiting_payment` longer than usual; clients complaining their charge went through but the job didn't start.
- **Where to confirm:**
  - Stripe Dashboard → Developers → Webhooks → recent delivery attempts and 4xx/5xx rate.
  - DB query: `SELECT COUNT(*), MIN(received_at) FROM webhook_events WHERE processed_at IS NULL;`

## Severity

- **P0** if backlog > 100 events OR oldest unprocessed > 15 min — direct revenue impact.
- **P1** otherwise.

## First 5 minutes

1. Acknowledge.
2. Stripe Dashboard → Webhooks → check the failure rate on the endpoint URL we register.
3. Run the DB count query above. Capture the number; we'll compare after mitigation.
4. Post: `INVESTIGATING stripe webhook backlog (N events, oldest age M min)`.

## Diagnosis steps

1. **Are we receiving webhooks at all?**
   - `SELECT MAX(received_at) FROM webhook_events;` — if this is more than 2 min stale during business hours, Stripe can't reach us. Check Railway health and DNS.
2. **Are we receiving but failing to process?**
   - Tail Sentry for the last hour filtered by `webhook` tag.
   - `SELECT type, COUNT(*) FROM webhook_events WHERE processed_at IS NULL GROUP BY type;` — which event types are stuck?
3. **Is it one bad event blocking the queue?**
   - `SELECT id, type, error_message FROM webhook_events WHERE processed_at IS NULL ORDER BY received_at LIMIT 5;`
4. **Are we hitting Stripe rate limits when calling back?**
   - Sentry filter on `Stripe::RateLimitError`.

## Common root causes

| Cause | Fix |
|---|---|
| Worker `webhookRetry` not running | Restart on Railway; check the cron logs |
| Single poisoned event throwing | Mark it `processed_at = NOW(), error_message = 'manually dead-lettered'` after capturing a copy for the postmortem |
| Stripe signature verification failure (env var drift) | Compare `STRIPE_WEBHOOK_SECRET` in Railway vs Stripe Dashboard. Mismatch after a rotation is the usual cause |
| DB connection pool exhausted | Look at Neon dashboard for connection count; restart the worker to free pooled connections |

## Mitigation

- If a single event is poisoning the queue, mark it processed manually with a clear `error_message` so the rest of the queue drains. Capture the full event JSON in the postmortem before doing so.
- If signature mismatch: rotate `STRIPE_WEBHOOK_SECRET` in Stripe, paste into Railway, redeploy. Old events will replay from Stripe's retry queue.

## Resolution

- Code fix: add a retry-with-backoff and explicit dead-letter for unrecoverable events. See `src/workers/v1-core/webhookRetry.ts`.
- Confirm the queue has drained: `SELECT COUNT(*) FROM webhook_events WHERE processed_at IS NULL;` returns 0 (or a small steady-state).

## Post-incident

- Postmortem in `docs/active/incidents/postmortems/`.
- If this fires twice in a month, the retry strategy needs a redesign, not another runbook entry.
