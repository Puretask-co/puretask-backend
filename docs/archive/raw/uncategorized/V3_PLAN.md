# V3 COMPLETION PLAN

## Status
Canonical – V3 Automation & Growth Layer  
**Goal:** Scale volume without scaling ops headcount. Add smart matching (suggestions only), tier-aware pricing, and simple subscriptions.

**Prerequisite:** V2 stable for 2-4 weeks. Reliability scores trusted. Disputes manageable.

---

## V3 Mission Statement

Introduce automation carefully: suggestions, not mandates. Subscriptions to improve retention. Tier-based pricing to reward reliability.

---

## Pre-Flight Checklist

- [ ] V2 stable for 2+ weeks
- [ ] Reliability scores trusted by ops team
- [ ] Dispute volume manageable
- [ ] Availability data accurate
- [ ] Team agrees V3 scope

---

## Phase 1: Smart Match Engine (Suggestions Only) (Days 1-7)

### Task 1.1: Eligibility Filtering
**Files to touch:**
- `src/core/matchingService.ts`
- `src/services/jobMatchingService.ts`

**What to build:**
1. Filter eligible cleaners by:
   - Availability (time window)
   - Service area (distance/zip)
   - Active status
   - Reliability tier (minimum threshold, e.g., Bronze+)
   - No conflicting jobs

**Tests:**
- [ ] Only eligible cleaners appear in results
- [ ] Ineligible cleaners excluded
- [ ] Availability conflicts handled

**Done when:** Eligibility filtering works correctly.

---

### Task 1.2: Ranking & Scoring
**Files to touch:**
- `src/core/matchingService.ts`

**What to build:**
1. Score eligible cleaners by:
   - Reliability score (banded, not raw)
   - Tier level (Gold > Silver > Bronze)
   - Distance to job (if available)
   - Recent activity balance
2. Return ranked list (top 3-5)

**What NOT to do:**
- ❌ Don't auto-assign top cleaner yet
- ❌ Don't hide results from cleaners
- ❌ Don't block low-tier cleaners entirely

**Tests:**
- [ ] Ranking produces consistent results
- [ ] Higher reliability ranked higher
- [ ] Distance considered (if data available)

**Done when:** Ranking logic deterministic and explainable.

---

### Task 1.3: Suggestion Endpoint
**Files to touch:**
- `src/routes/matching.ts`
- `src/routes/admin.ts`

**What to build:**
1. GET `/jobs/{id}/suggested-cleaners` → returns top 3-5 ranked cleaners
2. Admin can see suggestions in UI
3. Cleaners can see they're "recommended" (optional)

**What to enforce:**
- Admin still approves assignment
- OR cleaner accepts suggestion
- No auto-assignment

**Tests:**
- [ ] Suggestions appear correctly
- [ ] Admin can override suggestions
- [ ] Suggestions respect eligibility

**Done when:** Matching suggestions help without breaking trust.

---

### Task 1.4: Preference Matching (Optional Enhancement)
**Files to touch:**
- `src/core/matchingService.ts`

**What to build:**
1. Consider:
   - Cleaner job-type preferences
   - Client preferred cleaner (if exists)
   - Subscription continuity (same cleaner)

**Tests:**
- [ ] Preferences influence rank
- [ ] Preferences don't override eligibility

**Done when:** Preferences improve suggestions.

---

## Phase 2: Tier-Aware Pricing (Days 8-10)

### Task 2.1: Pricing Service Enhancement
**Files to touch:**
- `src/services/pricingService.ts`
- `src/routes/pricing.ts` (if exists)

**What to build:**
1. Pricing calculation considers:
   - Base service rate
   - Cleaner tier (Gold can command premium, Bronze has floor)
   - Tier-based price bands (min/max)
2. Pricing locked in `pricing_snapshot` at booking

**What NOT to do:**
- ❌ Don't change pricing after booking
- ❌ Don't hide pricing from cleaners
- ❌ Don't make pricing punitive

**Tests:**
- [ ] Tier affects price range
- [ ] Pricing locked at booking
- [ ] Price bands enforced

**Done when:** Pricing reflects tier fairly.

---

### Task 2.2: Pricing Visibility
**Files to touch:**
- `src/routes/jobs.ts`
- Client/cleaner views

**What to build:**
1. Show price breakdown:
   - Base price
   - Tier adjustment (if any)
   - Platform fee
   - Total

**Tests:**
- [ ] Pricing visible before booking
- [ ] Breakdown clear

**Done when:** Pricing transparent to all parties.

---

## Phase 3: Subscription Engine (Simple) (Days 11-18)

### Task 3.1: Subscription Creation
**Files to touch:**
- `src/routes/subscriptions.ts`
- `src/services/subscriptionService.ts`

**What to build:**
1. POST `/subscriptions` → create subscription
   - Service type
   - Frequency (weekly/biweekly/monthly)
   - Time window preference
   - Preferred cleaner (optional)
2. Store in `subscriptions` table
3. State: `ACTIVE`

**Schema:** (Should exist from baseline)
- `subscriptions`
- `subscription_events`

**Tests:**
- [ ] Subscription created
- [ ] State correct
- [ ] Client linked

**Done when:** Subscriptions can be created.

---

### Task 3.2: Recurring Job Generation
**Files to touch:**
- `src/workers/subscriptionJobs.ts`

**What to build:**
1. Worker runs daily (or on schedule)
2. For each ACTIVE subscription:
   - Check if job needed for next cycle
   - Create job with subscription pricing
   - Link to subscription via `subscription_jobs`
   - Reserve credits (from client wallet)
3. Idempotency: prevent duplicate job creation

**What to enforce:**
- Job generation idempotent (no duplicates)
- Pricing locked per job
- Credits reserved per job (don't pre-reserve entire subscription)

**Tests:**
- [ ] Jobs generated on schedule
- [ ] No duplicate jobs
- [ ] Credits reserved correctly
- [ ] Jobs linked to subscription

**Done when:** Subscriptions generate jobs reliably.

---

### Task 3.3: Subscription Lifecycle Management
**Files to touch:**
- `src/routes/subscriptions.ts`
- `src/services/subscriptionService.ts`

**What to build:**
1. Pause subscription:
   - POST `/subscriptions/{id}/pause`
   - State → `PAUSED`
   - No future jobs generated
2. Resume subscription:
   - POST `/subscriptions/{id}/resume`
   - State → `ACTIVE`
3. Cancel subscription:
   - POST `/subscriptions/{id}/cancel`
   - State → `CANCELLED`
   - Future jobs not generated
   - Existing jobs continue normally

**What NOT to do:**
- ❌ Don't cancel existing jobs on subscription cancel
- ❌ Don't refund entire subscription upfront

**Tests:**
- [ ] Pause stops job generation
- [ ] Resume resumes generation
- [ ] Cancel stops future jobs only
- [ ] Existing jobs unaffected

**Done when:** Subscriptions manageable by clients.

---

### Task 3.4: Cleaner Continuity (Optional)
**Files to touch:**
- `src/workers/subscriptionJobs.ts`
- `src/core/matchingService.ts`

**What to build:**
1. When generating subscription job:
   - Prefer same cleaner (if specified in subscription)
   - Check availability
   - If unavailable → fall back to general matching

**Tests:**
- [ ] Same cleaner assigned when available
- [ ] Falls back gracefully if unavailable

**Done when:** Continuity improves without blocking fulfillment.

---

### Task 3.5: Subscription Billing (If Not Per-Job)
**Files to touch:**
- `src/services/subscriptionService.ts`

**What to build:**
1. If billing per cycle (not per job):
   - Charge credits on cycle start
   - Handle failed payments gracefully
   - Retry logic
   - Notify client on failure

**What to enforce:**
- Failed payment doesn't cancel subscription immediately
- Retry with backoff
- Admin can intervene

**Tests:**
- [ ] Billing happens correctly
- [ ] Failures handled gracefully
- [ ] Retries work

**Done when:** Billing reliable.

---

## Phase 4: Cleaner Wallet UX (Days 19-20)

### Task 4.1: Earnings Dashboard
**Files to touch:**
- `src/routes/cleaner.ts`
- `src/services/payoutsService.ts`

**What to build:**
1. GET `/cleaner/earnings` → show:
   - Pending earnings (not yet paid)
   - Paid out (in payouts)
   - Next payout date
2. Simple language, no ledger internals

**Tests:**
- [ ] Earnings display correctly
- [ ] Numbers reconcile with ledger

**Done when:** Cleaners understand earnings clearly.

---

## V3 Done Criteria

✅ Matching suggestions improve fill rate  
✅ Suggestions don't cause complaints  
✅ Tier-based pricing feels fair  
✅ Subscriptions generate jobs reliably  
✅ Subscription cancellations don't break jobs  
✅ Pricing doesn't drift after booking  
✅ Cleaner earnings visibility improved  
✅ Ops workload stable or reduced  

---

## What NOT to Build in V3

❌ Full auto-matching (still requires approval/acceptance)  
❌ Complex subscription promos/discounts  
❌ Boosts  
❌ Advanced analytics  
❌ Risk automation  

These belong in V4-V5.

---

## V3 → V4 Gate

V3 is complete when:
- Suggestions improve assignment speed
- Subscriptions don't cause refund storms
- Pricing doesn't drift
- Volume scales without ops explosion

**Wait 4-6 weeks before V4.** Let V3 prove scale.

---

End of document.

