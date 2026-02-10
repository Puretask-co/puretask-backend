# ⏰ Worker Schedule - V1/V2/V3 Production

Recommended cron schedule for all background workers in production.

---

## 🔄 Active Workers

### V1 Core Workers

### 1. **Reliability Recalculation** (`reliabilityRecalc`)
**Purpose**: Recalculate all cleaner reliability scores nightly  
**Frequency**: Daily  
**Recommended Time**: 3:00 AM UTC  
**Command**: `npm run worker:reliability-recalc` or `node dist/workers/reliabilityRecalc.js`

```cron
# Daily at 3 AM UTC
0 3 * * * cd /app && npm run worker:reliability-recalc
```

---

### 2. **Credit Economy Maintenance** (`creditEconomyMaintenance`)
**Purpose**: Apply reliability decay, cleanup tier locks, check fraud alerts  
**Frequency**: Daily  
**Recommended Time**: 4:00 AM UTC (after reliability recalc)  
**Command**: `npm run worker:credit-economy` or `node dist/workers/creditEconomyMaintenance.js`

```cron
# Daily at 4 AM UTC
0 4 * * * cd /app && npm run worker:credit-economy
```

---

### 3. **Auto-Cancel Jobs** (`autoCancelJobs`)
**Purpose**: Auto-cancel jobs past scheduled start time  
**Frequency**: Every 15 minutes  
**Recommended Time**: Continuous  
**Command**: `npm run worker:auto-cancel` or `node dist/workers/autoCancelJobs.js`

```cron
# Every 15 minutes
*/15 * * * * cd /app && npm run worker:auto-cancel
```

---

### 4. **Auto-Expire Awaiting Approval** (`autoExpireAwaitingApproval`)
**Purpose**: Auto-expire jobs awaiting approval after 7 days  
**Frequency**: Daily  
**Recommended Time**: 5:00 AM UTC  
**Command**: `npm run worker:auto-expire` or `node dist/workers/autoExpireAwaitingApproval.js`

```cron
# Daily at 5 AM UTC
0 5 * * * cd /app && npm run worker:auto-expire
```

---

### 5. **Weekly Payouts** (`payoutWeekly`)
**Purpose**: Create weekly payout batches  
**Frequency**: Weekly (Monday mornings)  
**Recommended Time**: Monday 6:00 AM UTC  
**Command**: `npm run worker:payout-weekly` or `node dist/workers/payoutWeekly.js`

```cron
# Every Monday at 6 AM UTC
0 6 * * 1 cd /app && npm run worker:payout-weekly
```

---

### 6. **KPI Snapshot** (`kpiSnapshot`)
**Purpose**: Daily KPI snapshot for business metrics  
**Frequency**: Daily  
**Recommended Time**: 1:00 AM UTC (after day ends)  
**Command**: `npm run worker:kpi-daily` or `node dist/workers/kpiDailySnapshot.js`

```cron
# Daily at 1 AM UTC
0 1 * * * cd /app && npm run worker:kpi-daily
```

---

### 7. **Retry Failed Notifications** (`retryFailedNotifications`)
**Purpose**: Retry failed email/SMS/push notifications  
**Frequency**: Every 15 minutes  
**Recommended Time**: Continuous  
**Command**: `npm run worker:retry-notifications` or `node dist/workers/retryFailedNotifications.js`

```cron
# Every 15 minutes
*/15 * * * * cd /app && npm run worker:retry-notifications
```

---

### 8. **Daily Backup** (`backupDaily`)
**Purpose**: Daily database backup  
**Frequency**: Daily  
**Recommended Time**: 12:00 AM UTC  
**Command**: `npm run worker:backup-daily` or `node dist/workers/backupDaily.js`

```cron
# Daily at midnight UTC
0 0 * * * cd /app && npm run worker:backup-daily
```

---

## 🔄 V2 Workers

### 9. **Cleaning Scores** (`cleaningScores`)
**Purpose**: Recalculate cleaning scores for properties  
**Frequency**: Daily  
**Recommended Time**: 2:00 AM UTC  
**Command**: `npm run worker:cleaning-scores` or `node dist/workers/cleaningScores.js`

```cron
# Daily at 2 AM UTC
0 2 * * * cd /app && npm run worker:cleaning-scores
```

---

### 10. **Goal Checker** (`goalChecker`)
**Purpose**: Check and award cleaner goals  
**Frequency**: Daily  
**Recommended Time**: 3:30 AM UTC  
**Command**: `npm run worker:goal-checker` or `node dist/workers/goalChecker.js`

```cron
# Daily at 3:30 AM UTC
30 3 * * * cd /app && npm run worker:goal-checker
```

---

### 11. **Stuck Job Detection** (`stuckJobDetection`)
**Purpose**: Detect and alert on stuck jobs, payouts, and system issues  
**Frequency**: Every 30 minutes  
**Recommended Time**: Continuous  
**Command**: `npm run worker:stuck-detection` or `node dist/workers/stuckJobDetection.js`

```cron
# Every 30 minutes
*/30 * * * * cd /app && npm run worker:stuck-detection
```

---

## 🔄 V3 Workers

### 12. **Subscription Jobs** (`subscriptionJobs`)
**Purpose**: Generate jobs from active subscriptions  
**Frequency**: Daily  
**Recommended Time**: 2:00 AM UTC  
**Command**: `npm run worker:subscription-jobs` or `node dist/workers/subscriptionJobs.js`

```cron
# Daily at 2 AM UTC
0 2 * * * cd /app && npm run worker:subscription-jobs
```

**Note**: This worker should run before the matching/assignment process to ensure subscription jobs are created in time.

---

## 📋 Complete Cron Schedule

```cron
# V1/V2/V3 Production Worker Schedule

# Every 15 minutes
*/15 * * * * cd /app && npm run worker:auto-cancel
*/15 * * * * cd /app && npm run worker:retry-notifications

# Every 30 minutes
*/30 * * * * cd /app && npm run worker:stuck-detection

# Daily (UTC)
0 0 * * * cd /app && npm run worker:backup-daily
0 1 * * * cd /app && npm run worker:kpi-daily
0 2 * * * cd /app && npm run worker:cleaning-scores
0 2 * * * cd /app && npm run worker:subscription-jobs
0 3 * * * cd /app && npm run worker:reliability-recalc
30 3 * * * cd /app && npm run worker:goal-checker
0 4 * * * cd /app && npm run worker:credit-economy
0 5 * * * cd /app && npm run worker:auto-expire

# Weekly
0 6 * * 1 cd /app && npm run worker:payout-weekly
```

---

## 🚀 Railway Deployment

For Railway, use the **Cron Jobs** feature or create separate worker services:

### Option 1: Single Worker Service with Cron
Create a worker service that runs all workers on schedule using `node dist/workers/index.js <worker-name>`

### Option 2: Separate Worker Services
Create individual services for each worker type with their own schedules.

### Option 3: Railway Cron Jobs
Use Railway's built-in cron job feature to schedule individual workers.

---

## 📊 Worker Priority

**Critical (Must Run)**:
- ✅ `reliabilityRecalc` - Market safety
- ✅ `creditEconomyMaintenance` - Market safety
- ✅ `autoCancelJobs` - User experience
- ✅ `payoutWeekly` - Financial operations
- ✅ `subscriptionJobs` - V3 Feature (subscription fulfillment)

**Important**:
- ✅ `autoExpireAwaitingApproval` - User experience
- ✅ `retryFailedNotifications` - User communication
- ✅ `stuckJobDetection` - System health
- ✅ `cleaningScores` - V2 Feature (property scoring)
- ✅ `goalChecker` - V2 Feature (cleaner goals)

**Maintenance**:
- ✅ `kpiSnapshot` - Business metrics
- ✅ `backupDaily` - Data safety

---

## 🔍 Monitoring

Monitor worker execution via:
- `worker_runs` table (tracks all worker executions)
- Application logs (structured JSON logging)
- Railway logs (if deployed on Railway)

**Key Metrics**:
- Worker execution time
- Success/failure rate
- Records processed
- Errors encountered

---

## ⚠️ Notes

1. **Timezone**: All times are UTC. Adjust for your timezone if needed.
2. **Concurrency**: Workers use advisory locks - safe to run multiple instances
3. **Error Handling**: Workers log errors and continue (non-fatal)
4. **Resource Usage**: Spread workers across different times to avoid resource spikes
5. **Testing**: Test workers in staging before production deployment
6. **V3 Subscription Jobs**: Must run daily before jobs are matched/assigned to ensure subscription jobs are created

---

**Last Updated**: 2025-01-15  
**Status**: Ready for V1/V2/V3 production deployment
