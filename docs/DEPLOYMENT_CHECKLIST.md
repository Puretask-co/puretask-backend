# 🚀 PureTask Backend Deployment Checklist

Complete this checklist before deploying to production.

---

## ⚡ Quick Start (For Experienced Deployers)

**Estimated Time: 30-60 minutes**

If you've deployed before and just need a refresher:

1. **Environment Setup** (5 min)
   ```bash
   # Set required env vars (see Required Environment Variables section)
   # Generate secrets: openssl rand -hex 32
   ```

2. **Database Migrations** (10 min)
   - Run `DB/migrations/000_CONSOLIDATED_SCHEMA.sql` in Neon SQL Editor
   - Run `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
   - Run `docs/FIX_STRIPE_EVENTS_COLUMN.sql`

3. **Stripe Configuration** (5 min)
   - Create webhook endpoint in Stripe Dashboard
   - Add webhook secret to env

4. **Build & Test** (10 min)
   ```bash
   npm run typecheck
   npm run lint
   npm run test:v1-hardening
   npm run build
   npm run test:smoke
   ```

5. **Deploy** (10-20 min)
   - Deploy API service
   - Schedule background workers
   - Verify health checks

6. **Post-Deployment** (5 min)
   - Run post-deployment verification (see below)
   - Monitor logs for errors

**⚠️ For first-time deployments, follow the complete checklist below.**

---

## 📋 Pre-Deployment Checklist

**Estimated Total Time: 2-4 hours** (first deployment) | **30-60 minutes** (subsequent deployments)

### 1. ✅ Code Quality (15-30 min)
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`

### 2. ✅ Environment Variables (10-15 min)
- [ ] Copy `docs/ENV_TEMPLATE.md` content to `.env` (or use `.env.example` if it exists)
- [ ] Set all **REQUIRED** variables (see below)
- [ ] Generate secure secrets for JWT and N8N
- [ ] **V1 HARDENING:** Verify production guard flags are set appropriately

### 3. ✅ Database (Neon) (20-40 min)
- [ ] Database created in Neon Console
- [ ] Connection string added to `DATABASE_URL` (must include `?sslmode=require` for production)
- [ ] All migrations run successfully (use Neon SQL Editor for best results)
- [ ] Schema verified using `scripts/verifySchema.sql`
- [ ] **V1 HARDENING:** Hardening migrations (901-905) applied
- [ ] **V1 HARDENING:** `stripe_events` table columns verified (run `docs/FIX_STRIPE_EVENTS_COLUMN.sql` if needed)

### 4. ✅ Stripe Setup (15-20 min)
- [ ] Stripe account created and verified
- [ ] API keys obtained (test mode for staging, live for production)
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Webhook secret obtained and added to env

### 5. ✅ Notification Providers (Optional) (10-15 min)
- [ ] SendGrid account and API key (for emails)
- [ ] Twilio account and credentials (for SMS)
- [ ] OneSignal account and keys (for push notifications)

---

## 🔐 Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ YES | Neon PostgreSQL connection string |
| `JWT_SECRET` | ✅ YES | Secret for JWT signing | **Production: min 64 chars** (32 chars is minimum, 64+ recommended) |
| `STRIPE_SECRET_KEY` | ✅ YES | Stripe API secret key | Must start with `sk_test_` or `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | ✅ YES | Stripe webhook signing secret | Starts with `whsec_` |
| `N8N_WEBHOOK_SECRET` | ✅ YES | Secret for n8n webhook auth | Shared secret for HMAC |

### V1 HARDENING: Production Guard Flags (Optional but Recommended)

| Variable | Default | Description |
|----------|---------|-------------|
| `BOOKINGS_ENABLED` | `true` | Set to `false` to disable job creation |
| `PAYOUTS_ENABLED` | `false` | **Must be explicitly set to `true`** to enable payouts |
| `CREDITS_ENABLED` | `true` | Set to `false` to disable credit operations |
| `REFUNDS_ENABLED` | `true` | Set to `false` to disable refunds |
| `WORKERS_ENABLED` | `true` | Set to `false` to disable all background workers |

### Generate Secure Secrets

```bash
# Generate JWT_SECRET (64 chars recommended for production)
openssl rand -hex 32  # Generates 64 character hex string

# Generate N8N_WEBHOOK_SECRET
openssl rand -hex 32
```

---

## 🗄️ Database Setup

**Estimated Time: 20-40 minutes**

### Step 1: Run Migrations (15-30 min)

**Recommended (fresh database):**

**Option A: Using psql (command line)**
```bash
# Complete schema (tables, views, functions)
psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql

# V1 HARDENING: Run hardening migrations
psql $DATABASE_URL -f DB/migrations/hardening/901_stripe_events_processed.sql
psql $DATABASE_URL -f DB/migrations/hardening/902_ledger_idempotency_constraints.sql
psql $DATABASE_URL -f DB/migrations/hardening/903_payout_items_uniqueness.sql
psql $DATABASE_URL -f DB/migrations/hardening/904_worker_runs_table.sql
psql $DATABASE_URL -f DB/migrations/hardening/905_users_fk_text_consistency.sql

# Fix stripe_events table columns (if needed)
psql $DATABASE_URL -f docs/FIX_STRIPE_EVENTS_COLUMN.sql

# Optional: seed test data (dev/staging only)
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

**Option B: Using Neon SQL Editor (recommended for Neon)**
1. Open Neon Console → SQL Editor
2. Copy and paste contents of `DB/migrations/000_CONSOLIDATED_SCHEMA.sql` and run
3. Copy and paste contents of `docs/NEON_V1_HARDENING_MIGRATIONS.sql` and run (includes all 901-905 migrations)
4. Copy and paste contents of `docs/FIX_STRIPE_EVENTS_COLUMN.sql` and run (ensures stripe_events table has all required columns)

**Existing databases already on 001-019:** continue with the numbered migrations as before; do **not** apply the consolidated file on top.

**Staging verification:**
```bash
# Verify schema shape
psql "$DATABASE_URL" -f scripts/verifySchema.sql

# Optional integrity checks (if verify_integrity.sql exists)
# psql "$DATABASE_URL" -f scripts/verify_integrity.sql
```

### Step 2: Verify Schema (5-10 min)

1. Open Neon Console → SQL Editor
2. Paste contents of `scripts/verifySchema.sql`
3. Run and verify all tables exist
4. **V1 HARDENING:** Verify hardening tables exist:
   - `stripe_events_processed` (for webhook idempotency)
   - `payout_items` (for payout idempotency)
   - `worker_runs` (for worker execution tracking)
5. **V1 HARDENING:** Verify `stripe_events` table has all required columns:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'stripe_events' 
   ORDER BY ordinal_position;
   ```
   Should include: `id`, `stripe_event_id`, `type`, `payload`, `processed`, `created_at`, `processed_at`

### Migration Order (legacy incremental path)

```
001_init.sql
002_supplementary.sql
003_credit_views.sql
004_connect_payouts.sql
005_backups.sql
006_job_photos.sql
007_payment_purposes.sql
008_client_stripe_customer.sql
009_stripe_column_alias.sql
010_webhook_retry_queue.sql
011_cleaner_availability.sql
012_job_offers.sql
013_credit_economy_controls.sql
014_payout_improvements.sql
015_referrals_and_boosts.sql
016_v2_core.sql
017_policy_compliance.sql
018_core_systems_v2.sql
019_comprehensive_schema_additions.sql
... (up to 023_cleaner_portal_invoicing.sql)
... (then hardening migrations 901-905)
```

---

## 💳 Stripe Configuration

**Estimated Time: 15-20 minutes**

### 1. Create Webhook Endpoint (10 min)

In Stripe Dashboard → Developers → Webhooks:

- **Endpoint URL**: `https://your-api.com/stripe/webhook`
- **Events to send**:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.closed`
  - `account.updated` (for Connect)
  - `transfer.created`
  - `transfer.updated`
  - `transfer.reversed`
  - `payout.paid`
  - `payout.failed`

### 2. Get Webhook Secret (2 min)

After creating the webhook, click "Reveal" to get the signing secret.
Add it to `STRIPE_WEBHOOK_SECRET`.

### 3. Test Webhook (3-5 min)

```bash
# Use Stripe CLI to test
stripe listen --forward-to localhost:4000/stripe/webhook
stripe trigger payment_intent.succeeded
```

---

## 🖥️ Deployment Commands

**Estimated Time: 10-20 minutes**

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Server runs at http://localhost:4000
```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## ⏰ Background Workers

**Estimated Setup Time: 10-15 minutes**

**IMPORTANT:** Workers can be run via:
1. **Individual npm scripts** (for cron): `npm run worker:<name>`
2. **Worker runner** (for testing/all workers): `ts-node src/workers/index.ts <worker-name>` or `node dist/workers/index.js <worker-name>`

Schedule these workers using cron, Railway cron jobs, or similar:

| Worker | Schedule | Command | Notes |
|--------|----------|---------|-------|
| Auto-cancel stale jobs | Every 15 min | `node dist/workers/index.js auto-cancel` or `ts-node src/workers/index.ts auto-cancel` | ✅ V1 enabled |
| **Payouts** | Weekly or as needed | `node dist/workers/index.js payouts` or `ts-node src/workers/index.ts payouts` | ⚠️ **Note:** V1-hardened worker name is `payouts` (uses `processPayouts.ts`). Older `payoutWeekly.ts` exists but use `payouts` for V1. Only run if `PAYOUTS_ENABLED=true` |
| Daily KPI snapshot | Daily 00:00 | `node dist/workers/index.js kpi-snapshot` or `ts-node src/workers/index.ts kpi-snapshot` | ✅ V1 enabled |
| Retry failed events | Every 5 min | `node dist/workers/index.js retry-events` or `ts-node src/workers/index.ts retry-events` | ✅ V1 enabled |
| Photo cleanup | Daily | `node dist/workers/index.js photo-cleanup` or `ts-node src/workers/index.ts photo-cleanup` | ✅ V1 enabled |

**Note:** Many other workers exist in `disabled/` folder and may not be fully functional for V1. See `docs/WORKER_SCHEDULE.md` for complete list.

**V1 Critical Workers (Recommended for launch):**
- `auto-cancel` - Prevents stuck jobs
- `payouts` - Only if `PAYOUTS_ENABLED=true`
- `kpi-snapshot` - Basic metrics
- `retry-events` - Retry failed webhooks/events
- `photo-cleanup` - Maintains photo retention policy

---

## 🧪 Health Checks

**Estimated Time: 2-5 minutes**

### API Health Check

```bash
curl https://your-api.com/health
# Expected: { "ok": true, "status": "ok", "service": "puretask-backend", "time": "...", "env": "production" }
```

### Readiness Check (Database)

```bash
curl https://your-api.com/health/ready
# Expected: { "status": "ready", "database": "connected", "timestamp": "..." }
```

### Liveness Check

```bash
curl https://your-api.com/health/live
# Expected: { "status": "alive", "uptime": 123.45, "memory": {...} }
```

### Database Health Check (Admin Only)

```bash
curl https://your-api.com/admin/system/health
# Requires admin auth token in Authorization header
```

---

## 🔒 Security Checklist

- [ ] All secrets are environment variables (never in code)
- [ ] HTTPS enforced in production
- [ ] CORS configured for your frontend domains only
- [ ] Rate limiting enabled
- [ ] Helmet security headers enabled
- [ ] JWT secrets are strong (64+ chars for production, 32+ minimum)
- [ ] **V1 HARDENING:** Production guard flags reviewed and set appropriately
- [ ] **V1 HARDENING:** Boot-time environment validation passes (check logs)
- [ ] Database uses SSL (`sslmode=require`)
- [ ] Stripe webhook signature verification enabled
- [ ] Admin routes protected by role check

---

## 📊 Monitoring Recommendations

### Metrics to Track
- API response times
- Error rates (4xx, 5xx)
- Database query times
- Stripe webhook processing time
- Background worker success/failure rates
- **V1 HARDENING:** Worker execution tracked in `worker_runs` table

### Recommended Tools
- **Logging**: Logtail, Papertrail, or CloudWatch
- **APM**: Sentry, New Relic, or DataDog
- **Uptime**: UptimeRobot, Pingdom, or Better Uptime

---

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```
Check DATABASE_URL format and SSL mode
Verify IP allowlist in Neon if using static IPs
```

**Stripe Webhook 400 Error**
```
Ensure raw body is passed for signature verification
Check STRIPE_WEBHOOK_SECRET matches dashboard
```

**JWT Token Invalid**
```
Ensure JWT_SECRET is the same across all instances
Check token expiration (JWT_EXPIRES_IN)
Verify JWT_SECRET is at least 32 characters (64+ recommended)
```

**Environment Validation Fails on Startup**
```
Check STRIPE_SECRET_KEY starts with sk_test_ or sk_live_
Verify DATABASE_URL format (must contain postgres:// or postgresql://)
Check JWT_SECRET length (32+ chars required, 64+ recommended for production)
Review production guard flag settings
```

**Workers Not Running**
```
Check WORKERS_ENABLED flag is not set to "false"
Verify worker commands use correct names (e.g., "payouts" not "payout-weekly")
Check worker logs for errors
Verify database connectivity
```

**Migrations Failed**
```
Run migrations in order
Check for duplicate table/column names
Verify database permissions
For consolidated schema, run hardening migrations after base schema
For Neon: Use SQL Editor and run docs/NEON_V1_HARDENING_MIGRATIONS.sql
If stripe_events table missing columns, run docs/FIX_STRIPE_EVENTS_COLUMN.sql
```

---

## ✅ Final Deployment Steps

**Estimated Time: 30-60 minutes**

1. [ ] All environment variables set (including V1 guard flags)
2. [ ] Database migrations complete (including hardening migrations 901-905)
3. [ ] Schema verification passed
4. [ ] Stripe webhooks configured with all required events
5. [ ] Health checks return OK (`/health`, `/health/ready`, `/health/live`)
6. [ ] Background workers scheduled (at least V1 critical workers)
7. [ ] Monitoring/logging configured
8. [ ] SSL certificate valid
9. [ ] DNS configured
10. [ ] Smoke tests passed (`npm run test:smoke`)
11. [ ] **V1 HARDENING:** Environment validation passes (check startup logs)
12. [ ] **V1 HARDENING:** V1 hardening tests pass (`npm run test:v1-hardening`)
13. [ ] **V1 HARDENING:** Worker dry-run tests pass (`npm run test:worker-dryrun`) - if database available
14. [ ] **V1 HARDENING:** Stripe E2E tests pass (`npm run test:stripe-e2e`) - if Stripe test account available

**🎉 You're ready to launch!**

---

## 🔄 Rollback Plan

**If deployment fails or issues are discovered post-deployment:**

### Immediate Rollback Steps

1. **Stop New Deployments**
   - Pause any CI/CD pipelines
   - Disable auto-deployments if enabled

2. **Revert Code Deployment**
   ```bash
   # If using Git-based deployment
   git revert <commit-hash>
   git push origin main
   
   # Or redeploy previous known-good version
   git checkout <previous-version-tag>
   ```

3. **Revert Environment Variables** (if changed)
   - Restore previous `.env` values from backup
   - Restart services to pick up changes

4. **Database Rollback** (if migrations caused issues)
   ```sql
   -- ⚠️ CAUTION: Only if absolutely necessary
   -- Review migration files to determine rollback SQL
   -- Most V1 hardening migrations are additive and safe
   ```

5. **Disable Feature Flags**
   ```bash
   # Set guard flags to safe defaults
   BOOKINGS_ENABLED=false
   PAYOUTS_ENABLED=false
   CREDITS_ENABLED=false
   WORKERS_ENABLED=false
   ```

6. **Monitor & Verify**
   - Check health endpoints
   - Review error logs
   - Verify database integrity

### Rollback Decision Criteria

**Rollback immediately if:**
- Health checks fail consistently
- Database connection errors
- Critical security vulnerabilities discovered
- Data corruption detected
- Payment processing failures

**Consider gradual rollback if:**
- Non-critical feature issues
- Performance degradation (can be optimized)
- Minor UI/UX issues

### Post-Rollback Actions

1. Document the issue and root cause
2. Create a fix in a separate branch
3. Test fix thoroughly before re-deployment
4. Update deployment checklist if process issue

---

## ✅ Post-Deployment Verification

**Run these checks immediately after deployment (within 5-10 minutes):**

### 1. Health Checks (2 min)
```bash
# Basic health
curl https://your-api.com/health
# Expected: { "ok": true, "status": "ok", ... }

# Readiness (database)
curl https://your-api.com/health/ready
# Expected: { "status": "ready", "database": "connected", ... }

# Liveness
curl https://your-api.com/health/live
# Expected: { "status": "alive", ... }
```

### 2. Environment Validation (1 min)
```bash
# Check startup logs for environment validation
# Should see: "✅ Environment validation passed"
# Should NOT see: "⚠️ WARNING" or "❌ ERROR" for critical vars
```

### 3. Database Connectivity (1 min)
```bash
# Via admin endpoint (requires auth)
curl -H "Authorization: Bearer <admin-token>" \
  https://your-api.com/admin/system/health

# Or check logs for database connection success
```

### 4. Stripe Webhook Test (2 min)
```bash
# Use Stripe CLI to send test webhook
stripe trigger payment_intent.succeeded

# Verify webhook is received and processed
# Check logs for: "Stripe webhook processed successfully"
```

### 5. Critical Endpoints (3 min)
```bash
# Authentication endpoint
curl -X POST https://your-api.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Jobs endpoint (if authenticated)
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/jobs

# Credits endpoint (if authenticated)
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/credits/balance
```

### 6. Worker Verification (2 min)
```bash
# Check worker_runs table for recent executions
# Should see entries for scheduled workers

# Or check logs for worker execution
# Should see: "Worker completed: <worker-name>"
```

### 7. Monitoring Setup (5 min)
- [ ] Error tracking configured (Sentry/DataDog/etc.)
- [ ] Log aggregation working (Logtail/Papertrail/etc.)
- [ ] Uptime monitoring active (UptimeRobot/etc.)
- [ ] Alerts configured for critical errors

### 8. Smoke Test (5 min)
```bash
# Run smoke tests against production (if test account available)
npm run test:smoke
# ⚠️ Use test database or test Stripe account only
```

### Post-Deployment Checklist

- [ ] All health checks pass
- [ ] No critical errors in logs (first 10 minutes)
- [ ] Database queries responding normally
- [ ] Stripe webhooks processing successfully
- [ ] Background workers executing on schedule
- [ ] Monitoring/alerts configured and working
- [ ] API response times normal (< 500ms for most endpoints)
- [ ] No 5xx errors in first hour

**If any checks fail, refer to Rollback Plan section above.**

---

## 📝 V1 Launch-Specific Notes

### Guard Flag Recommendations for V1 Launch
```bash
# Recommended V1 production settings
BOOKINGS_ENABLED=true      # Required for launch
PAYOUTS_ENABLED=false      # Enable only after thorough testing
CREDITS_ENABLED=true       # Required for launch
REFUNDS_ENABLED=true       # Required for disputes
WORKERS_ENABLED=true       # Required for automation
```

### Testing Before Launch

**Critical Tests (must pass):**
```bash
# 1. Type checking
npm run typecheck

# 2. Linting
npm run lint

# 3. V1 hardening tests (CRITICAL)
npm run test:v1-hardening

# 4. Production build
npm run build

# 5. Smoke tests
npm run test:smoke
```

**Recommended Tests (if database/Stripe available):**
```bash
# Worker dry-run (if database connected)
npm run test:worker-dryrun

# Stripe E2E test (requires Stripe test account)
npm run test:stripe-e2e

# Full test suite
npm test
npm run test:integration
```

**📚 For complete test instructions, see:** `docs/V1_TEST_CHECKLIST.md`

---

## 📊 Deployment Time Estimates Summary

| Phase | First Deployment | Subsequent Deployments |
|-------|------------------|----------------------|
| **Quick Start** | N/A | 30-60 min |
| **Pre-Deployment** | 2-4 hours | 30-60 min |
| - Code Quality | 15-30 min | 5-10 min |
| - Environment Setup | 10-15 min | 5 min |
| - Database Migrations | 20-40 min | 5-15 min |
| - Stripe Configuration | 15-20 min | 5 min |
| **Database Setup** | 20-40 min | 5-15 min |
| **Stripe Configuration** | 15-20 min | 5 min |
| **Deployment** | 10-20 min | 10-20 min |
| **Worker Setup** | 10-15 min | 5 min |
| **Health Checks** | 2-5 min | 2-5 min |
| **Post-Deployment** | 15-20 min | 10-15 min |
| **TOTAL** | **3-5 hours** | **1-2 hours** |

---

## 📚 Additional Resources

- **Test Checklist**: `docs/V1_TEST_CHECKLIST.md` - Complete testing guide
- **Environment Template**: `docs/ENV_TEMPLATE.md` - Environment variable reference
- **Worker Schedule**: `docs/WORKER_SCHEDULE.md` - Detailed worker scheduling guide
- **Neon Migrations**: `docs/NEON_V1_HARDENING_MIGRATIONS.sql` - Consolidated V1 hardening migrations
- **Stripe Events Fix**: `docs/FIX_STRIPE_EVENTS_COLUMN.sql` - Fix stripe_events table schema

---

**Last Updated:** 2025-01-12  
**Version:** V1.0  
**Status:** Production Ready ✅

