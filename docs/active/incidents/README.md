# Incident Playbooks

When something breaks, find the right playbook here. Each is one page, designed for 2AM-clarity reading: symptoms first, mitigation second, root cause third.

## Active playbooks

- [Stripe webhook backlog](./stripe-webhook-backlog.md) — orders not being marked paid; retry queue filling up.
- [Auth broken](./auth-broken.md) — users can't log in; every authenticated endpoint returns 401.
- [Database down](./database-down.md) — Postgres unreachable; everything returns 500.
- [Worker not running](./worker-not-running.md) — payouts, webhooks, or goals stop being processed.
- [Notification delivery failure](./notification-delivery-failure.md) — email/SMS/push not landing with customers.

## Not yet written (placeholders — claim and fill before you need them)

- `payment-spike.md` — high Stripe error rate; fraud, outage, or our bug.
- `cleaner-cant-receive-payout.md` — Stripe Connect issue, individual impact.
- `n8n-workflow-failure.md` — external workflow integration broke.

## How to write a new playbook

Copy `_TEMPLATE.md` and fill it in. Keep it under one page; if you need more, you're describing architecture, not an incident response. Architecture goes in `docs/active/ARCHITECTURE.md`.

## How to use these during an incident

1. Find the playbook that matches your symptoms (search by alert text or table name).
2. Do the "First 5 minutes" steps — they get you to a status post and a working hypothesis.
3. Do the "Mitigation" steps before the "Resolution" steps. Stop the bleeding first.
4. After resolution, file a postmortem in `postmortems/YYYY-MM-DD-<slug>.md`.

## How to keep these alive

- Update the "Common root causes" table whenever you hit a new failure mode.
- If a playbook fires twice in a month, the listed mitigations are not the real fix — escalate to architecture work.
- Quarterly review: read one playbook cold, simulate the symptoms, confirm the steps still work.
