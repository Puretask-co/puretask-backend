# V4 Deployment Verification Guide

**Date**: 2025-01-15  
**Status**: ✅ Ready for Deployment

---

## ✅ Quick Verification Checklist

- [x] Database tables exist (cleaner_boosts, kpi_snapshots, referral_codes)
- [x] Routes mounted in src/index.ts
- [x] Workers moved to active directory
- [x] Boost multiplier integrated into matching
- [x] Risk service created
- [ ] Endpoints tested (run test suite)
- [ ] Workers scheduled (if needed)

---

## 1. Automated Verification

### Run Deployment Verification Script

```bash
npm run verify:v4
```

This script checks:
- ✅ `cleaner_boosts` table exists
- ✅ `kpi_snapshots` table exists
- ✅ `referral_codes` table exists
- ✅ Active boosts count
- ✅ KPI snapshots count
- ✅ Active referral codes count

### Test All Endpoints

```bash
npm run test:v4-endpoints
```

Or run full integration tests:

```bash
npm run test:integration -- src/tests/integration/v4Features.test.ts
```

---

## 2. Manual Verification

### Check Routes are Mounted

Verify in `src/index.ts`:

```typescript
// Should see:
import analyticsRouter from "./routes/analytics";
import managerRouter from "./routes/manager";

// Should see:
app.use("/analytics", analyticsRouter);
app.use("/manager", managerRouter);
app.use("/premium", premiumRouter); // Already enabled for V3
```

### Check Workers are Active

Verify in `src/workers/index.ts`:

```typescript
// Should see imports from active directory (not disabled/):
import { runExpireBoosts } from "./expireBoosts";
import { runKpiDailySnapshot } from "./kpiDailySnapshot";
import { runWeeklySummary } from "./weeklySummary";
```

### Check Boost Integration

Verify in `src/services/jobMatchingService.ts`:

- Should import `getBoostMultiplier` from premiumService
- Should apply boost multiplier to match scores
- Should add boost info to match reasons

### Check Risk Service

Verify `src/services/riskService.ts` exists with:
- `calculateRiskScore()` function
- `calculateRiskFlags()` function
- `getUserRiskProfile()` function
- `getRiskReviewQueue()` function

Verify `src/routes/admin.ts` has risk endpoints:
- `GET /admin/risk/review`
- `GET /admin/risk/:userId`

---

## 3. Endpoint Testing

### Analytics Endpoints (Admin Only)

```bash
# Dashboard metrics
curl -X GET "http://localhost:3000/analytics/dashboard?timeRange=month" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"

# Revenue trend
curl -X GET "http://localhost:3000/analytics/revenue/trend?timeRange=month" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"

# Job trend
curl -X GET "http://localhost:3000/analytics/jobs/trend?timeRange=month" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"
```

### Manager Dashboard Endpoints (Admin Only)

```bash
# Overview
curl -X GET "http://localhost:3000/manager/overview" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"

# Alerts
curl -X GET "http://localhost:3000/manager/alerts" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"

# Heatmap
curl -X GET "http://localhost:3000/manager/heatmap" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"
```

### Boost Endpoints (Cleaner)

```bash
# Get boost options
curl -X GET "http://localhost:3000/premium/boosts/options" \
  -H "x-user-id: CLEANER_USER_ID" \
  -H "x-user-role: cleaner"

# Get active boost
curl -X GET "http://localhost:3000/premium/boosts/active" \
  -H "x-user-id: CLEANER_USER_ID" \
  -H "x-user-role: cleaner"

# Purchase boost
curl -X POST "http://localhost:3000/premium/boosts/purchase" \
  -H "Content-Type: application/json" \
  -H "x-user-id: CLEANER_USER_ID" \
  -H "x-user-role: cleaner" \
  -d '{"boostType": "STANDARD"}'
```

### Risk Endpoints (Admin Only)

```bash
# Get risk review queue
curl -X GET "http://localhost:3000/admin/risk/review" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"

# Get user risk profile
curl -X GET "http://localhost:3000/admin/risk/USER_ID?role=client" \
  -H "x-user-id: ADMIN_USER_ID" \
  -H "x-user-role: admin"
```

---

## 4. Worker Scheduling

### Recommended Schedule

If using cron (e.g., on Railway or similar):

```bash
# Expire boosts daily at 2 AM
0 2 * * * cd /app && npm run worker:expire-boosts

# KPI daily snapshot at 3 AM
0 3 * * * cd /app && npm run worker:kpi-daily

# Weekly summary on Mondays at 4 AM
0 4 * * 1 cd /app && npm run worker:weekly-summary
```

### Manual Worker Runs

For testing or immediate execution:

```bash
# Expire boosts
npm run worker:expire-boosts

# KPI snapshot
npm run worker:kpi-daily

# Weekly summary
npm run worker:weekly-summary
```

---

## 5. Database Verification Queries

### Check Active Boosts

```sql
SELECT COUNT(*) as active_boosts
FROM cleaner_boosts
WHERE status = 'active'
  AND expires_at > NOW();
```

### Check KPI Snapshots

```sql
SELECT COUNT(*) as snapshot_count,
       MAX(created_at) as latest_snapshot
FROM kpi_snapshots;
```

### Check Referral Codes

```sql
SELECT COUNT(*) as active_codes
FROM referral_codes
WHERE is_active = true;
```

### Check Boost Purchases

```sql
SELECT 
  boost_type,
  COUNT(*) as count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
FROM cleaner_boosts
GROUP BY boost_type;
```

---

## 6. Monitoring

### Check Application Logs

Look for:
- Analytics endpoint calls
- Boost purchase events
- Risk score calculations
- Worker execution logs

### Monitor Metrics

- Boost purchase rate
- Analytics dashboard usage
- Risk flag creation rate
- Worker execution success rate

---

## 7. Rollback Plan

If issues are found:

1. **Disable Routes** (in `src/index.ts`):
   ```typescript
   // Comment out:
   // app.use("/analytics", analyticsRouter);
   // app.use("/manager", managerRouter);
   ```

2. **Disable Workers** (move back to disabled/):
   ```bash
   git mv src/workers/expireBoosts.ts src/workers/disabled/
   git mv src/workers/kpiDailySnapshot.ts src/workers/disabled/
   git mv src/workers/weeklySummary.ts src/workers/disabled/
   ```

3. **Remove Boost Integration** (in `src/services/jobMatchingService.ts`):
   - Remove boost multiplier import
   - Remove boost multiplier application in matching

---

## 8. Success Criteria

✅ All verification checks pass  
✅ Database tables exist and accessible  
✅ Routes respond with expected status codes  
✅ Workers execute without errors  
✅ No critical errors in logs  
✅ Boost multiplier applies correctly in matching  
✅ Risk scoring calculates correctly  

---

## Next Steps After Deployment

1. Monitor error rates for 24-48 hours
2. Check worker execution logs
3. Verify analytics data is being collected
4. Test boost purchases end-to-end
5. Review risk flag generation
6. Schedule regular KPI snapshots

---

**Last Updated**: 2025-01-15

