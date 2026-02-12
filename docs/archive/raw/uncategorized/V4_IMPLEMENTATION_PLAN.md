# V4 Implementation Plan

**Date**: 2025-01-15  
**Status**: 🚧 **IN PROGRESS**

---

## Implementation Strategy

V4 features are already implemented but disabled. We need to:
1. Enable existing routes (analytics, manager)
2. Enable existing workers (expireBoosts, kpiDailySnapshot, weeklySummary)
3. Integrate boost multiplier into matching service
4. Build risk service (not yet implemented)
5. Update documentation

---

## Step 1: Enable Routes

### Analytics Router
- **File**: `src/index.ts`
- **Change**: Uncomment `import analyticsRouter` and `app.use("/analytics", analyticsRouter)`
- **Status**: ✅ Ready to enable

### Manager Router
- **File**: `src/index.ts`
- **Change**: Uncomment `import managerRouter` and `app.use("/manager", managerRouter)`
- **Status**: ✅ Ready to enable

### Premium Router
- **Status**: ✅ Already enabled (was enabled for V3 subscriptions)
- **Note**: Boosts, rush jobs, and referrals are already accessible via `/premium/*`

---

## Step 2: Enable Workers

### Workers to Move from `disabled/` to Active:
1. **expireBoosts.ts** → Move to `src/workers/`
2. **kpiDailySnapshot.ts** → Move to `src/workers/`
3. **weeklySummary.ts** → Move to `src/workers/`

### Update imports in `src/workers/index.ts`:
- Change `from "./disabled/expireBoosts"` → `from "./expireBoosts"`
- Change `from "./disabled/kpiDailySnapshot"` → `from "./kpiDailySnapshot"`
- Change `from "./disabled/weeklySummary"` → `from "./weeklySummary"`

**Status**: ✅ Workers exist, need to move and update imports

---

## Step 3: Integrate Boost Multiplier into Matching

### Location: `src/services/jobMatchingService.ts`

**Current**: Match score calculation in `calculateMatchScore()` function  
**Change**: Apply boost multiplier to final score

**Implementation**:
1. Import `getBoostMultiplier` from `premiumService`
2. In `findMatchingCleaners()`, fetch boost multiplier for each cleaner
3. Apply multiplier to final score (with cap to prevent domination)
4. Update score calculation to multiply by boost multiplier (capped at reasonable max)

**Formula**: `finalScore = baseScore * min(boostMultiplier, 1.5)` (cap at 1.5x to prevent unfairness)

**Status**: ⚠️ Need to integrate

---

## Step 4: Build Risk Service

### New File: `src/services/riskService.ts`

**Features to implement**:
1. `calculateRiskScore(userId: string, userRole: "client" | "cleaner"): Promise<number>`
   - Factors: cancellation rate, payment failures, disputes, suspicious patterns
   - Return score 0-100 (higher = more risk)

2. `calculateRiskFlags(userId: string, userRole: "client" | "cleaner"): Promise<RiskFlag[]>`
   - Generate flags based on risk score
   - Flags: HIGH_CANCELLATION_RATE, PAYMENT_FAILURES, REPEATED_DISPUTES, SUSPICIOUS_BOOKING_PATTERN
   - Store in `risk_flags` table (if exists)

3. `getUserRiskProfile(userId: string): Promise<RiskProfile>`
   - Get risk score, flags, and history

**Database Tables Needed**:
- `risk_scores` - Store calculated risk scores
- `risk_flags` - Store active flags

**Status**: ⚠️ Needs to be built (no existing file found)

---

## Step 5: Add Risk Review Endpoint

### Location: `src/routes/admin.ts`

**New Endpoint**: `GET /admin/risk/review`
- List flagged users requiring review
- Show risk score, flags, and evidence
- Admin can clear flags manually

**Status**: ⚠️ Needs to be added

---

## Step 6: Database Migrations

### Check for Required Tables:
- `cleaner_boosts` - Already exists (for boosts)
- `kpi_daily_snapshots` - Check if exists (for analytics)
- `kpi_weekly_summaries` - Check if exists (for analytics)
- `risk_scores` - Need to create if doesn't exist
- `risk_flags` - Need to create if doesn't exist

**Status**: ⚠️ Need to verify/create

---

## Summary

### ✅ Already Complete:
- Premium routes (boosts, rush, referrals) - Enabled
- Premium service implementation
- Analytics service implementation
- Manager dashboard service implementation
- Worker implementations (expireBoosts, kpiDailySnapshot, weeklySummary)

### 🔧 Need to Do:
1. Enable analytics and manager routes
2. Move workers from disabled/ to active
3. Integrate boost multiplier into matching
4. Build risk service
5. Add risk review endpoint
6. Verify/create database tables

---

**Next Steps**: Execute implementation plan

