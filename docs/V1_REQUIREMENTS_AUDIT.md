# 🚨 V1 Requirements Audit - Critical Market Safety Features

**Status**: ⚠️ **CRITICAL FEATURES DISABLED** - Must be enabled before V1 launch

This document audits what must be enabled for V1 production. These are **non-negotiable** market safety mechanisms, not "nice-to-have" features.

---

## ✅ What's Already Implemented (But Disabled)

### 1. Reliability Scoring System
**Status**: ✅ Code exists | ❌ Marked as "V2 FEATURE — DISABLED FOR NOW"

**Location**: `src/services/reliabilityService.ts`

**What it does**:
- Computes reliability scores (0-100) from:
  - Cancellations (up to -40 points)
  - Disputes (up to -30 points)
  - Ratings (-10 to +10 points)
  - Completion rate (+10 points)
  - Photo compliance (+10 points)
- Determines tier based on score:
  - Platinum: 95+
  - Gold: 85+
  - Silver: 70+
  - Bronze: <70
- Tier lock protection (7-day lock after promotion)
- Reliability history tracking

**Currently disabled because**:
- File header says "V2 FEATURE — DISABLED FOR NOW"
- Endpoint `/cleaner/reliability` is commented out

**V1 Requirement**: ✅ **MUST BE ENABLED** - Cleaner pay tied to reliability score + tier

---

### 2. Payout Percentage by Tier
**Status**: ✅ Partially implemented | ⚠️ Needs reliability integration

**Location**: `src/services/payoutsService.ts::getCleanerPayoutPercent()`

**What it does**:
- Returns payout percentage based on tier:
  - Bronze: 80%
  - Silver: 82%
  - Gold: 84%
  - Platinum: 85%

**Current issue**:
- ✅ Tiers exist
- ✅ Payouts use tier percentage
- ⚠️ Tier must come from reliability score (reliability → tier → payout %)
- ⚠️ Need to ensure tier is updated when reliability changes

**V1 Requirement**: ✅ **MUST WORK** - Cleaner pay tied to reliability score + tier

---

### 3. Availability, Time-Off, Service Areas
**Status**: ✅ Fully implemented and enabled

**Location**: `src/services/availabilityService.ts`

**What it does**:
- Cleaner availability by day of week
- Time-off management
- Service area management (zip codes)
- Availability checking for job matching

**V1 Requirement**: ✅ **WORKING** - No action needed

---

### 4. Cancellation / Reschedule / No-Show Policy
**Status**: ✅ Fully implemented

**Location**: `src/services/creditEconomyService.ts`

**What it does**:
- **Client cancellations**:
  - >48 hours: 0% fee (free)
  - 24-48 hours: 50% fee
  - <24 hours: 100% fee
  - 2 lifetime grace cancellations
- **Cleaner cancellations**:
  - Full refund to client
  - Reliability penalty (10-25 points depending on timing)
- **No-show**:
  - Full refund + 50 bonus credits to client
  - 25-point reliability penalty to cleaner

**V1 Requirement**: ✅ **WORKING** - No action needed

---

### 5. Reliability Scoring, Penalties, Decay
**Status**: ✅ Code exists | ❌ Workers disabled

**Location**: 
- Scoring: `src/services/reliabilityService.ts`
- Decay: `src/services/creditEconomyService.ts::applyReliabilityDecay()`
- Workers: `src/workers/disabled/reliabilityRecalc.ts`, `src/workers/disabled/creditEconomyMaintenance.ts`

**What it does**:
- Reliability score calculation (see #1)
- Penalties for cancellations, no-shows, disputes
- Decay: -2 points per week after 2 weeks inactive (min 50)

**Currently disabled because**:
- Workers in `disabled/` folder
- Reliability decay not scheduled

**V1 Requirement**: ✅ **MUST BE ENABLED** - Reliability scoring, penalties, decay

---

### 6. Client Selects Top 3 Cleaners (Not Auto-Assign)
**Status**: ⚠️ **INCORRECT IMPLEMENTATION** - Has auto-assign, needs top 3 selection

**Location**: `src/services/jobMatchingService.ts`

**What it currently does**:
- `findMatchingCleaners()` finds cleaners
- Has `autoAssign` option that auto-assigns best match
- Has `job_offers` table for offers
- Has `acceptJobOffer()` for cleaner acceptance

**What V1 needs**:
- Client gets top 3-5 cleaner recommendations
- Client selects which cleaners to offer the job to
- Selected cleaners get job offers
- First cleaner to accept gets the job

**Current gap**:
- No endpoint for client to select cleaners
- No endpoint to send offers to selected cleaners
- Auto-assign is the default behavior

**V1 Requirement**: ✅ **MUST BE IMPLEMENTED** - Client selects top 3 cleaners

---

### 7. Cleaner Acceptance Flow
**Status**: ✅ Partially implemented

**Location**: `src/services/jobMatchingService.ts::acceptJobOffer()`

**What it does**:
- Cleaners can accept job offers
- Expired offers are rejected
- First acceptance wins (other offers expire)

**V1 Requirement**: ✅ **MOSTLY WORKING** - Needs integration with top 3 selection

---

### 8. Protection of Top-Tier Cleaners
**Status**: ✅ Implemented

**Location**: 
- Tier locks: `src/services/creditEconomyService.ts`
- Wave-based matching: `src/services/jobMatchingService.ts::getWaveEligibleCleaners()`

**What it does**:
- Tier locks prevent demotion within 7 days of promotion
- Wave-based matching prioritizes top tiers (platinum/gold first)

**V1 Requirement**: ✅ **WORKING** - No action needed

---

### 9. Clear Economic Rules (Escrow, Approval, Refunds)
**Status**: ✅ Fully implemented

**Location**: 
- Escrow: `src/services/creditsService.ts::escrowCreditsWithTransaction()`
- Approval: `src/services/jobTrackingService.ts::approveJob()`
- Refunds: `src/services/creditsService.ts::refundJobCreditsToClient()`

**What it does**:
- Credits escrowed on job creation
- Credits released to cleaner on approval
- Refunds on cancellation (with fees per policy)

**V1 Requirement**: ✅ **WORKING** - No action needed

---

## 🔧 Required Actions for V1

### Priority 1: Enable Reliability System

1. **Remove V2 markers from reliability service**
   - [ ] Remove "V2 FEATURE — DISABLED FOR NOW" comment from `src/services/reliabilityService.ts`
   - [ ] Enable `/cleaner/reliability` endpoint in `src/routes/cleaner.ts`

2. **Enable reliability workers**
   - [ ] Move `src/workers/disabled/reliabilityRecalc.ts` to `src/workers/reliabilityRecalc.ts`
   - [ ] Move `src/workers/disabled/creditEconomyMaintenance.ts` to `src/workers/creditEconomyMaintenance.ts`
   - [ ] Update `src/workers/index.ts` to import from correct location
   - [ ] Schedule workers:
     - `reliabilityRecalc`: Nightly at 3 AM
     - `creditEconomyMaintenance`: Weekly (reliability decay)

3. **Ensure payout uses reliability-based tier**
   - [ ] Verify `getCleanerPayoutPercent()` uses tier from `cleaner_profiles.tier`
   - [ ] Verify tier is updated when reliability changes (already happens in `updateCleanerReliability()`)
   - [ ] Test that payout percentage changes when tier changes

---

### Priority 2: Implement Top 3 Cleaner Selection

1. **Create client selection endpoint**
   - [ ] `GET /jobs/:jobId/candidates` - Get top 5-10 matched cleaners
   - [ ] `POST /jobs/:jobId/offer` - Client selects cleaners to offer job to (array of cleaner IDs)

2. **Update job creation flow**
   - [ ] After job creation, return candidates (don't auto-assign)
   - [ ] Wait for client to select cleaners
   - [ ] Send offers to selected cleaners
   - [ ] First acceptance wins

3. **Remove auto-assign as default**
   - [ ] Set `autoAssign: false` as default in `findMatchingCleaners()`
   - [ ] Only auto-assign if explicitly requested (admin/emergency)

---

### Priority 3: Testing & Verification

1. **Test reliability → tier → payout flow**
   - [ ] Create cleaner with different reliability scores
   - [ ] Verify tier calculation
   - [ ] Verify payout percentage matches tier
   - [ ] Test tier promotion/demotion
   - [ ] Test tier lock protection

2. **Test top 3 selection flow**
   - [ ] Create job
   - [ ] Get candidate cleaners
   - [ ] Client selects top 3
   - [ ] Offers sent
   - [ ] First acceptance wins

3. **Test cancellation/reschedule/no-show policies**
   - [ ] Test all cancellation scenarios (timing-based fees)
   - [ ] Test no-show handling
   - [ ] Test reliability penalties

---

## 📊 Current Status Summary

| Feature | Status | Action Required |
|---------|--------|-----------------|
| Reliability Scoring | ❌ Disabled | Remove V2 markers, enable endpoint |
| Tier-based Payout | ⚠️ Partial | Verify reliability → tier flow |
| Availability/Time-off | ✅ Enabled | None |
| Cancellation Policy | ✅ Enabled | None |
| Reliability Penalties | ✅ Enabled | None |
| Reliability Decay | ❌ Worker disabled | Enable worker, schedule |
| Top 3 Selection | ❌ Not implemented | Implement selection flow |
| Cleaner Acceptance | ✅ Enabled | Integrate with top 3 |
| Tier Protection | ✅ Enabled | None |
| Economic Rules | ✅ Enabled | None |

---

## 🎯 V1 Launch Blockers

**MUST BE FIXED BEFORE LAUNCH**:
1. ❌ Reliability system enabled (scoring, tier calculation, workers)
2. ❌ Top 3 cleaner selection implemented (not auto-assign)
3. ❌ Payout percentage verified to use reliability-based tier

**RECOMMENDED BEFORE LAUNCH**:
1. ✅ All cancellation policies working
2. ✅ Reliability penalties working
3. ✅ Tier protection working

---

## 📝 Next Steps

1. **Immediate**: Enable reliability system (remove V2 markers, enable workers)
2. **High Priority**: Implement top 3 cleaner selection flow
3. **Verification**: Test entire reliability → tier → payout flow
4. **Documentation**: Update `CAPABILITIES.md` to reflect V1 features correctly

---

**Last Updated**: 2025-12-14  
**Priority**: 🚨 **CRITICAL** - These features are non-negotiable for V1 launch

