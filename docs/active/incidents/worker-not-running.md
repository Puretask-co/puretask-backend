# Incident Playbook: Worker Not Running

## Symptoms

- **Alert from:** Customer report ("my payout didn't arrive"), or Sentry silence (no events from a worker for >24h).
- **Visible signal:** Backlog growing in tables a worker drains:
  - `notification_outbox` for retry-notifications
  - `webhook_events` for webhook-retry
  - `payout_runs` for payout-weekly
  - `goals` past `due_at` with no `evaluated_at` for goal-checker
- **Where to confirm:** Railway logs for the specific worker; cron schedule in `railway.toml` or `nixpacks.toml`.

## Severity

- **P0** if payout-weekly or webhook-retry is stuck — direct revenue/reliability impact.
- **P1** otherwise.

## First 5 minutes

1. Identify which worker. Common ones: `worker:payout-weekly`, `worker:webhook-retry`, `worker:credit-economy`, `worker:goal-checker`, `worker:durable-jobs`.
2. Railway → Services → check the worker service is in `RUNNING` state.
3. Last-run check via DB:
   - `SELECT MAX(run_at) FROM <worker's relevant table>;`
4. Post: `INVESTIGATING worker <name> stuck since <last-run timestamp>`.

## Diagnosis steps

1. **Is the service alive?** Railway dashboard shows green/red state.
2. **Is it crash-looping?** Logs show repeated startup + exit cycles.
3. **Is it just slow?** Check the run timestamp — if it ran 10 min ago and the cron interval is 60 min, it's fine, not stuck.
4. **Did the cron change?** `git log -- railway.toml nixpacks.toml package.json | grep -A2 worker:`
5. **Is the worker holding a lock and waiting?** Many workers use `pg_advisory_lock`; check `pg_locks` for the relevant key.

## Common root causes

| Cause | Fix |
|---|---|
| Service crashed on startup (env var missing) | Check the latest log lines for the missing key; set it in Railway |
| Crash-loop from a poisoned row | Quarantine the row (e.g. mark `attempts=99` to skip) and redeploy |
| Stale advisory lock from a previous crashed run | `SELECT pg_advisory_unlock_all();` via `worker:lock-recovery` |
| Cron schedule removed by mistake | `git revert` the bad change, redeploy |
| Out of memory; Railway killed the container | Bump memory in Railway; investigate the leak |

## Mitigation

- **Manual run:** all workers have an npm script (`npm run worker:<name>`). Trigger one manually to drain the backlog while you fix the underlying issue.
- **Lock cleanup:** `npm run worker:lock-recovery` releases stale advisory locks.

## Resolution

- Fix the crash cause. Add a Sentry breadcrumb at the worker's entry point if it doesn't already log a "starting" line — silence shouldn't look identical to "ran fine."

## Post-incident

- Postmortem in `docs/active/incidents/postmortems/`.
- Add a heartbeat alert: if `MAX(run_at)` on the worker's table is older than 2× the cron interval, page.
