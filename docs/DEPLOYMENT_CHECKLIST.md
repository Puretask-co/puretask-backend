# 🚀 PureTask Backend Deployment Checklist

Complete this checklist before deploying to production.

---

## 📋 Pre-Deployment Checklist

### 1. ✅ Code Quality
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`

### 2. ✅ Environment Variables
- [ ] Copy `docs/ENV_TEMPLATE.md` content to `.env`
- [ ] Set all **REQUIRED** variables (see below)
- [ ] Generate secure secrets for JWT and N8N

### 3. ✅ Database (Neon)
- [ ] Database created in Neon Console
- [ ] Connection string added to `DATABASE_URL`
- [ ] All migrations run successfully
- [ ] Schema verified using `scripts/verifySchema.sql`

### 4. ✅ Stripe Setup
- [ ] Stripe account created and verified
- [ ] API keys obtained (test mode for staging, live for production)
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Webhook secret obtained and added to env

### 5. ✅ Notification Providers (Optional)
- [ ] SendGrid account and API key (for emails)
- [ ] Twilio account and credentials (for SMS)
- [ ] OneSignal account and keys (for push notifications)

---

## 🔐 Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ YES | Neon PostgreSQL connection string |
| `JWT_SECRET` | ✅ YES | Secret for JWT signing (min 32 chars) |
| `STRIPE_SECRET_KEY` | ✅ YES | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | ✅ YES | Stripe webhook signing secret |
| `N8N_WEBHOOK_SECRET` | ✅ YES | Secret for n8n webhook auth |

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate N8N_WEBHOOK_SECRET  
openssl rand -hex 32
```

---

## 🗄️ Database Setup

### Step 1: Run Migrations

**Recommended (fresh database):**
```bash
# Complete schema (tables, views, functions)
psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql

# Optional: seed test data (dev/staging only)
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

**Existing databases already on 001-019:** continue with the numbered migrations as before; do **not** apply the consolidated file on top.

**Staging verification:**
```bash
# Verify schema shape
psql "$DATABASE_URL" -f scripts/verifySchema.sql

# Optional integrity checks (fill placeholders)
psql "$DATABASE_URL" -f scripts/verify_integrity.sql
```

### Step 2: Verify Schema

1. Open Neon Console → SQL Editor
2. Paste contents of `scripts/verifySchema.sql`
3. Run and verify all tables exist

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
```

---

## 💳 Stripe Configuration

### 1. Create Webhook Endpoint

In Stripe Dashboard → Developers → Webhooks:

- **Endpoint URL**: `https://your-api.com/stripe/webhook`
- **Events to send**:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `account.updated` (for Connect)
  - `transfer.created`
  - `transfer.failed`
  - `payout.paid`
  - `payout.failed`

### 2. Get Webhook Secret

After creating the webhook, click "Reveal" to get the signing secret.
Add it to `STRIPE_WEBHOOK_SECRET`.

### 3. Test Webhook

```bash
# Use Stripe CLI to test
stripe listen --forward-to localhost:4000/stripe/webhook
stripe trigger payment_intent.succeeded
```

---

## 🖥️ Deployment Commands

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

Schedule these workers using cron, Railway cron jobs, or similar:

| Worker | Schedule | Command |
|--------|----------|---------|
| Auto-cancel stale jobs | Every 15 min | `npm run worker:auto-cancel` |
| Auto-expire awaiting approval | Every 1 hour | `npm run worker:auto-expire` |
| Weekly payouts | Every Sunday 00:00 | `npm run worker:payout-weekly` |
| Daily KPI snapshot | Daily 00:00 | `npm run worker:kpi-daily` |
| Daily backup | Daily 02:00 | `npm run worker:backup-daily` |
| Retry failed notifications | Every 5 min | `npm run worker:retry-notifications` |
| Reliability recalculation | Daily 03:00 | `npm run worker:reliability-recalc` |
| Webhook retry | Every 5 min | `npm run worker:webhook-retry` |
| Credit economy maintenance | Daily 04:00 | `npm run worker:credit-economy` |
| Stuck job detection | Every 30 min | `npm run worker:stuck-detection` |
| Weekly summary emails | Sunday 08:00 | `npm run worker:weekly-summary` |
| Payout retry | Every 1 hour | `npm run worker:payout-retry` |
| Subscription job creation | Daily 06:00 | `npm run worker:subscription-jobs` |
| Expire boosts | Every 1 hour | `npm run worker:expire-boosts` |
| Queue processor | Continuous | `npm run worker:queue-processor` |
| Cleaning scores | Daily 05:00 | `npm run worker:cleaning-scores` |
| Goal checker | Daily 07:00 | `npm run worker:goal-checker` |

---

## 🧪 Health Checks

### API Health Check

```bash
curl https://your-api.com/health
# Expected: { "ok": true, "db": "up" }
```

### Database Health Check

```bash
curl https://your-api.com/admin/system/health
# Requires admin auth
```

---

## 🔒 Security Checklist

- [ ] All secrets are environment variables (never in code)
- [ ] HTTPS enforced in production
- [ ] CORS configured for your frontend domains only
- [ ] Rate limiting enabled
- [ ] Helmet security headers enabled
- [ ] JWT secrets are strong (32+ chars)
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
```

**Migrations Failed**
```
Run migrations in order
Check for duplicate table/column names
Verify database permissions
```

---

## ✅ Final Deployment Steps

1. [ ] All environment variables set
2. [ ] Database migrations complete
3. [ ] Schema verification passed
4. [ ] Stripe webhooks configured
5. [ ] Health check returns OK
6. [ ] Background workers scheduled
7. [ ] Monitoring/logging configured
8. [ ] SSL certificate valid
9. [ ] DNS configured
10. [ ] Smoke tests passed

**🎉 You're ready to launch!**

