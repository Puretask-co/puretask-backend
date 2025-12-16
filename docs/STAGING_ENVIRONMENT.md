# 🧪 Staging Environment Setup Guide

Complete guide for setting up and managing the PureTask Backend staging environment.

---

## 🎯 Purpose

The staging environment is used for:
- Testing new features before production
- Integration testing with external services
- Performance testing
- Team collaboration and demos

---

## 🚀 Quick Setup

### Automated Setup (Recommended)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run staging setup
./scripts/setup-staging.sh
```

This will guide you through:
1. Railway project creation
2. Database setup
3. Environment variable configuration
4. Initial deployment

### Manual Setup

Follow the detailed steps in `docs/RAILWAY_SETUP.md`.

---

## 📋 Staging Environment Checklist

### Infrastructure

- [ ] Railway project created (`puretask-backend-staging`)
- [ ] Neon database created (`puretask-staging`)
- [ ] Database migrations run
- [ ] Railway service deployed
- [ ] Domain configured

### Environment Variables

- [ ] `DATABASE_URL` - Staging database connection
- [ ] `JWT_SECRET` - Generated secret (64+ chars)
- [ ] `STRIPE_SECRET_KEY` - Stripe test key (`sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` - From Stripe dashboard
- [ ] `N8N_WEBHOOK_SECRET` - Generated secret
- [ ] `NODE_ENV=staging`
- [ ] Production guard flags set (see below)

### Stripe Configuration

- [ ] Stripe test account created
- [ ] Webhook endpoint configured
- [ ] Webhook events selected
- [ ] Webhook secret obtained

### Workers

- [ ] Workers scheduled (cron jobs or Railway cron)
- [ ] Worker logs monitored
- [ ] Worker execution verified

---

## 🔐 Staging Environment Variables

### Required Variables

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<64-char-secret>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
N8N_WEBHOOK_SECRET=<32-char-secret>
```

### Recommended Guard Flags

```bash
NODE_ENV=staging
BOOKINGS_ENABLED=true
PAYOUTS_ENABLED=false          # Disable until tested
CREDITS_ENABLED=true
REFUNDS_ENABLED=true
WORKERS_ENABLED=true
```

### Optional Variables

```bash
APP_URL=https://staging.puretask.com
SENDGRID_API_KEY=...           # For email notifications
TWILIO_ACCOUNT_SID=...         # For SMS notifications
ONESIGNAL_APP_ID=...           # For push notifications
```

---

## 🧪 Testing in Staging

### Smoke Tests

```bash
# Run against staging
STAGING_URL=https://your-staging.railway.app npm run test:smoke
```

### Integration Tests

```bash
# Run V1 hardening tests
npm run test:v1-hardening

# Run full integration suite
npm run test:integration
```

### Manual Testing

1. **Health Checks**
   ```bash
   curl https://your-staging.railway.app/health
   curl https://your-staging.railway.app/health/ready
   ```

2. **API Endpoints**
   - Test authentication: `POST /auth/login`
   - Test job creation: `POST /jobs`
   - Test reliability: `GET /cleaner/reliability`
   - Test top 3 selection: `GET /jobs/:jobId/candidates`

3. **Stripe Webhooks**
   - Use Stripe CLI: `stripe listen --forward-to https://your-staging.railway.app/stripe/webhook`
   - Trigger test events: `stripe trigger payment_intent.succeeded`

---

## 🔄 Deployment Workflow

### Deploy to Staging

```bash
# Automated deployment
./scripts/deploy-staging.sh

# Or manual
railway up --environment staging
```

### Pre-Deployment Checks

Before deploying to staging:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Linter passes: `npm run lint`
- [ ] Tests pass (if database available)

### Post-Deployment Verification

After deploying:
- [ ] Health check passes
- [ ] Logs show no errors
- [ ] Database connection verified
- [ ] Workers executing (if scheduled)

---

## 📊 Monitoring Staging

### View Logs

```bash
# All logs
railway logs --environment staging

# Follow logs
railway logs --follow --environment staging

# Filter by service
railway logs --service api --environment staging
```

### Monitor Metrics

1. **Railway Dashboard**
   - CPU/Memory usage
   - Request rates
   - Error rates

2. **Application Logs**
   - Error tracking
   - Performance metrics
   - Worker execution

3. **Database**
   - Connection pool status
   - Query performance
   - Migration status

---

## 🔧 Maintenance

### Database Migrations

When new migrations are added:

1. **Test locally first**
   ```bash
   # Test against local/staging database
   psql $STAGING_DATABASE_URL -f DB/migrations/XXX_new_migration.sql
   ```

2. **Apply to staging**
   - Use Neon SQL Editor (recommended)
   - Or run via Railway CLI

3. **Verify**
   ```bash
   # Check schema
   psql $STAGING_DATABASE_URL -f scripts/verifySchema.sql
   ```

### Environment Variable Updates

```bash
# Update variable
railway variables set KEY=new_value --environment staging

# View all variables
railway variables --environment staging

# Delete variable
railway variables delete KEY --environment staging
```

### Worker Schedule Updates

1. Update cron schedule in Railway dashboard
2. Or update worker service configuration
3. Verify workers execute on schedule

---

## 🚨 Troubleshooting

### Service Won't Start

1. **Check logs**: `railway logs --environment staging`
2. **Check environment variables**: `railway variables --environment staging`
3. **Verify build**: Check Railway build logs
4. **Check health endpoint**: `curl https://your-staging.railway.app/health`

### Database Connection Issues

1. Verify `DATABASE_URL` is set correctly
2. Check SSL mode (`?sslmode=require`)
3. Verify database is accessible
4. Check Neon console for connection limits

### Workers Not Running

1. Verify `WORKERS_ENABLED=true`
2. Check worker logs: `railway logs --service worker`
3. Verify cron schedule
4. Check `worker_runs` table for execution history

### Stripe Webhook Issues

1. Verify webhook URL is correct
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. View webhook delivery logs in Stripe dashboard
4. Check application logs for webhook processing errors

---

## 📚 Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Deployment Checklist**: `docs/DEPLOYMENT_CHECKLIST.md`
- **Worker Schedule**: `docs/WORKER_SCHEDULE.md`
- **Environment Template**: `docs/ENV_TEMPLATE.md`

---

## 🎯 Staging vs Production

| Aspect | Staging | Production |
|--------|---------|------------|
| **Database** | Test database | Production database |
| **Stripe** | Test mode (`sk_test_`) | Live mode (`sk_live_`) |
| **Domain** | `staging.puretask.com` | `api.puretask.com` |
| **Payouts** | Disabled (`PAYOUTS_ENABLED=false`) | Enabled after testing |
| **Monitoring** | Basic logging | Full monitoring + alerts |
| **Workers** | All enabled for testing | Production schedule |

---

**Last Updated**: 2025-01-15  
**Status**: Ready for Setup ✅

