# V3 Implementation Execution Plan

**Date**: 2025-01-15  
**Goal**: Complete all V3 features - make V3_COMPLETE_OVERVIEW.md document true and correct

---

## Current Status Summary

| Feature | Status | Action Required |
|---------|--------|-----------------|
| Smart Match Engine | ✅ 90% Complete | Verify working, minor refinements |
| Tier-Aware Pricing | ❌ 0% Complete | **BUILD FROM SCRATCH** |
| Subscription Engine | ⬜ 80% Complete | **ENABLE (uncomment, move worker)** |
| Earnings Dashboard | ⚠️ 30% Complete | **COMPLETE (build service + endpoint)** |

---

## Task 1: Tier-Aware Pricing (NEW BUILD)

### Step 1.1: Create Pricing Service
**File**: `src/services/pricingService.ts`

**Functions to implement**:
- `calculateJobPricing()` - Calculate tier-based pricing
- `getTierPriceBands()` - Get price ranges per tier
- `createPricingSnapshot()` - Create snapshot for storage

**Tier Price Bands**:
- Bronze: $20-30/hour (floor pricing)
- Silver: $25-35/hour (standard)
- Gold: $30-45/hour (premium)
- Platinum: $35-50/hour (premium)

**Price Calculation**:
```typescript
calculateJobPricing({
  cleanerTier: "gold",
  baseHours: 3,
  cleaningType: "basic"
})
// Returns: {
//   basePrice: 90,
//   tierAdjustment: 15,
//   platformFee: 15.75,  // 15% of total
//   totalPrice: 105.75,
//   priceBreakdown: {...}
// }
```

### Step 1.2: Database Migration
**File**: New migration or add to existing

**Action**: Add `pricing_snapshot` JSONB column to `jobs` table
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;
```

### Step 1.3: Integrate into Job Creation
**File**: `src/services/jobsService.ts`

**Changes**:
- Call `calculateJobPricing()` when creating job
- Store pricing snapshot in `pricing_snapshot` column
- Update `createJob()` function signature if needed

### Step 1.4: Create Pricing Routes
**File**: `src/routes/pricing.ts` (new)

**Routes**:
- `GET /pricing/estimate` - Get price estimate before booking
  - Query params: `tier`, `hours`, `cleaningType`

**Mount**: Add to `src/index.ts`

---

## Task 2: Enable Subscription Engine

### Step 2.1: Enable Routes
**File**: `src/index.ts`

**Action**: Uncomment `premiumRouter`:
```typescript
import premiumRouter from "./routes/premium";
app.use("/premium", premiumRouter);
```

### Step 2.2: Enable Worker
**File**: `src/workers/disabled/subscriptionJobs.ts` → `src/workers/subscriptionJobs.ts`

**Actions**:
1. Move file from `disabled/` to `src/workers/`
2. Update `src/workers/index.ts` to import and schedule
3. Schedule daily (recommended: 2 AM)

### Step 2.3: Test Subscription Flow
- Create subscription
- Verify worker creates jobs
- Test pause/resume/cancel

---

## Task 3: Complete Earnings Dashboard

### Step 3.1: Create Earnings Service
**File**: `src/services/earningsService.ts`

**Function**: `getCleanerEarnings(cleanerId: string)`

**Logic**:
1. **Pending Earnings**: Sum from `credit_ledger` where:
   - `reason = 'job_release'`
   - Not yet paid out (not in `payouts` table)
   - `cleaner_id = cleanerId`

2. **Paid Out**: Sum from `payouts` table where:
   - `cleaner_id = cleanerId`
   - `status = 'completed'`

3. **Next Payout**: 
   - Get payout schedule (from env or config)
   - Calculate next payout date
   - Estimate amount from pending earnings

**Response Format**:
```typescript
{
  pendingEarnings: {
    credits: number;
    usd: number;
    jobs: number;
  };
  paidOut: {
    credits: number;
    usd: number;
    jobs: number;
    lastPayout: Date | null;
  };
  nextPayout: {
    date: Date;
    estimatedCredits: number;
    estimatedUsd: number;
  };
  payoutSchedule: string; // "weekly" | "biweekly" | "monthly"
}
```

### Step 3.2: Add Earnings Endpoint
**File**: `src/routes/cleaner.ts`

**Route**: `GET /cleaner/earnings`

**Action**: Add route that calls `getCleanerEarnings()` and returns formatted response

---

## Task 4: Verify Smart Match Engine

### Step 4.1: Verify Routes Active
**Check**: `src/index.ts` - matchingRouter mounted

### Step 4.2: Test Matching Endpoints
- `GET /matching/jobs/:jobId/candidates`
- `GET /matching/explain/:jobId/:cleanerId`
- Verify admin-only auto-assign works

---

## Implementation Order

1. **Tier-Aware Pricing** (most complex, new build)
   - Create pricing service
   - Add DB migration
   - Integrate into job creation
   - Add pricing routes
   
2. **Enable Subscriptions** (quick win, just enablement)
   - Uncomment routes
   - Move worker
   - Schedule worker
   
3. **Complete Earnings Dashboard** (moderate complexity)
   - Create earnings service
   - Add endpoint
   
4. **Verify Smart Match** (already working)
   - Quick verification test

---

## Testing Checklist

- [ ] Tier-aware pricing calculates correctly for each tier
- [ ] Pricing snapshot stored in jobs table
- [ ] Pricing routes return correct estimates
- [ ] Subscription routes work (create, get, pause, resume, cancel)
- [ ] Subscription worker creates jobs correctly
- [ ] Earnings dashboard shows correct pending/paid amounts
- [ ] Earnings dashboard calculates next payout correctly
- [ ] Smart match endpoints return ranked candidates

---

## Success Criteria

✅ All 4 V3 features implemented and working  
✅ V3_COMPLETE_OVERVIEW.md document is accurate  
✅ All routes mounted and accessible  
✅ All services functional  
✅ Database schema updated  

---

**Ready to implement!**

