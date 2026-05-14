# Incident Playbook: <Name>

> Replace `<placeholders>` and delete this blockquote when filling in a real playbook.

## Symptoms (how do I know this is happening?)

- **Alert from:** <Sentry / SendGrid bounce / Stripe webhook failure / customer report>
- **Visible signal:** <e.g., "5xx rate >5% on /api/jobs", "Stripe webhook age >5 min in `webhook_events`">
- **Where to confirm:** <Sentry issue link / health endpoint URL / DB query>

## Severity

- **P0** — revenue blocked or all users affected; respond in <15 min
- **P1** — partial impact or revenue at risk; respond within 1 hr
- **P2** — degraded but recoverable; respond next business day

This incident is typically **P0 / P1 / P2** because <reason>.

## First 5 minutes

1. Acknowledge the alert (Sentry / pager / Slack thumbs).
2. Open the dashboard at <link>.
3. Determine scope: single user, single region, or systemic?
4. Post initial status to `#incidents` (or self-DM if solo): `INVESTIGATING <symptom>`.

## Diagnosis steps

1. <command or query 1>
2. <command or query 2>
3. <command or query 3>

## Common root causes

| Cause | Fix |
|---|---|
| <cause A> | <fix A> |
| <cause B> | <fix B> |

## Mitigation (stop the bleeding)

- <feature flag / kill switch / scaling lever>

## Resolution (fix the underlying issue)

- <code change, deploy, rollback, or upstream ticket>

## Post-incident

- File a brief postmortem in `docs/active/incidents/postmortems/YYYY-MM-DD-<slug>.md`.
- Update this playbook if you learned something new.
- If this fired twice in the same month, escalate to a real fix rather than a runbook entry.
