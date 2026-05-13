# On-Call Procedures

This is the on-call doc for PureTask Backend. If something breaks in production, this is the first stop.

## Current rotation

- **Primary:** PURETASK (reeperzx7@gmail.com)
- **Secondary:** None (solo)
- **Coverage hours:** 24/7 by default, since the service is consumer-facing and Stripe webhooks arrive at any time.

When the team grows, replace this section with a weekly rotation table and link to the calendar.

## What pages me

These conditions should trigger an alert that reaches the primary's phone/email:

- Sentry: any P0-tagged error rule
- Health check failure on `/health` for >2 consecutive probes
- Customer-reported P0 (login broken, payment broken)
- Stripe webhook delivery failure rate >10% over 5 min (Stripe Dashboard email alerts)
- Neon `Active connections` near the plan cap

Configure the actual alert rules in: Sentry → Alerts, Railway → Notifications, Stripe → Developers → Webhooks → endpoint settings.

## What I check first (in order)

1. **Sentry dashboard:** https://puretask.sentry.io/ (filter to last 1h, sort by event count).
2. **Railway services:** https://railway.app/dashboard — confirm all services green.
3. **Health endpoint:** `curl https://<prod-domain>/health` — verifies DB + Redis + Stripe reachable from inside the app.
4. **Neon status + project dashboard:** https://console.neon.tech — connection count, recent activity.
5. **Stripe webhook deliveries:** https://dashboard.stripe.com/webhooks — last 100 attempts, look for 4xx/5xx clusters.

If still unclear after those four, go to the relevant playbook in `docs/active/incidents/`.

## Escalation to providers

| Provider | Where to go |
|---|---|
| Stripe | https://support.stripe.com (auth issues), dashboard → Help (in-product) |
| Railway | https://status.railway.app + their Discord (live during outages) |
| Neon DB | https://console.neon.tech → support, https://neonstatus.com for outages |
| SendGrid | https://support.sendgrid.com |
| Twilio | https://support.twilio.com |
| Sentry | https://sentry.io/support/ |

## When I'm off

If on vacation or otherwise unreachable, update this section beforehand:

- **Dates:** <update each time>
- **Backup contact:** <name + phone + relationship; "none" if truly solo>
- **Email auto-responder:** point to the backup contact OR set expectations that response will be delayed.
- **Stripe / Railway emergency contacts:** ensure billing email is monitored — service suspension for a missed bill counts as an outage.

## Postmortem norm

Every P0 incident gets a postmortem within 48h, even if it's three sentences. File in `docs/active/incidents/postmortems/YYYY-MM-DD-<slug>.md`. The format is:

1. What happened (2–4 sentences)
2. Why it happened (root cause, not the proximate trigger)
3. What we did about it (mitigation + fix)
4. What we'll change so it doesn't recur

Brevity is the point. A postmortem nobody reads is worse than one nobody wrote.
