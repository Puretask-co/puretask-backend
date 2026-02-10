# V3 Deployment Verification Guide

**Date**: 2025-01-15  
**Status**: Ready for Verification

---

## ✅ Quick Verification Checklist

- [ ] Database migration run successfully
- [ ] Pricing endpoints responding
- [ ] Subscription endpoints working
- [ ] Earnings dashboard accessible
- [ ] Subscription worker scheduled
- [ ] Pricing snapshots being stored

---

## 1. Automated Verification

### Run Deployment Verification Script

```bash
npm run verify:v3
```

This script checks:
- ✅ `pricing_snapshot` column exists in `jobs` table
- ✅ Pricing snapshots are being stored
- ✅ Subscription table is accessible
- ✅ Credit ledger structure is correct
- ✅ Payouts table structure is correct

### Test All Endpoints

```bash
npm run test:v3-endpoints
```

This script tests:
- ✅ `GET /pricing/estimate` - All tiers
- ✅ `GET /pricing/estimate?tier=gold` - Specific tier
- ✅ `GET /pricing/tiers` - Price bands
- ✅ `POST /premium/subscriptions` - Create subscription
- ✅ `GET /premium/subscriptions` - List subscriptions
- ✅ `GET /cleaner/earnings` - Earnings dashboard

---

## 2. Manual Endpoint Testing

### Pricing Endpoints

#### Get Pricing Estimate (All Tiers)
```bash
curl -X GET "http://localhost:4000/pricing/estimate?hours=3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "hours": 3,
  "estimate": {
    "minPrice": 30.00,
    "maxPrice": 45.00,
    "minCredits": 300,
    "maxCredits": 450,
    "breakdown": {
      "bronze": { "totalUsd": 30.00, "totalCredits": 300 },
      "silver": { "totalUsd": 35.00, "totalCredits": 350 },
      "gold": { "totalUsd": 40.00, "totalCredits": 400 },
      "platinum": { "totalUsd": 45.00, "totalCredits": 450 }
    }
  }
}
```

#### Get Pricing Estimate (Specific Tier)
```bash
curl -X GET "http://localhost:4000/pricing/estimate?hours=3&tier=gold" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Tier Price Bands
```bash
curl -X GET "http://localhost:4000/pricing/tiers" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Subscription Endpoints

#### Create Subscription
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

#### Get Subscriptions
```bash
curl -X GET "http://localhost:4000/premium/subscriptions" \
  -H "x-user-id: CLIENT_ID" \
  -H "x-user-role: client"
```

### Earnings Dashboard

#### Get Cleaner Earnings
```bash
curl -X GET "http://localhost:4000/cleaner/earnings" \
  -H "Authorization: Bearer CLEANER_TOKEN"
```

**Expected Response**:
```json
{
  "earnings": {
    "pendingEarnings": {
      "credits": 500,
      "usd": 50.00,
      "jobs": 3
    },
    "paidOut": {
      "credits": 1000,
      "usd": 100.00,
      "jobs": 10,
      "lastPayout": "2025-01-08T00:00:00Z"
    },
    "nextPayout": {
      "date": "2025-01-15T00:00:00Z",
      "estimatedCredits": 500,
      "estimatedUsd": 50.00
    },
    "payoutSchedule": "weekly"
  }
}
```

---

## 3. Database Verification

### Check Pricing Snapshots

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
  pricing_snapshot->>'totalCredits' as total_credits,
  pricing_snapshot->>'totalUsd' as total_usd
FROM jobs 
WHERE pricing_snapshot IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check pricing snapshot structure
SELECT pricing_snapshot
FROM jobs
WHERE pricing_snapshot IS NOT NULL
LIMIT 1;
```

### Check Subscriptions

```sql
-- Count active subscriptions
SELECT COUNT(*) 
FROM cleaning_subscriptions 
WHERE status = 'active';

-- Check subscriptions due for job creation
SELECT 
  id,
  client_id,
  frequency,
  next_job_date,
  status
FROM cleaning_subscriptions 
WHERE status = 'active' 
  AND next_job_date <= NOW() + INTERVAL '1 day';
```

### Check Earnings Data

```sql
-- Check pending earnings
SELECT 
  user_id,
  COUNT(DISTINCT job_id) as pending_jobs,
  SUM(delta_credits) as pending_credits
FROM credit_ledger
WHERE reason = 'job_release'
  AND job_id IS NOT NULL
  AND delta_credits > 0
  AND NOT EXISTS (
    SELECT 1 FROM payouts p
    WHERE p.cleaner_id = credit_ledger.user_id
      AND p.job_id = credit_ledger.job_id
      AND p.status IN ('paid', 'completed', 'succeeded')
  )
GROUP BY user_id;

-- Check paid out earnings
SELECT 
  cleaner_id,
  COUNT(*) as paid_jobs,
  SUM(amount_credits) as total_credits,
  MAX(created_at) as last_payout
FROM payouts
WHERE status IN ('paid', 'completed', 'succeeded')
GROUP BY cleaner_id;
```

---

## 4. Worker Verification

### Test Subscription Worker Manually

```bash
npm run worker:subscription-jobs
```

**Expected Output**:
```
subscription_jobs_worker_started
subscriptions_to_process { count: X }
subscription_job_created { subscriptionId: X, jobId: Y }
subscription_jobs_worker_completed { created: X, failed: 0 }
```

### Check Worker Logs (Railway)

```bash
railway logs --service subscription-worker
```

Or in Railway dashboard:
1. Go to your project
2. Click on the subscription-worker service
3. View logs

### Verify Jobs Created from Subscriptions

```sql
-- Jobs created in the last hour (from subscriptions)
SELECT 
  j.id,
  j.client_id,
  j.status,
  j.created_at,
  cs.frequency
FROM jobs j
JOIN cleaning_subscriptions cs ON cs.client_id = j.client_id
WHERE j.created_at > NOW() - INTERVAL '1 hour'
ORDER BY j.created_at DESC;
```

---

## 5. Monitoring

### Run Monitoring Script

```bash
# On Unix/Mac
bash scripts/monitor-v3.sh

# On Windows (using Git Bash or WSL)
bash scripts/monitor-v3.sh
```

This script shows:
- Active subscriptions count
- Subscriptions due for job creation
- Jobs with pricing snapshots
- Earnings statistics
- Recent activity

### Set Up Continuous Monitoring

1. **Railway Logs**: Monitor subscription worker logs daily
2. **Database Queries**: Run verification queries weekly
3. **Endpoint Health**: Monitor endpoint response times
4. **Error Tracking**: Watch for errors in logs

---

## 6. Troubleshooting

### Pricing Endpoints Not Working

1. Check route is mounted in `src/index.ts`
2. Verify pricing service exists: `src/services/pricingService.ts`
3. Check authentication token is valid
4. Verify database connection

### Subscriptions Not Creating Jobs

1. Check worker is scheduled and running
2. Verify subscriptions are active and due
3. Check worker logs for errors
4. Verify `createJob` function works

### Earnings Dashboard Returns Error

1. Check credit_ledger has correct columns
2. Verify payouts table structure
3. Check database query syntax
4. Verify cleaner has completed jobs

### Pricing Snapshots Not Stored

1. Verify migration was run: `024_v3_pricing_snapshot.sql`
2. Check column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'pricing_snapshot';`
3. Check job assignment/acceptance flow calls pricing function
4. Check for errors in logs during job assignment

---

## Success Criteria

✅ All verification scripts pass  
✅ All endpoints return expected responses  
✅ Database queries return correct data  
✅ Subscription worker runs successfully  
✅ Pricing snapshots are stored when cleaners assigned  
✅ Earnings dashboard shows correct data  

---

**Last Updated**: 2025-01-15  
**Status**: Ready for Verification

