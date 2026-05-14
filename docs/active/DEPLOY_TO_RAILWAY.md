# Deploying to Railway

Production runs on Railway, build via Nixpacks (`nixpacks.toml` pins Node 20), start via `npm start`. Auto-deploy is wired to pushes to `main`.

## Pre-deploy checklist

Before merging anything to `main`:

- [ ] `npm run lint` exits 0 (the `--max-warnings 1629` ratchet catches new warnings)
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:ci` passes (deterministic slice; required by CI)
- [ ] `npm run test:ci:coverage` passes the threshold floor (stmts 93, branch 89, funcs 96, lines 93)
- [ ] If new files were added to `DB/migrations/`, the migration is reviewed against `docs/active/MIGRATIONS.md`
- [ ] If new env vars are referenced in code (`process.env.X`): add `X` to Railway **before** merging, not after

## Normal deploy (auto via git push)

1. `git push origin main` (after PR merge).
2. Railway detects the push and starts a build using `nixpacks.toml` (`npm ci && npm run build`).
3. Watch the build at: railway.app → your project → Deployments → latest.
4. Wait for "Deployment successful" + healthcheck pass (`/health`, 100s timeout per `railway.toml`).
5. Verify: `curl https://<prod-domain>/health` returns 200 with all subsystems green.

If the healthcheck fails, Railway's `restartPolicyType = "ON_FAILURE"` will retry up to 10 times. Three failed retries usually means rollback.

## Hotfix deploy

1. Branch from latest `main`: `git checkout -b hotfix/<description>`.
2. Make the minimal change. No drive-by cleanups.
3. Run the pre-deploy checklist locally (lint + typecheck + test:ci minimum).
4. Open a PR; squash-merge to `main` after CI passes.
5. Auto-deploy fires as for a normal deploy.

If truly urgent (P0 customer-blocking): push directly to `main` after running the checklist locally. Open a retroactive PR for the audit trail.

## Rollback

When a deploy breaks prod:

1. Railway dashboard → Deployments.
2. Find the last "Deployment successful" build with a green health badge.
3. Click the three-dot menu → **Promote** (or **Redeploy**, depending on plan).
4. Wait for the rollback to become active (typically 60–120s).
5. Verify `/health` returns 200.
6. If the rolled-back version also breaks, the issue is data (DB or env), not code — go to `incidents/database-down.md` or check env-var drift.

Rolling back **does not** revert DB migrations. If the bad deploy ran a migration that's incompatible with the previous code, you need a forward-fix migration. See `docs/active/MIGRATIONS.md`.

## Env var changes

1. Railway dashboard → Variables.
2. Add or edit the value.
3. Railway triggers an automatic redeploy. **Confirm the redeploy actually happened** — sometimes the trigger is debounced if multiple changes happen in rapid succession.
4. Verify the new value is in effect: query an endpoint that exposes config (admin route) or grep the deploy logs for the variable name.
5. If you rotated a secret: see `AUDIT_CORRECTION_PLAYBOOK.md` § 0.1 for the canonical rotation steps so old tokens are invalidated cleanly.

## What to do if deploy fails

1. **Build error.** Open the Railway build log; usually TypeScript or Nixpacks. Fix in code, push again. Don't disable strict checks to "unblock" — the failure is real.
2. **Migration failure.** Check the Neon dashboard for the locking session: `SELECT pid, state, wait_event, LEFT(query, 80) FROM pg_stat_activity WHERE state <> 'idle';`. If a migration is hung, see `MIGRATIONS.md` rollback section.
3. **Env var missing.** Logs will mention the missing key by name. Add it in Railway Variables and let the redeploy fire.
4. **Healthcheck failing but build succeeded.** App started but `/health` is sad. Check `incidents/database-down.md` or `incidents/auth-broken.md` first.
5. **If you cannot fix in 30 minutes: rollback.** The fix can wait; the outage cannot.

## Deploy hygiene

- Tag releases for non-trivial deploys: `git tag -a v1.x.y -m "<one-line>" && git push --tags`.
- Note the deploy in `#deploys` (when you have a Slack), or in a `docs/active/DEPLOY_LOG.md` for solo periods.
- After any deploy that touched payments, auth, or migrations: actively monitor Sentry for 30 min.
