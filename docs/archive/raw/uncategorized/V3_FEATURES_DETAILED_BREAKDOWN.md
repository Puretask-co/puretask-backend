# V3 Features - Complete Detailed Breakdown

**Status**: ⚠️ **PARTIALLY IMPLEMENTED** - Some features exist but are disabled or incomplete

**Goal**: Scale volume without scaling ops headcount. Add smart matching (suggestions only), tier-aware pricing, and simple subscriptions.

**Prerequisite**: V2 stable for 2-4 weeks. Reliability scores trusted. Disputes manageable.

---

## 📋 Table of Contents

1. [Routes Status](#routes-status)
2. [Services Implemented But Not Used](#services-implemented-but-not-used)
3. [Disabled Workers](#disabled-workers)
4. [Feature Categories](#feature-categories)
   - [1. Smart Match Engine (Suggestions Only)](#1-smart-match-engine-suggestions-only)
   - [2. Tier-Aware Pricing](#2-tier-aware-pricing)
   - [3. Subscription Engine](#3-subscription-engine)
   - [4. Cleaner Wallet UX / Earnings Dashboard](#4-cleaner-wallet-ux--earnings-dashboard)

---

## Routes Status

### Current Status

**V3 Routes**: Mixed - Some routes exist and are mounted, others are disabled

#### ✅ Mounted Routes (Active)

**File**: `src/routes/matching.ts` (295 lines, **ACTIVE**)

- `GET /matching/jobs/:jobId/candidates` - Get ranked cleaner candidates
- `POST /matching/jobs/:jobId/auto-assign` - Auto-assign best cleaner (admin only)
- `GET /matching/jobs/:jobId/history` - Get match history for a job
- `GET /matching/explain/:jobId/:cleanerId` - Explain a match score

**Note**: These routes are **mounted and active**, but V3 plan specifies "suggestions only" - auto-assign should be disabled or admin-only (which it is).

#### ⬜ Disabled Routes

**File**: `src/routes/premium.ts` (314 lines, **DISABLED**)

**Status**: Routes exist but router is commented out in `src/index.ts`

```typescript
// V2 FEATURE — DISABLED FOR NOW (goals/boosts/subscriptions)
// import premiumRouter from "./routes/premium";
// app.use("/premium", premiumRouter);
```

**Subscription Routes (4 endpoints)**:
- `POST /premium/subscriptions` - Create subscription
- `GET /premium/subscriptions` - Get client's subscriptions
- `PATCH /premium/subscriptions/:id/status` - Pause/resume subscription
- `DELETE /premium/subscriptions/:id` - Cancel subscription

**Boost Routes (3 endpoints)**:
- `POST /premium/boosts` - Purchase boost
- `GET /premium/boosts` - Get active boost
- `DELETE /premium/boosts/:id` - Cancel boost

**Rush Job Routes (1 endpoint)**:
- `POST /premium/rush` - Calculate rush fee

**Referral Routes (2 endpoints)**:
- `GET /premium/referrals/code` - Get referral code
- `POST /premium/referrals/apply` - Apply referral code

**Total Disabled**: 10 API endpoints

#### ❌ Missing Routes

**Tier-Aware Pricing Routes**: No dedicated pricing routes exist
- Should have: `GET /pricing/estimate` or similar
- Currently: Pricing logic embedded in job creation

**Cleaner Earnings Dashboard**: No dedicated endpoint
- Should have: `GET /cleaner/earnings` per V3 plan
- Currently: Earnings data scattered across multiple endpoints

---

## Services Implemented But Not Used

### 1. Smart Match Engine Service
**File**: `src/core/matchingService.ts` (393 lines, **ACTIVE**)

**What it does**:
- Advanced matching algorithm with reliability weighting
- Risk-band penalties (protect top cleaners from high-risk clients)
- Distance penalties
- Repeat-client preference
- Cleaner flexibility badge logic
- Client flexibility score alignment

**Key Functions**:
- `findCandidates()` - Find and rank cleaners for a job
- `computeMatchScore()` - Calculate match score with factors
- `getMatchingContext()` - Build matching context for a job
- `shouldShowCleaner()` - Risk-based filtering
- `getAvailableCleaners()` - Get available cleaners with availability checks
- `calculateDistance()` - Haversine distance calculation

**Matching Factors**:
- Reliability points (heavy weight, 0-200 points)
- Distance penalty (every km reduces score)
- Repeat client bonus
- Flexibility alignment bonus
- Risk penalty (high-risk clients deprioritized for elite cleaners)

**Status**: ✅ **ACTIVE** - Routes are mounted and working

**V3 Compliance**: ⚠️ **PARTIAL** - Auto-assign exists but is admin-only (correct per V3 plan)

---

### 2. Job Matching Service (Alternative Implementation)
**File**: `src/services/jobMatchingService.ts` (640 lines, **ACTIVE**)

**What it does**:
- Alternative matching implementation (used by V1 job assignment)
- Weighted scoring system
- Wave-based eligibility
- Auto-assignment capability
- Broadcast and offer system

**Key Functions**:
- `findMatchingCleaners()` - Find matching cleaners with scoring
- `calculateMatchScore()` - Calculate weighted match score
- `assignCleanerToJob()` - Auto-assign cleaner to job
- `broadcastJobToCleaners()` - Send job offers to multiple cleaners
- `acceptJobOffer()` - Cleaner accepts job offer
- `getWaveEligibleCleaners()` - Wave-based eligibility

**Scoring Weights** (default):
- Reliability: 30%
- Tier: 20%
- Distance: 15%
- Price Match: 15%
- Past Jobs: 10%
- Response Rate: 10%

**Status**: ✅ **ACTIVE** - Used by V1 job assignment flow

**V3 Compliance**: ⚠️ **PARTIAL** - Has auto-assign, but V3 should be suggestions only

---

### 3. Subscription Service
**File**: `src/services/premiumService.ts` (434 lines, **DISABLED**)

**What it does**:
- Subscription CRUD operations
- Subscription lifecycle management (pause, resume, cancel)
- Next job date calculation
- Subscription job creation helpers

**Key Functions**:
- `createSubscription()` - Create new subscription
- `getClientSubscriptions()` - Get client's subscriptions
- `updateSubscriptionStatus()` - Pause/resume subscription
- `cancelSubscription()` - Cancel subscription
- `getSubscriptionsDueForJobCreation()` - Get subscriptions needing jobs
- `markSubscriptionJobCreated()` - Mark job created and calculate next date
- `calculateNextJobDate()` - Calculate next job date based on frequency

**Subscription Features**:
- Frequency: weekly, biweekly, monthly
- Preferred day of week
- Preferred time
- Preferred cleaner (optional)
- Address and location
- Credit amount per job

**Status**: ⬜ **DISABLED** - Routes not mounted, service not used

**Database Tables Used**:
- `cleaning_subscriptions` (exists in `001_init.sql`)

---

### 4. Tier-Aware Pricing Service
**File**: ❌ **DOES NOT EXIST**

**What it should do** (per V3 plan):
- Calculate pricing based on cleaner tier
- Tier-based price bands (min/max)
- Lock pricing in `pricing_snapshot` at booking
- Show price breakdown (base, tier adjustment, platform fee)

**Current State**:
- Tier-based payout percentages exist (V1) in `payoutsService.ts`
- But tier-based pricing for job creation does NOT exist
- Pricing is currently flat or based on cleaner's hourly rate

**What needs to be built**:
- `src/services/pricingService.ts` - New service
- Pricing calculation logic
- Tier-based price bands
- Pricing snapshot at booking

**Status**: ❌ **NOT IMPLEMENTED**

---

### 5. Cleaner Earnings Dashboard Service
**File**: ⚠️ **PARTIAL** - Some functions exist in `payoutsService.ts`

**What it should do** (per V3 plan):
- Show pending earnings (not yet paid)
- Show paid out (in payouts)
- Show next payout date
- Simple language, no ledger internals

**Current State**:
- `getCleanerPayouts()` exists in `payoutsService.ts`
- But no dedicated earnings dashboard endpoint
- Earnings data scattered across multiple endpoints

**What needs to be built**:
- `GET /cleaner/earnings` endpoint
- Aggregate earnings data
- Simple, user-friendly format

**Status**: ⚠️ **PARTIAL** - Functions exist but no dedicated endpoint

---

## Disabled Workers

### 1. Subscription Jobs Worker
**File**: `src/workers/disabled/subscriptionJobs.ts` (104 lines)

**What it does**:
- Creates jobs from active subscriptions
- Runs daily (or on schedule)
- For each ACTIVE subscription:
  - Checks if job needed for next cycle
  - Creates job with subscription pricing
  - Links to subscription via `subscription_jobs`
  - Reserves credits (from client wallet)
- Idempotency: prevents duplicate job creation

**Key Functions**:
- `runSubscriptionJobs()` - Main worker function
- Uses `getSubscriptionsDueForJobCreation()` from `premiumService`
- Uses `createJob()` from `jobsService`
- Uses `markSubscriptionJobCreated()` from `premiumService`

**When to enable**: When Subscription Engine is enabled (V3)

**Dependencies**:
- `cleaning_subscriptions` table
- `premiumService` subscription functions
- Job creation service

**Status**: ⬜ **DISABLED** - In `src/workers/disabled/`

---

## Feature Categories

### 1. Smart Match Engine (Suggestions Only)

**Purpose**: Help ops/admin assign cleaners faster without auto-assigning

**Status**: ✅ **PARTIALLY IMPLEMENTED** - Core logic exists, but needs refinement

#### Implementation Details

**File**: `src/core/matchingService.ts`

**Features**:
- ✅ Reliability score weighting (heavy weight, 0-200 points)
- ✅ Risk-band penalties (protect top cleaners from high-risk clients)
- ✅ Distance penalties (every km reduces score)
- ✅ Repeat-client preference (bonus for previous successful jobs)
- ✅ Cleaner flexibility badge logic
- ✅ Client flexibility score alignment
- ✅ Availability checking
- ✅ Conflict detection (no overlapping jobs)

**Matching Algorithm**:
```typescript
Score = 
  reliabilityPoints (0-200) +
  repeatClientBonus (if applicable) +
  flexibilityBonus (if applicable) -
  distancePenalty (km * penalty per km) -
  riskPenalty (if high-risk client + elite cleaner)
```

**Routes**:
- ✅ `GET /matching/jobs/:jobId/candidates` - Get ranked candidates (ACTIVE)
- ✅ `POST /matching/jobs/:jobId/auto-assign` - Auto-assign (admin only, ACTIVE)
- ✅ `GET /matching/jobs/:jobId/history` - Match history (ACTIVE)
- ✅ `GET /matching/explain/:jobId/:cleanerId` - Explain match score (ACTIVE)

**V3 Compliance Issues**:
- ⚠️ Auto-assign exists (but is admin-only, which is acceptable per V3 plan)
- ⚠️ Should be "suggestions only" - currently supports auto-assign for admins
- ✅ No auto-assign for regular users (correct)

**What needs refinement**:
1. Ensure auto-assign is truly admin-only (✅ already is)
2. Add UI indicators for "recommended" cleaners
3. Add preference matching (optional enhancement per V3 plan)
4. Ensure suggestions respect eligibility (✅ already does)

**Database Tables Used**:
- `jobs`
- `cleaner_profiles`
- `availability_blocks`
- `blackout_periods`
- `client_profiles`
- `client_flex_profiles`
- `cleaner_flex_profiles`

**How to Enable**:
- ✅ Already enabled - routes are mounted
- Need to ensure UI shows suggestions properly
- Need to ensure admins use suggestions, not auto-assign

---

### 2. Tier-Aware Pricing

**Purpose**: Reward reliability with pricing - Gold cleaners can command premium, Bronze has floor

**Status**: ❌ **NOT IMPLEMENTED**

#### What Should Exist (Per V3 Plan)

**Pricing Calculation**:
- Base service rate
- Cleaner tier adjustment (Gold can command premium, Bronze has floor)
- Tier-based price bands (min/max)
- Pricing locked in `pricing_snapshot` at booking

**Price Bands** (example):
- Bronze: $20-30/hour (floor pricing)
- Silver: $25-35/hour
- Gold: $30-45/hour (premium pricing)
- Platinum: $35-50/hour (premium pricing)

**Pricing Visibility**:
- Show price breakdown:
  - Base price
  - Tier adjustment (if any)
  - Platform fee
  - Total

#### Current State

**What exists**:
- ✅ Tier-based payout percentages (V1) in `payoutsService.ts`
  - Bronze: 80%
  - Silver: 82%
  - Gold: 84%
  - Platinum: 85%
- ❌ Tier-based pricing for job creation does NOT exist
- ❌ No pricing service
- ❌ No pricing snapshot at booking
- ❌ No price breakdown visibility

**What needs to be built**:

1. **Pricing Service** (`src/services/pricingService.ts`):
   ```typescript
   export async function calculateJobPricing(params: {
     cleanerTier: string;
     baseHours: number;
     cleaningType: 'basic' | 'deep' | 'moveout';
   }): Promise<{
     basePrice: number;
     tierAdjustment: number;
     platformFee: number;
     totalPrice: number;
     priceBreakdown: {
       base: number;
       tierMultiplier: number;
       platformFeePercent: number;
     };
   }>
   ```

2. **Pricing Snapshot**:
   - Store pricing in `jobs` table or new `pricing_snapshots` table
   - Lock pricing at booking time
   - Prevent pricing drift after booking

3. **Pricing Routes**:
   - `GET /pricing/estimate` - Get price estimate before booking
   - Show price breakdown in job creation

4. **Database Schema**:
   ```sql
   ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;
   -- OR
   CREATE TABLE pricing_snapshots (
     id SERIAL PRIMARY KEY,
     job_id UUID REFERENCES jobs(id),
     base_price NUMERIC,
     tier_adjustment NUMERIC,
     platform_fee NUMERIC,
     total_price NUMERIC,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

**How to Enable**:
1. Create `src/services/pricingService.ts`
2. Add pricing calculation logic
3. Integrate into job creation flow
4. Add pricing snapshot at booking
5. Add pricing visibility endpoints
6. Test tier-based price bands

---

### 3. Subscription Engine

**Purpose**: Simple subscriptions to improve retention - recurring jobs generated automatically

**Status**: ⬜ **IMPLEMENTED BUT DISABLED**

#### Implementation Details

**File**: `src/services/premiumService.ts` (subscription functions)

**Features**:
- ✅ Create subscription (frequency, day, time, cleaner, address)
- ✅ Get client subscriptions
- ✅ Pause/resume subscription
- ✅ Cancel subscription
- ✅ Get subscriptions due for job creation
- ✅ Mark subscription job created
- ✅ Calculate next job date

**Subscription Properties**:
- Frequency: `weekly`, `biweekly`, `monthly`
- Day of week: 0-6 (optional)
- Preferred time: HH:MM (optional)
- Preferred cleaner: UUID (optional)
- Address: string
- Latitude/longitude: number (optional)
- Credit amount: number (per job)

**Subscription States**:
- `active` - Generating jobs
- `paused` - Temporarily stopped
- `cancelled` - Permanently stopped

**Routes** (Disabled):
- `POST /premium/subscriptions` - Create subscription
- `GET /premium/subscriptions` - Get subscriptions
- `PATCH /premium/subscriptions/:id/status` - Pause/resume
- `DELETE /premium/subscriptions/:id` - Cancel

**Worker** (Disabled):
- `src/workers/disabled/subscriptionJobs.ts` - Generates jobs from subscriptions

**Database Tables Used**:
- `cleaning_subscriptions` (exists in `001_init.sql`)
- `jobs` (for generated jobs)
- `subscription_jobs` (if exists, for linking)

**Subscription Lifecycle**:
1. Client creates subscription → `status = 'active'`
2. Worker runs daily → Checks `next_job_date <= CURRENT_DATE + 7 days`
3. Worker creates job → Links to subscription
4. Worker updates subscription → `jobs_created++`, calculates `next_job_date`
5. Client can pause → `status = 'paused'`, stops job generation
6. Client can resume → `status = 'active'`, resumes job generation
7. Client can cancel → `status = 'cancelled'`, stops future jobs (existing jobs continue)

**Idempotency**:
- Worker checks if job already created for `next_job_date`
- Prevents duplicate job creation
- Uses `next_job_date` as key

**Cleaner Continuity** (Optional Enhancement):
- If subscription has `cleaner_id`, prefer that cleaner
- Check cleaner availability
- If unavailable → fall back to general matching

**How to Enable**:
1. Uncomment `premiumRouter` in `src/index.ts`:
   ```typescript
   import premiumRouter from "./routes/premium";
   app.use("/premium", premiumRouter);
   ```
2. Move `subscriptionJobs.ts` from `disabled/` to active workers
3. Schedule worker to run daily (e.g., cron: `0 2 * * *`)
4. Test subscription creation
5. Test job generation
6. Test pause/resume/cancel

**Dependencies**:
- `cleaning_subscriptions` table (✅ exists)
- Job creation service (✅ exists)
- Credit reservation (✅ exists)

---

### 4. Cleaner Wallet UX / Earnings Dashboard

**Purpose**: Show cleaners their earnings clearly - pending, paid, next payout

**Status**: ⚠️ **PARTIAL** - Functions exist but no dedicated endpoint

#### What Should Exist (Per V3 Plan)

**Endpoint**: `GET /cleaner/earnings`

**Response**:
```json
{
  "pendingEarnings": {
    "credits": 150,
    "usd": 15.00,
    "jobs": 3
  },
  "paidOut": {
    "credits": 500,
    "usd": 50.00,
    "jobs": 10,
    "lastPayout": "2025-01-10T00:00:00Z"
  },
  "nextPayout": {
    "date": "2025-01-17T00:00:00Z",
    "estimatedCredits": 150,
    "estimatedUsd": 15.00
  },
  "payoutSchedule": "weekly" // or "biweekly", "monthly"
}
```

**Simple Language**:
- "Pending earnings" (not yet paid)
- "Paid out" (in payouts)
- "Next payout date"
- No ledger internals (just totals)

#### Current State

**What exists**:
- ✅ `getCleanerPayouts()` in `payoutsService.ts` - Gets payout history
- ✅ Payout processing exists
- ❌ No dedicated earnings dashboard endpoint
- ❌ No aggregated earnings view
- ❌ Earnings data scattered across multiple endpoints

**What needs to be built**:

1. **Earnings Service** (`src/services/earningsService.ts`):
   ```typescript
   export async function getCleanerEarnings(cleanerId: string): Promise<{
     pendingEarnings: { credits: number; usd: number; jobs: number };
     paidOut: { credits: number; usd: number; jobs: number; lastPayout: Date | null };
     nextPayout: { date: Date; estimatedCredits: number; estimatedUsd: number };
     payoutSchedule: string;
   }>
   ```

2. **Earnings Route** (`src/routes/cleaner.ts`):
   ```typescript
   cleanerRouter.get("/earnings", requireRole("cleaner"), async (req, res) => {
     const earnings = await getCleanerEarnings(req.user!.id);
     res.json({ earnings });
   });
   ```

3. **Aggregation Logic**:
   - Sum pending credits from `credit_ledger` where `reason = 'job_release'` and not yet paid
   - Sum paid credits from `payouts` table
   - Calculate next payout date from payout schedule
   - Estimate next payout amount

**How to Enable**:
1. Create `src/services/earningsService.ts`
2. Add `GET /cleaner/earnings` endpoint
3. Aggregate earnings data
4. Format in simple, user-friendly way
5. Test with real data

---

## Summary

### V3 Features Status

| Feature | Status | Implementation | Routes | Workers |
|---------|--------|----------------|--------|---------|
| **Smart Match Engine** | ✅ Active | ✅ Complete | ✅ Mounted | N/A |
| **Tier-Aware Pricing** | ❌ Not Implemented | ❌ Missing | ❌ Missing | N/A |
| **Subscription Engine** | ⬜ Disabled | ✅ Complete | ⬜ Disabled | ⬜ Disabled |
| **Earnings Dashboard** | ⚠️ Partial | ⚠️ Partial | ❌ Missing | N/A |

### To Enable V3

#### Step 1: Enable Subscriptions
1. Uncomment `premiumRouter` in `src/index.ts`
2. Move `subscriptionJobs.ts` from `disabled/` to active
3. Schedule worker daily
4. Test subscription lifecycle

#### Step 2: Implement Tier-Aware Pricing
1. Create `src/services/pricingService.ts`
2. Add pricing calculation logic
3. Integrate into job creation
4. Add pricing snapshot
5. Add pricing visibility endpoints

#### Step 3: Implement Earnings Dashboard
1. Create `src/services/earningsService.ts`
2. Add `GET /cleaner/earnings` endpoint
3. Aggregate earnings data
4. Format simply

#### Step 4: Refine Smart Matching
1. Ensure suggestions-only (no auto-assign for users)
2. Add UI indicators for recommended cleaners
3. Add preference matching (optional)

---

## V3 Done Criteria (Per Plan)

✅ Matching suggestions improve fill rate  
✅ Suggestions don't cause complaints  
✅ Tier-based pricing feels fair  
✅ Subscriptions generate jobs reliably  
✅ Subscription cancellations don't break jobs  
✅ Pricing doesn't drift after booking  
✅ Cleaner earnings visibility improved  
✅ Ops workload stable or reduced  

**Current Status**: ⚠️ **2/8 Complete**
- ✅ Smart matching exists (needs refinement)
- ❌ Tier-aware pricing not implemented
- ⬜ Subscriptions disabled (needs enablement)
- ⚠️ Earnings dashboard partial (needs completion)

---

**Last Updated**: 2025-01-15  
**Status**: V3 features partially implemented, needs completion before V3 launch

