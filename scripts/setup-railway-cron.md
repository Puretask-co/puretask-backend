# Railway Cron Job Setup for V3 Subscription Worker

This guide explains how to set up the subscription worker as a scheduled cron job on Railway.

---

## Option 1: Railway Cron Service (Recommended)

Railway supports cron jobs through scheduled services. Here's how to set it up:

### Steps:

1. **Create a new service in Railway**:
   - Go to your Railway project
   - Click "New" → "GitHub Repo" (or "Empty Service")
   - Name it: `subscription-worker`

2. **Configure the service**:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `node dist/workers/subscriptionJobs.js`
   - **Root Directory**: `/` (root of your repo)

3. **Set up the schedule**:
   - In Railway, go to the service settings
   - Look for "Cron Schedule" or "Scheduled Tasks"
   - Set schedule to: `0 2 * * *` (runs daily at 2 AM UTC)
   - OR use Railway's cron syntax

4. **Environment Variables**:
   - Copy all required env vars from your main backend service
   - Especially: `DATABASE_URL`, `STRIPE_SECRET_KEY`, etc.

---

## Option 2: Railway CLI Cron (if supported)

If Railway CLI supports cron configuration, you can add this to `railway.toml`:

```toml
[service.subscription-worker]
buildCommand = "npm ci && npm run build"
startCommand = "node dist/workers/subscriptionJobs.js"
schedule = "0 2 * * *"  # Daily at 2 AM UTC
```

---

## Option 3: Separate Worker Service with Railway Cron

Create a separate service that runs on a schedule:

1. **Service Configuration**:
   - Name: `subscription-jobs-worker`
   - Same build process as main service
   - Start command: `node dist/workers/subscriptionJobs.js`

2. **Use Railway's Cron Feature**:
   - In Railway dashboard, configure the service to run on schedule
   - Schedule: Daily at 2:00 AM UTC (`0 2 * * *`)

---

## Option 4: Internal Scheduler (Alternative)

If Railway doesn't support cron directly, you can use an internal scheduler in your main app:

Add to `src/index.ts` (after server starts):

```typescript
import cron from 'node-cron';
import { runSubscriptionJobs } from './workers/subscriptionJobs';

// Schedule subscription jobs worker to run daily at 2 AM UTC
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 2 * * *', async () => {
    logger.info('subscription_jobs_scheduled_run');
    try {
      await runSubscriptionJobs();
    } catch (error) {
      logger.error('subscription_jobs_scheduled_failed', { error });
    }
  });
  logger.info('subscription_jobs_scheduler_enabled');
}
```

**Note**: This requires installing `node-cron`: `npm install node-cron @types/node-cron`

---

## Verification

After setting up the cron job:

1. **Check logs**:
   ```bash
   railway logs --service subscription-worker
   ```

2. **Manual test run**:
   ```bash
   npm run worker:subscription-jobs
   ```

3. **Verify jobs created**:
   ```sql
   SELECT COUNT(*) 
   FROM jobs j
   JOIN cleaning_subscriptions cs ON cs.client_id = j.client_id
   WHERE j.created_at > NOW() - INTERVAL '1 hour';
   ```

---

## Recommended Schedule

- **Daily at 2:00 AM UTC** (`0 2 * * *`)
  - Runs before matching/assignment processes
  - Low traffic time
  - Ensures subscription jobs are created for the day

---

## Troubleshooting

### Worker Not Running

1. Check Railway logs for errors
2. Verify environment variables are set
3. Test worker manually: `npm run worker:subscription-jobs`
4. Check database connection

### Jobs Not Being Created

1. Check for active subscriptions:
   ```sql
   SELECT * FROM cleaning_subscriptions WHERE status = 'active';
   ```

2. Check if subscriptions are due:
   ```sql
   SELECT * FROM cleaning_subscriptions 
   WHERE status = 'active' 
   AND next_job_date <= NOW() + INTERVAL '1 day';
   ```

3. Check worker logs for errors

---

**Last Updated**: 2025-01-15

