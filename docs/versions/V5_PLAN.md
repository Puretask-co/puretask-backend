# V5 COMPLETION PLAN

## Status
Canonical – V5 Platform Maturity  
**Goal:** High automation, governance, and expansion readiness. This is the "mature platform" state.

**Prerequisite:** V4 stable for 6-8 weeks. Risk flags trusted. Analytics proven valuable.

**Important:** V5 is **optional**. Many successful marketplaces stop at V3 or V4. Only proceed if you need:
- Full automation to reduce ops to near-zero
- Governance systems for large scale
- Multi-market expansion

---

## V5 Mission Statement

Automate trust decisions carefully, build governance for scale, prepare for expansion.

---

## Pre-Flight Checklist

- [ ] V4 stable for 6+ weeks
- [ ] Risk flags trusted
- [ ] Analytics proven valuable
- [ ] Team agrees V5 is necessary
- [ ] Legal/compliance considerations addressed

---

## Phase 1: Full Auto-Matching (Days 1-10)

### Task 1.1: Confidence-Based Assignment
**Files to touch:**
- `src/core/matchingService.ts`
- `src/routes/jobs.ts`

**What to build:**
1. Calculate "confidence score" for top-ranked cleaner:
   - High reliability
   - Good availability history
   - Low cancellation rate
   - Positive client feedback
2. If confidence > threshold → auto-assign (no admin approval)
3. If confidence < threshold → require approval/suggestion

**What to enforce:**
- Auto-assignment logged
- Client/cleaner notified immediately
- Cleaner can still decline (with penalty if frequent)

**Tests:**
- [ ] Auto-assignment works for high-confidence
- [ ] Low-confidence requires approval
- [ ] Cleaner can decline
- [ ] Logging complete

**Done when:** Auto-matching improves speed without breaking trust.

---

### Task 1.2: SLA Enforcement
**Files to touch:**
- `src/workers/autoExpire.ts`

**What to build:**
1. Enforce strict SLAs:
   - Assignment within X minutes
   - Confirmation within Y minutes
   - Check-in window enforcement
2. Auto-escalate if SLA violated

**Tests:**
- [ ] SLAs enforced correctly
- [ ] Escalations work

**Done when:** SLAs maintain quality.

---

### Task 1.3: Auto-Reassignment on Failure
**Files to touch:**
- `src/core/matchingService.ts`
- `src/workers/stuckDetection.ts`

**What to build:**
1. If cleaner cancels last-minute:
   - Auto-find replacement
   - Notify client
   - Apply penalties to original cleaner
2. If cleaner no-shows:
   - Auto-reassign if time allows
   - Or cancel with full refund

**Tests:**
- [ ] Reassignment works
- [ ] Client notified
- [ ] Penalties applied

**Done when:** Failures handled automatically.

---

## Phase 2: Policy Automation (Days 11-18)

### Task 2.1: Auto-Refunds in Clear Cases
**Files to touch:**
- `src/services/disputeService.ts`
- `src/workers/disputeResolution.ts` (new)

**What to build:**
1. Auto-refund rules:
   - Cleaner no-show → full refund
   - Cleaner cancels < 24h before start → full refund
   - Job not started within 30min of window → refund option
2. All auto-refunds logged and reversible (admin override)

**What to enforce:**
- Only clear-cut cases
- Admin can override
- All actions logged

**Tests:**
- [ ] Auto-refunds work in clear cases
- [ ] Admin can override
- [ ] Logging complete

**Done when:** Simple refunds automated.

---

### Task 2.2: Auto-Penalties
**Files to touch:**
- `src/services/reliabilityService.ts`
- `src/core/jobEvents.ts`

**What to build:**
1. Auto-apply penalties:
   - No-show → reliability penalty + temporary visibility reduction
   - Late cancellation → reliability penalty
   - Repeated cancellations → stricter penalties
2. Penalties reversible by admin

**Tests:**
- [ ] Penalties applied automatically
- [ ] Admin can reverse
- [ ] Logging complete

**Done when:** Penalties automated fairly.

---

### Task 2.3: Auto-Credits for Clients
**Files to touch:**
- `src/services/creditsService.ts`

**What to build:**
1. Auto-credit rules:
   - Cleaner no-show → credit client account
   - Service quality issue (if measurable) → partial credit
2. All auto-credits logged

**Tests:**
- [ ] Auto-credits work
- [ ] Logging complete

**Done when:** Client remediation automated.

---

## Phase 3: Governance & Appeals (Days 19-25)

### Task 3.1: Strikes System
**Files to touch:**
- `src/services/governanceService.ts`

**What to build:**
1. Track strikes for cleaners/clients:
   - 3 strikes → temporary suspension
   - 5 strikes → permanent ban (reversible by admin)
2. Strikes decay over time (good behavior reduces strikes)

**Tests:**
- [ ] Strikes tracked correctly
- [ ] Suspensions/bans applied
- [ ] Decay works

**Done when:** Strikes system functional.

---

### Task 3.2: Appeals Workflow
**Files to touch:**
- `src/routes/appeals.ts`
- `src/services/governanceService.ts`

**What to build:**
1. User can appeal:
   - Strike
   - Ban
   - Penalty
2. Appeal reviewed by admin (or escalation)
3. Decision logged

**Tests:**
- [ ] Appeals can be filed
- [ ] Admin can review
- [ ] Decisions logged

**Done when:** Appeals process fair and transparent.

---

### Task 3.3: Reinstatement Flow
**Files to touch:**
- `src/services/governanceService.ts`

**What to build:**
1. Admin can reinstate banned users
2. Strikes can be removed (with reason)
3. All actions logged

**Done when:** Reinstatement possible.

---

## Phase 4: Multi-Market Readiness (Days 26-30)

### Task 4.1: City/Market Configuration
**Files to touch:**
- `src/services/marketService.ts`

**What to build:**
1. Store market configurations:
   - Pricing baselines
   - Service areas
   - Policies (cancellation windows, etc.)
   - Tax/VAT rules
2. Jobs linked to market

**Tests:**
- [ ] Markets configurable
- [ ] Jobs linked correctly

**Done when:** Multi-market structure ready.

---

### Task 4.2: Localized Pricing
**Files to touch:**
- `src/services/pricingService.ts`

**What to build:**
1. Pricing considers market:
   - Base rates per market
   - Tier adjustments per market
   - Add-ons per market

**Tests:**
- [ ] Pricing market-aware
- [ ] Correct rates applied

**Done when:** Pricing scales to multiple markets.

---

### Task 4.3: Expansion Checklist
**Files to document:**
- `docs/ops/MARKET_EXPANSION.md`

**What to document:**
1. Steps to launch new market:
   - Configure market
   - Onboard cleaners
   - Set pricing
   - Launch marketing

**Done when:** Expansion process documented.

---

## V5 Done Criteria

✅ Auto-matching reduces ops to minimal  
✅ Policy automation handles 80%+ of cases  
✅ Governance system prevents abuse  
✅ Appeals process fair  
✅ Multi-market structure ready  
✅ All automation auditable and reversible  
✅ Ops workload near-zero for routine cases  

---

## V5 Maintenance

V5 requires:
- Ongoing monitoring of automation decisions
- Regular audits of appeals/penalties
- Policy tuning based on data
- Legal/compliance review

---

## Final Note

**V5 is the "mature platform" state.** Many successful marketplaces never reach V5—they succeed at V3 or V4.

Only proceed to V5 if:
- You have proven product-market fit
- You need to scale ops efficiency
- You're expanding to multiple markets
- You have resources for governance

Otherwise, **V3 or V4 is perfectly fine for long-term success.**

---

End of document.

