# V3 Next Steps - Implementation Guide

**Date**: 2025-01-15  
**Status**: Implementation Complete - Ready for Deployment

---

## ✅ Completed Implementation

All V3 features have been implemented:
- ✅ Tier-Aware Pricing Service & Routes
- ✅ Subscription Engine Enabled
- ✅ Earnings Dashboard Complete
- ✅ Pricing Integration into Job Assignment

---

## Step 1: Run Database Migration

**Migration File**: `DB/migrations/024_v3_pricing_snapshot.sql`

**Command**:
```bash
npm run migrate:run DB/migrations/024_v3_pricing_snapshot.sql
```

**What it does**:
- Adds `pricing_snapshot` JSONB column to `jobs` table
- Stores tier-aware pricing breakdown at booking time
- Prevents pricing drift after booking

**Verification**:
```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'pricing_snapshot';
```

---

## Step 2: Test All Endpoints

### Pricing Endpoints

**Get pricing estimate (all tiers)**:
```bash
curl -X GET "http://localhost:4000/pricing/estimate?hours=3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get pricing estimate (specific tier)**:
```bash
curl -X GET "http://localhost:4000/pricing/estimate?hours=3&tier=gold" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get tier price bands**:
```bash
curl -X GET "http://localhost:4000/pricing/tiers" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Subscription Endpoints

**Create subscription**:
```bash
curl -X POST "http://localhost:4000/premium/subscriptions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: CLIENT_ID" \
  -H "x-user-role: client" \
  -d '{
    "frequency": "weekly",
    "dayOfWeek": 1,
    "preferredTime": "10:00",
    "address": "123 Main St",
    "creditAmount": 100
  }'
```

**Get subscriptions**:
```bash
curl -X GET "http://localhost:4000/premium/subscriptions" \
  -H "x-user-id: CLIENT_ID" \
  -H "x-user-role: client"
```

**Pause/Resume subscription**:
```bash
curl -X PATCH "http://localhost:4000/premium/subscriptions/SUBSCRIPTION_ID/status" \
  -H "Content-Type: application/json" \
  -H "x-user-id: CLIENT_ID" \
  -H "x-user-role: client" \
  -d '{"status": "paused"}'
```

**Cancel subscription**:
```bash
curl -X DELETE "http://localhost:4000/premium/subscriptions/SUBSCRIPTION_ID" \
  -H "x-user-id: CLIENT_ID" \
  -H "x-user-role: client"
```

### Earnings Dashboard

**Get cleaner earnings**:
```bash
curl -X GET "http://localhost:4000/cleaner/earnings" \
  -H "Authorization: Bearer CLEANER_TOKEN"
```

### Run Automated Tests

```bash
npm test -- src/tests/integration/v3Features.test.ts
```

---

## Step 3: Schedule Subscription Worker

The subscription worker needs to run daily to create jobs from active subscriptions.

### Option 1: Railway Cron Job

If using Railway, add a cron service:

**railway.toml** (or Railway dashboard):
```toml
[service.subscription-worker]
schedule = "0 2 * * *"  # 2 AM daily
command = "node dist/workers/subscriptionJobs.js"
```

### Option 2: System Cron (Linux/Mac)

Add to crontab:
```bash
# Edit crontab
crontab -e

# Add line (runs at 2 AM daily)
0 2 * * * cd /path/to/puretask-backend && node dist/workers/subscriptionJobs.js >> /var/log/subscription-jobs.log 2>&1
```

### Option 3: Node.js Scheduler (Internal)

If running workers internally, use a scheduler library:

```typescript
// In src/workers/index.ts or separate scheduler file
import cron from 'node-cron';

// Schedule subscription jobs worker to run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('subscription_jobs_scheduled_run');
  await runSubscriptionJobs();
});
```

### Manual Run (Testing)

```bash
npm run worker:subscription-jobs
# OR
ts-node src/workers/subscriptionJobs.ts
```

---

## Step 4: Pricing Integration (Already Done!)

Pricing snapshot is now automatically stored when:
- Cleaner is assigned to job via `assignCleanerToJob()`
- Job status transitions to "accepted"

**How it works**:
1. When cleaner is assigned, system calculates tier-aware pricing
2. Pricing snapshot is stored in `jobs.pricing_snapshot` column
3. Pricing is locked and won't change even if tier changes later

**Verification**:
```sql
-- Check jobs with pricing snapshots
SELECT id, cleaner_id, pricing_snapshot 
FROM jobs 
WHERE pricing_snapshot IS NOT NULL 
LIMIT 10;
```

---

## Monitoring & Verification

### Check Subscription Worker Logs

```bash
# Railway logs
railway logs --service subscription-worker

# Or check application logs
tail -f logs/app.log | grep subscription_jobs
```

### Verify Pricing Snapshots

```sql
-- Count jobs with pricing snapshots
SELECT COUNT(*) 
FROM jobs 
WHERE pricing_snapshot IS NOT NULL;

-- View pricing breakdown
SELECT 
  id,
  cleaner_id,
  pricing_snapshot->>'cleanerTier' as tier,
  pricing_snapshot->>'totalPrice' as total_price,
  pricing_snapshot->>'totalCredits' as total_credits
FROM jobs 
WHERE pricing_snapshot IS NOT NULL
LIMIT 10;
```

### Check Earnings Dashboard

1. Complete a job as a cleaner
2. Call `GET /cleaner/earnings`
3. Verify:
   - Pending earnings show up correctly
   - Paid out amounts are accurate
   - Next payout date is calculated correctly

---

## Troubleshooting

### Migration Fails

**Error**: `column "pricing_snapshot" already exists`
- **Solution**: Migration is idempotent, this is safe to ignore

**Error**: `permission denied`
- **Solution**: Ensure database user has `ALTER TABLE` permissions

### Subscription Worker Not Running

**Check**:
1. Worker is scheduled correctly
2. `WORKERS_ENABLED` env var is `true` (or not set, defaults to true)
3. Database connection is working
4. Subscriptions table exists

### Pricing Not Being Stored

**Check**:
1. Migration was run successfully
2. `pricing_snapshot` column exists in `jobs` table
3. Cleaner has a tier set in `cleaner_profiles`
4. Job has `estimated_hours` set

### Earnings Dashboard Returns Empty

**Check**:
1. Cleaner has completed jobs
2. Jobs have been approved/completed
3. Payouts table has records
4. Credit ledger has `job_release` entries

---

## Success Criteria

✅ Migration runs successfully  
✅ Pricing endpoints return correct estimates  
✅ Subscriptions can be created/managed  
✅ Subscription worker creates jobs daily  
✅ Earnings dashboard shows correct data  
✅ Pricing snapshots stored when cleaners assigned  

---

**Last Updated**: 2025-01-15  
**Status**: Ready for deployment and testing

