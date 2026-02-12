# Worker Status & Organization

**Last Updated**: 2025-12-26  
**Total Workers**: 25 (18 active + 7 deprecated)

---

## 📁 Worker Organization

Workers are now organized by version and purpose:

```
src/workers/
├── v1-core/           # V1 baseline workers (5)
├── v2-operations/     # V2 operational workers (6)
├── v3-automation/     # V3 automation workers (1)
├── v4-analytics/      # V4 analytics workers (3)
├── reliability/       # Reliability system workers (3)
├── _deprecated/       # Old/unused workers (7)
├── disabled/          # Intentionally disabled (3)
└── index.ts           # Worker registry
```

---

## ✅ Active Workers

### V1 Core Workers (5 workers)

| Worker | Schedule | Purpose | Status |
|--------|----------|---------|--------|
| `autoCancelJobs.ts` | Hourly | Cancel jobs stuck in pending | ✅ Active |
| `autoExpireAwaitingApproval.ts` | Hourly | Expire jobs awaiting approval | ✅ Active |
| `payoutWeekly.ts` | Weekly (Mon 3 AM) | Process weekly cleaner payouts | ✅ Active |
| `retryFailedNotifications.ts` | Hourly | Retry failed email/SMS | ✅ Active |
| `webhookRetry.ts` | Every 15 min | Retry failed webhooks | ✅ Active |

**Purpose**: Core marketplace operations - job lifecycle, payouts, notifications

---

### V2 Operations Workers (6 workers)

| Worker | Schedule | Purpose | Status |
|--------|----------|---------|--------|
| `creditEconomyMaintenance.ts` | Daily 1 AM | Credit economy health checks | ✅ Active |
| `payoutRetry.ts` | Daily 4 AM | Retry failed payouts | ✅ Active |
| `payoutReconciliation.ts` | Daily 5 AM | Reconcile payout data | ✅ Active |
| `backupDaily.ts` | Daily 2 AM | Database backups | ✅ Active |
| `photoRetentionCleanup.ts` | Weekly (Sun 3 AM) | Clean up old photos | ✅ Active |
| `queueProcessor.ts` | Every 5 min | Process job queue | ✅ Active |

**Purpose**: Operational reliability - economy, payouts, backups, queue

---

### V3 Automation Workers (1 worker)

| Worker | Schedule | Purpose | Status |
|--------|----------|---------|--------|
| `subscriptionJobs.ts` | Daily 2 AM | Generate recurring subscription jobs | ✅ Active |

**Purpose**: Automated job creation for recurring subscriptions

---

### V4 Analytics Workers (3 workers)

| Worker | Schedule | Purpose | Status |
|--------|----------|---------|--------|
| `expireBoosts.ts` | Daily 2 AM | Expire old cleaner boosts | ✅ Active |
| `kpiDailySnapshot.ts` | Daily 3 AM | Create daily KPI snapshots | ✅ Active |
| `weeklySummary.ts` | Weekly (Mon 4 AM) | Generate weekly summary reports | ✅ Active |

**Purpose**: Analytics, reporting, boost management

---

### Reliability Workers (3 workers)

| Worker | Schedule | Purpose | Status |
|--------|----------|---------|--------|
| `reliabilityRecalc.ts` | Daily 1 AM | Recalculate reliability scores | ✅ Active |
| `nightlyScoreRecompute.ts` | Daily 2 AM | Recompute cleaner scores | ✅ Active |
| `cleaningScores.ts` | Daily 3 AM | Update cleaning quality scores | ✅ Active |

**Purpose**: Reliability scoring system maintenance

---

## ⏸️ Intentionally Disabled Workers (3 workers)

**Location**: `disabled/`

| Worker | Reason | Notes |
|--------|--------|-------|
| `cleaningScores.ts` | Duplicate | Active version in `reliability/` |
| `goalChecker.ts` | Not implemented | Feature not yet built |
| `stuckJobDetection.ts` | Replaced | Logic moved to monitoring |

**Purpose**: Kept for reference but not active

---

## ⚠️ Deprecated Workers (7 workers)

**Location**: `_deprecated/`

| Worker | Superseded By | Status |
|--------|---------------|--------|
| `autoPausePayouts.ts` | Manual process | ❌ Unused |
| `goalChecker.ts` | Not implemented | ❌ Unused |
| `kpiSnapshot.ts` | `kpiDailySnapshot.ts` | ❌ Superseded |
| `metricsSnapshot.ts` | `kpiDailySnapshot.ts` | ❌ Superseded |
| `processPayouts.ts` | `payoutWeekly.ts` | ❌ Superseded |
| `retryFailedEvents.ts` | Event system refactor | ❌ Unused |
| `stuckJobDetection.ts` | Moved to monitoring | ❌ Superseded |

**Purpose**: Historical reference only - not imported in `index.ts`

---

## 📋 Worker Schedule Reference

**Quick Reference** (all times UTC):

### Hourly Workers
- `autoCancelJobs` - Every hour
- `autoExpireAwaitingApproval` - Every hour
- `retryFailedNotifications` - Every hour

### Every 15 Minutes
- `webhookRetry` - Every 15 minutes

### Every 5 Minutes
- `queueProcessor` - Every 5 minutes

### Daily Workers (Early Morning)
- 1 AM: `creditEconomyMaintenance`, `reliabilityRecalc`
- 2 AM: `backupDaily`, `subscriptionJobs`, `expireBoosts`, `nightlyScoreRecompute`
- 3 AM: `kpiDailySnapshot`, `cleaningScores`
- 4 AM: `payoutRetry`, `weeklySummary` (Mon only)
- 5 AM: `payoutReconciliation`

### Weekly Workers
- Monday 3 AM: `payoutWeekly`
- Monday 4 AM: `weeklySummary`
- Sunday 3 AM: `photoRetentionCleanup`

**Full Schedule**: See `docs/_active/operations/WORKER_SCHEDULE.md`

---

## 🔧 Running Workers

### Manually Run a Worker
```bash
# V1 Core
npm run worker:auto-cancel
npm run worker:auto-expire
npm run worker:payout-weekly

# V2 Operations
npm run worker:credit-economy
npm run worker:payout-retry
npm run worker:backup-daily

# V3 Automation
npm run worker:subscription-jobs

# V4 Analytics
npm run worker:expire-boosts
npm run worker:kpi-daily
npm run worker:weekly-summary

# Reliability
npm run worker:reliability-recalc
```

### Schedule in Railway
See: `DEPLOY_TO_RAILWAY.md` for Railway cron configuration

---

## 📊 Worker Statistics

| Category | Active | Deprecated | Disabled | Total |
|----------|--------|------------|----------|-------|
| **V1 Core** | 5 | 0 | 0 | 5 |
| **V2 Operations** | 6 | 0 | 0 | 6 |
| **V3 Automation** | 1 | 0 | 0 | 1 |
| **V4 Analytics** | 3 | 0 | 0 | 3 |
| **Reliability** | 3 | 0 | 1 | 4 |
| **Deprecated** | 0 | 7 | 0 | 7 |
| **Disabled** | 0 | 0 | 2 | 2 |
| **TOTAL** | **18** | **7** | **3** | **28** |

---

## ⚙️ Worker Registry

**Location**: `src/workers/index.ts`

The worker registry imports and exports all active workers. It does NOT import deprecated or disabled workers.

**Active Imports**:
```typescript
// V1 Core
export { default as autoCancelJobs } from './v1-core/autoCancelJobs';
export { default as autoExpireAwaitingApproval } from './v1-core/autoExpireAwaitingApproval';
// ... etc

// V2 Operations
export { default as creditEconomyMaintenance } from './v2-operations/creditEconomyMaintenance';
// ... etc

// V3 Automation
export { default as subscriptionJobs } from './v3-automation/subscriptionJobs';

// V4 Analytics
export { default as expireBoosts } from './v4-analytics/expireBoosts';
// ... etc

// Reliability
export { default as reliabilityRecalc } from './reliability/reliabilityRecalc';
// ... etc
```

**Note**: Deprecated and disabled workers are NOT imported in index.ts (as of 2025-02-12). The worker registry imports only from active locations: v1-core, v2-operations, v3-automation, v4-analytics, reliability.

---

## 🚨 Important Notes

### Before Enabling Deprecated Workers:
1. Check if superseded by a newer worker
2. Review code for outdated logic
3. Test in staging first
4. Update worker registry if re-enabling

### Adding New Workers:
1. Place in appropriate version folder
2. Update `index.ts` registry
3. Add npm script in `package.json`
4. Document in `WORKER_SCHEDULE.md`
5. Update this status doc

### Modifying Workers:
1. Check if worker is actually used
2. Test with dry-run script first
3. Update documentation
4. Consider impact on other workers

---

## 📖 Related Documentation

- **Worker Schedule**: `docs/_active/operations/WORKER_SCHEDULE.md`
- **Deployment**: `DEPLOY_TO_RAILWAY.md`
- **Development**: `docs/_active/development/TESTING_GUIDE.md`

---

**Last Updated**: 2025-12-26  
**Status**: ✅ Organized and documented  
**Next Review**: After V5 implementation


