# Incident Playbook: Database Down

## Symptoms

- **Alert from:** `/health` returning 503, Sentry exceptions like `Connection terminated`, `ECONNREFUSED`, `ETIMEDOUT`, or `password authentication failed`.
- **Visible signal:** Every API endpoint that touches Postgres returns 500. The site appears "completely broken" rather than partially degraded.
- **Where to confirm:**
  - `curl https://<your-domain>/health` — body shows DB unreachable.
  - Neon dashboard → your project → recent activity / status.

## Severity

- **P0** always. No DB = no app.

## First 5 minutes

1. Acknowledge.
2. Open the Neon dashboard. Confirm: is this an outage on their side, or a connection-limit issue on ours?
3. Try a manual `psql "$DATABASE_URL"` from your machine. If you can connect, the app's connection string differs from yours.
4. Post: `INVESTIGATING DB unreachable, scope <Neon outage / our config / connection limit>`.

## Diagnosis steps

1. **Is Neon up?** https://neonstatus.com — if there's an active incident, mitigation is mostly "wait" plus a customer-facing status note.
2. **Connection limit hit?** Neon free-tier caps connections. Check the Neon dashboard "Active connections" graph.
3. **Did DATABASE_URL change?** `git log --since='1 day ago' -- src/lib/db.ts railway.toml`.
4. **Is it region-specific?** Try pinging from a different network.
5. **TLS / cert mismatch?** Error messages like `unable to verify the first certificate` mean a Neon cert rotation we haven't picked up.

## Common root causes

| Cause | Fix |
|---|---|
| Neon ongoing incident | Wait, post status to customers, capture timeline for postmortem |
| Connection pool exhausted | Restart workers and API to release sockets; raise pool size carefully |
| Stale `DATABASE_URL` after Neon project rotation | Update Railway env, redeploy |
| Migration locked a critical table | See `pg_locks` query in `docs/active/MIGRATIONS.md` |
| Application throwing on first query because of a schema drift | See `pg_locks` + check `docs/active/MIGRATIONS.md` rollback section |

## Mitigation

- **Status page or banner:** post an "investigating database connectivity" note if customer-visible.
- **If pool exhaustion:** restart Railway services to release sockets. Avoid scaling out, which makes pool exhaustion worse.
- **If Neon outage:** there is no mitigation. Wait, communicate.

## Resolution

- Once DB is reachable, check `pg_stat_activity` for hung queries: `SELECT pid, state, wait_event, query_start, LEFT(query, 80) FROM pg_stat_activity WHERE state <> 'idle';`.
- If a long-running migration locked things, see `MIGRATIONS.md` rollback procedure.

## Post-incident

- Postmortem in `docs/active/incidents/postmortems/`.
- If this was a connection-limit issue, file a follow-up to either upgrade Neon plan or audit code for `pool.connect()` calls that don't release.
