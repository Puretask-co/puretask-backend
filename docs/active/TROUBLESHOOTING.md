# Troubleshooting

**What it is:** Known issues and fixes (startup, DB, webhooks, performance).  
**What it does:** Reduces time-to-fix for common problems.  
**How we use it:** Check when something fails; add new issues as we find them.

---

## Common Issues and Solutions

## Server Won't Start

### Symptoms
- Application fails to start
- Port already in use error
- Environment variable errors

### Solutions

**Port Already in Use**:
```bash
# Find process using port
lsof -i :4000
# Or on Windows
netstat -ano | findstr :4000

# Kill process
kill -9 <PID>
# Or on Windows
taskkill /PID <PID> /F
```

**Environment Variable Missing**:
```bash
# Check .env file exists
test -f .env

# Verify required variables
npm run typecheck  # Will show validation errors
```

**Database Connection Failed**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

## Database Connection Issues

### Symptoms
- Connection timeout errors
- "Connection refused" errors
- SSL errors
- "Missing required environment variable: DATABASE_URL" on startup

### Why the DB might not be working (Neon)

The app reads **DATABASE_URL** from a **`.env`** file in the **repo root**. That file is not in git (it’s in `.gitignore`) so you must create it and add your Neon connection string yourself.

1. **Create or edit `.env` in the repo root** (same folder as `package.json`).
2. **Add your Neon connection string** on a single line:
   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Get it from Neon: Dashboard → your project → **Connection string** (choose “Node.js” or copy the URI). **Neon requires SSL**, so the URL must end with `?sslmode=require` (or include it if there are other query params).
3. **Run from the repo root** when you start the app (`npm run dev` or `npm start`). If you run from another directory, `.env` may not be loaded.
4. **Verify:** Run `npm run db:check`. It will report whether DATABASE_URL is set and if the database accepts a connection (it does not print your URL).

### Quick check

```bash
npm run db:check
```

- If it says **"DATABASE_URL is not set"** → create `.env` in the repo root and add `DATABASE_URL=...` (your Neon URI with `?sslmode=require`).
- If it says **"Connection OK"** → the DB is reachable; if the app still fails, the issue is elsewhere (e.g. schema not migrated: run `npm run db:migrate`).
- If it says **"Connection failed"** with timeout → Neon may be paused (free tier); open the Neon dashboard to wake the project, then retry.
- If it says **SSL** error → add `?sslmode=require` to the end of DATABASE_URL.

### Other solutions

**POST /auth/login returns 500 "Connection terminated due to connection timeout"**  
Health passes but login fails: the backend is up; the failure is when the login handler talks to the DB (e.g. Neon). Check: (1) `DATABASE_URL` is set in `.env` and correct, (2) Neon project is not paused (cold start can take a few seconds), (3) firewall/network allows outbound HTTPS to Neon. Retry login after a few seconds; if using Neon free tier, the first request after idle may be slow.

**Connection Timeout** (general):
- Check database server status
- Verify DATABASE_URL is correct in `.env` (run `npm run db:check`)
- Check network connectivity
- Review firewall rules

**SSL Errors**:
- Ensure `?sslmode=require` in DATABASE_URL
- Check SSL certificate validity
- Verify database supports SSL

**Connection Pool Exhausted**:
- Reduce connection pool size
- Check for connection leaks
- Scale database if needed

## Authentication Issues

### Symptoms
- "Invalid token" errors
- Users logged out unexpectedly
- Token expiration issues

### Solutions

**Invalid Token**:
- Check token expiration (`JWT_EXPIRES_IN`)
- Verify `JWT_SECRET` matches
- Check token format (Bearer token)

**Users Logged Out / "Signed Out" When Clicking Links**:

Classic pattern: you log in successfully, click around, some pages fail to load, and you're redirected to login as if signed out. This is almost always the **frontend not sending the JWT** on every request.

- **Cause:** Frontend apiClient does not attach `Authorization: Bearer <token>` to all requests. Protected routes get 401 → frontend treats as "unauthenticated" → redirects to login.
- **Backend behavior:** This API returns 401 JSON when token is missing or invalid. It does not redirect.
- **Frontend fix:** Ensure apiClient attaches the token from storage on every request:
  ```js
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  }
  ```
- **Verify:** DevTools → Network → inspect a failing request. Check Request Headers for `Authorization: Bearer ...`. If missing, fix apiClient. Also check Application → Local Storage for `token`.

**Users Logged Out (other)**:
- Check token expiration
- Verify token version matches user
- Check for token invalidation

**Token Not Working**:
- Verify Authorization header format: `Bearer <token>`
- Check token is not expired
- Verify user still exists

## CI / Pre-commit Failures

### Format Check Fails (`npm run format:check`)

**Cause:** Code doesn't match Prettier formatting.

**Fix:**
```bash
npm run format
```

Then commit the formatted changes.

### Lint Fails

**Cause:** ESLint errors or warnings (depending on config).

**Fix:**
```bash
npm run lint
# Fix reported issues; some auto-fixable with:
npm run lint -- --fix
```

---

## Rate Limiting Issues

### Symptoms
- Getting 429 errors unexpectedly
- Rate limits not working
- False positives

### Solutions

**Too Many 429 Errors**:
- Check rate limit thresholds
- Review IP detection (proxy headers)
- Consider user-based limiting

**Rate Limits Not Working**:
- Verify rate limiting middleware is applied
- Check Redis connection (if using)
- Review rate limit configuration

**False Positives**:
- Increase rate limit thresholds
- Review IP detection logic
- Check for shared IP addresses

## Performance Issues

### Symptoms
- Slow response times
- High CPU usage
- High memory usage
- Timeout errors

### Solutions

**Slow Response Times**:
- Check database query performance
- Review slow query logs
- Add database indexes
- Optimize code paths

**High CPU Usage**:
- Profile application code
- Check for infinite loops
- Review worker processes
- Scale horizontally

**High Memory Usage**:
- Check for memory leaks
- Review connection pools
- Check cache sizes
- Restart application periodically

**Timeout Errors**:
- Increase timeout values
- Optimize slow operations
- Add request timeouts
- Review external API calls

## Error Tracking Issues

### Symptoms
- Errors not appearing in Sentry
- Missing error context
- Too many errors

### Solutions

**Errors Not in Sentry**:
- Verify `SENTRY_DSN` is set
- Check Sentry initialization logs
- Verify error is being caught
- Check Sentry project settings

**Missing Context**:
- Verify request context middleware
- Check user authentication
- Review error logging code
- Verify Sentry configuration

## Redis Issues

### Symptoms
- Rate limiting falls back to memory
- Redis connection errors
- Performance degradation

### Solutions

**Redis Not Connecting**:
- Verify `REDIS_URL` is correct
- Check Redis server status
- Review network connectivity
- Check Redis logs

**Fallback to Memory**:
- Check Redis connection status
- Review Redis logs
- Verify `USE_REDIS_RATE_LIMITING` is set
- Check Redis server resources

## Deployment Issues

### Symptoms
- Deployment fails
- Application won't start after deploy
- Rollback needed

### Solutions

**Deployment Fails**:
- Check build errors
- Verify environment variables
- Review deployment logs
- Check database migrations

**Application Won't Start**:
- Check application logs
- Verify environment variables
- Test database connection
- Review recent changes

**Need to Rollback**:
- Stop current version
- Restore previous version
- Restart application
- Verify functionality

## Getting Help

### Check Logs
```bash
# Application logs
tail -f logs/app.log

# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f api
```

### Check Status
```bash
# Health check
curl http://localhost:4000/health

# Readiness check
curl http://localhost:4000/health/ready

# Status dashboard
curl http://localhost:4000/status
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Or set log level
LOG_LEVEL=debug npm start
```

## Neon: Foreign Key Constraint "cannot be implemented" (SQLSTATE 42804)

### Symptoms
- Migrations 043–056 fail with `ERROR: foreign key constraint "xxx_cleaner_id_fkey" cannot be implemented (SQLSTATE 42804)`
- Happens when pasting gamification migrations into Neon SQL Editor

### Cause
The canonical schema uses `users.id TEXT`. Some Neon setups (e.g. Neon Auth, custom init) use `users.id UUID`. Foreign keys require exact type match: `cleaner_id TEXT` cannot reference `users(id)` when `users.id` is UUID.

### Verify Your users.id Type
Run in Neon SQL Editor:
```sql
SELECT data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';
```
- Result `text` → Use standard migrations; they should work.
- Result `uuid` → Use the gamification bundle with UUID variants. See `DB/gamification_schema_neon_part1.json` and update `cleaner_id TEXT` → `cleaner_id UUID` (and `created_by`/`updated_by`/`actor_admin_user_id` in 051) in any migration referencing `users(id)`.

### Quick Fix for Neon with users.id UUID

**Option A: Generate UUID bundle (recommended)**

```bash
node scripts/generate-neon-uuid-bundle.js --output DB/neon/gamification_uuid.sql
```

Then paste `DB/neon/gamification_uuid.sql` into Neon SQL Editor (run after your base schema). The bundle has all user-ref columns as UUID and no `BEGIN`/`COMMIT`.

**Option B: Manual edits**

When running migrations 043–056 on Neon where `users.id` is UUID, replace all `cleaner_id TEXT` with `cleaner_id UUID` (and `created_by`/`updated_by`/`actor_admin_user_id` in 051). Remove `BEGIN;`/`COMMIT;` to avoid rollback issues.

### Test DB with Neon (users.id UUID)

For integration tests against a Neon test DB with `users.id` UUID, run `000_NEON_PATCH_test_db_align.sql` after schema setup. It fixes FKs (payouts, cleaner_availability → users), `is_cleaner_available` (uuid/text cast), and adds `job_event_type` values. See `scripts/setup-test-db.js` for the full patch sequence.

**Risk profile 500 (credit_reason enum)**  
Admin risk profile (`GET /admin/risk/:userId`) previously failed with `invalid input value for enum credit_reason: "payment_failed"`. The `credit_reason` enum does not include `payment_failed`. Fixed by removing the ledger query for payment failures; risk scoring now uses cancellation and dispute factors only.

### Production schema alignment

Same patch applies to production Neon DBs with schema drift. Run `npm run db:patch:production` with `PRODUCTION_DATABASE_URL` set. Back up first. See [RUNBOOK.md](./RUNBOOK.md) section 1.1.

### 500 errors: Admin KPIs, Messages unread, Job transitions

**Root cause:** Schema/code mismatches. Common fixes:

1. **Admin KPIs (GET /admin/kpis)** — `getAdminKPIs` previously queried `credit_ledger` with `amount`/`direction`; schema uses `delta_credits`. Fixed in `adminService.ts` to use `SUM(ABS(delta_credits))` for job_escrow.

2. **Messages unread (GET /messages/unread)** — Requires `messages` table with `job_id`, `sender_id`, `is_read`. Verify via `npm run db:verify:production` that `messages` exists.

3. **Job transitions (POST /jobs/:id/transition)** — Error `column "pricing_snapshot" of relation "jobs" does not exist` means the patch hasn't been applied. The `000_NEON_PATCH_test_db_align.sql` adds `jobs.pricing_snapshot`. Run it against your test DB: `DATABASE_URL=... node scripts/run-migration.js "DB/migrations/000_NEON_PATCH_test_db_align.sql"`.

**Verify schema:** `PRODUCTION_DATABASE_URL=... npm run db:verify:production`

## Document Execution

For a consolidated view of all canonical docs (ARCHITECTURE, SETUP, CONTRIBUTING, GAP_ANALYSIS, MASTER_CHECKLIST, EXECUTION_PLAN, CI_CD, PRODUCTION_READINESS, TROUBLESHOOTING) and implementation status, see [DOCUMENT_EXECUTION_TRACKER.md](./DOCUMENT_EXECUTION_TRACKER.md).

## Integration tests: known skips and status

These integration tests are intentionally skipped or may need real DB/auth to pass. See `src/tests/integration/`.

| Test file | Skipped / issue | How to fix or run |
|-----------|-----------------|--------------------|
| **onboardingFlow.test.ts** | `it.skip("completes full 10-step onboarding flow")` | Auth rejects fake token. For real-auth coverage, use **onboardingRealAuth.test.ts** (GET /cleaner/onboarding/progress with `createTestCleaner()` token). Full 10-step flow remains skipped until auth mock or full E2E is added. |
| **v1Hardening.test.ts** | `it.skip("should prevent duplicate webhook processing")` | Skipped; enable when webhook idempotency test is ready (e.g. Stripe test mode + idempotency key). |
| **v2Features.test.ts** | `it.skip("should be able to import stuckJobDetection worker")` | Skipped; enable when worker exists and is importable in test env. |
| **disputeFlow.test.ts** | Not skipped | Uses `jobRes.body.data?.job?.id ?? jobRes.body.job?.id` for API shape compatibility. Run with real DB and test users. |
| **v3Features.test.ts** | Not skipped | Subscription/earnings tests may 500 if Stripe or DB setup differs. Run with test DB; accept 200 or 500 in assertions if needed (see BUNDLE_MERGE_ANALYSIS). |

**Run integration tests:** `npm run test:integration`. For full flow (jobs, dispute, V3), ensure `TEST_DATABASE_URL` or `DATABASE_URL` points to a test DB with migrations applied and seed if required.

## Prevention

### Regular Maintenance
- Monitor error rates daily
- Review performance metrics weekly
- Update dependencies monthly
- Test recovery procedures quarterly

### Best Practices
- Always test in staging first
- Monitor during deployments
- Keep backups current
- Document all changes

### Integration Test Timeouts
If `V1 Core Features: Reliability → Tier → Payout Flow` tests timeout (5000ms), they use a 15000ms timeout. Slow DB (e.g. Neon free tier) may still fail; increase timeout in the describe block if needed.

### npm Audit (Dev Dependencies)
`npm audit` may report 6 moderate vulnerabilities in esbuild/vite/vitest (dev server SSRF). These affect only dev/test tooling, not production. No safe fix; `npm audit fix --force` would upgrade vitest to v4 (breaking). Accept for now or plan vitest v4 migration.

### Next.js viewport / themeColor warnings (frontend repo)
Next.js App Router does **not** support `viewport` or `themeColor` inside `export const metadata`. You get a framework warning and a large stack trace when navigating to routes that declare them there (e.g. `/notifications`, `/cleaner/dashboard`).

**Fix (in the frontend repo):** Move viewport and themeColor into a separate export.

1. In the route file (e.g. `src/app/notifications/layout.tsx` or `src/app/notifications/page.tsx`):

```ts
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Notifications",
  // keep other metadata (description, openGraph, etc.) — remove viewport and themeColor
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};
```

2. Remove `viewport` and `themeColor` from the `metadata` object.

**Find all occurrences in the frontend:**  
`rg "export const metadata|viewport:|themeColor:" src/app -n` — any file with `viewport:` or `themeColor:` inside metadata should use `export const viewport` instead.
