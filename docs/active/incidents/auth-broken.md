# Incident Playbook: Auth Broken (Users Can't Log In)

## Symptoms

- **Alert from:** Sentry spike on `/api/auth/login` returning 401/500, or customer reports flooding `#support`.
- **Visible signal:** `401` rate on `/api/auth/login` or `/api/auth/refresh` > 30% over 5 min, or every authenticated endpoint returning 401.
- **Where to confirm:**
  - Sentry filtered to `auth` tag.
  - Manually try logging in with a test account from `TEST_ACCOUNTS_REFERENCE.md`.

## Severity

- **P0** always. No login = no revenue, no usage.

## First 5 minutes

1. Acknowledge.
2. Try logging in yourself with a known-good test account. Capture exact error.
3. Check the last deploy: was a JWT-related change shipped? `git log --since='2 hours ago' --grep -iE 'auth|jwt|token'`.
4. Post: `INVESTIGATING auth outage`.

## Diagnosis steps

1. **Was JWT_SECRET rotated?**
   - If yes, every existing token is now invalid by design. That's expected. The user-visible symptom is "logged out", not "can't log in". Confirm new logins work.
   - If old tokens are being rejected AND new logins also fail, the secret is mismatched between environments. Check `JWT_SECRET` in Railway vs `.env` vs any staging.
2. **Did `JWT_EXPIRES_IN` change?**
   - `git diff HEAD~5 -- src/config/env.ts src/lib/auth.ts`
3. **Is the DB reachable?**
   - `GET /health` should return DB status. If DB is down, login fails because we can't look up users.
4. **Did password hash format change?**
   - bcryptjs upgrades occasionally change defaults. `git log -- src/lib/auth.ts` for recent edits.
5. **Is rate limiting catching everyone?**
   - If Redis just came up empty, the rate limiter could be erroring open or closed depending on `RATE_LIMIT_FAIL_OPEN`.

## Common root causes

| Cause | Fix |
|---|---|
| JWT_SECRET differs between Railway and code expectations | Re-paste the canonical secret into Railway, redeploy |
| DB connection failure (downstream of Neon outage) | See `database-down.md` |
| Recent code change broke `verifyToken()` | `git revert <bad commit>`, redeploy |
| Rate limiter Redis unreachable, failing closed | Set `RATE_LIMIT_FAIL_OPEN=true` temporarily, fix Redis, revert flag |
| Password hash incompatibility after bcryptjs upgrade | Roll back bcryptjs; plan a paced migration |

## Mitigation

- If a recent deploy is the cause, **roll back to the previous Railway deployment immediately** (Railway → Deployments → Promote previous). Investigation second.
- If JWT_SECRET drift, paste the canonical value back. All currently-logged-in users stay logged out until they re-auth — that's acceptable for a P0 fix.

## Resolution

- Pinpoint the offending change. Cut a hotfix branch off the last green deploy.
- Add a smoke test for `/api/auth/login` to `test:ci` if there isn't one.
- If JWT rotation was the trigger, follow `docs/active/AUDIT_CORRECTION_PLAYBOOK.md` § 0.1 for the canonical rotation steps next time.

## Post-incident

- Postmortem in `docs/active/incidents/postmortems/`.
- Add the failure mode you hit to the "Common root causes" table above.
