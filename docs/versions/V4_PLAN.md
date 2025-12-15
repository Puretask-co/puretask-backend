# V4 COMPLETION PLAN

## Status
Canonical – V4 Optimization & Monetization Layer  
**Goal:** Increase LTV + cleaner engagement safely. Add boosts, analytics dashboards, and risk flags (no auto-bans yet).

**Prerequisite:** V3 stable for 4-6 weeks. Subscriptions working. Matching suggestions trusted.

---

## V4 Mission Statement

Monetize and optimize without eroding trust. Add visibility (analytics) and optional spending (boosts) with careful caps and audits.

---

## Pre-Flight Checklist

- [ ] V3 stable for 4+ weeks
- [ ] Subscriptions reliable
- [ ] Matching suggestions working well
- [ ] Team agrees V4 scope

---

## Phase 1: Boosts (Carefully Scoped) (Days 1-7)

### Task 1.1: Boost Purchase
**Files to touch:**
- `src/routes/boosts.ts`
- `src/services/boostService.ts`

**What to build:**
1. POST `/cleaner/boosts/purchase` → cleaner buys boost
   - Boost type: "visibility" or "priority"
   - Duration: e.g., 24 hours
   - Cost: credits
2. Store in `boosts` table (if exists) or `cleaner_boosts`
3. Deduct credits from cleaner wallet

**What to enforce:**
- Hard caps: max 1 boost per day (or configurable)
- Boost expires after duration
- Fully auditable (ledger entry)

**Tests:**
- [ ] Cleaner can purchase boost
- [ ] Credits deducted
- [ ] Boost stored with expiration
- [ ] Caps enforced

**Done when:** Boosts can be purchased.

---

### Task 1.2: Boost Application to Matching
**Files to touch:**
- `src/core/matchingService.ts`

**What to build:**
1. When ranking cleaners:
   - If active boost exists → increase rank score
   - Don't override eligibility (still must be eligible)
   - Boost effect capped (don't let it dominate)

**What NOT to do:**
- ❌ Don't let boost bypass reliability requirements
- ❌ Don't let boost hide low scores

**Tests:**
- [ ] Boosted cleaners rank higher
- [ ] Boost doesn't bypass eligibility
- [ ] Boost expires correctly

**Done when:** Boosts influence matching fairly.

---

### Task 1.3: Boost Expiration Worker
**Files to touch:**
- `src/workers/expireBoosts.ts`

**What to build:**
1. Worker runs hourly (or daily)
2. Expire boosts past `expires_at`
3. Mark boost as `EXPIRED`

**Tests:**
- [ ] Expired boosts marked correctly
- [ ] Worker idempotent

**Done when:** Boosts expire automatically.

---

### Task 1.4: Boost Analytics (Admin)
**Files to touch:**
- `src/routes/admin.ts`

**What to build:**
1. Admin can see:
   - Boost purchases per cleaner
   - Boost effectiveness (did boosted cleaner get job?)
   - Revenue from boosts

**Done when:** Boosts observable and auditable.

---

## Phase 2: Analytics Dashboards (Read-Only) (Days 8-14)

### Task 2.1: Daily KPI Snapshot Enhancement
**Files to touch:**
- `src/workers/kpiDailySnapshot.ts`
- `src/services/analyticsService.ts`

**What to build:**
1. Capture daily metrics:
   - Jobs created/completed/cancelled
   - Completion rate
   - No-show rate
   - Fill rate (jobs assigned vs created)
   - Revenue (GMV, net, refunds)
   - Active cleaners/clients
2. Store in `kpi_daily_snapshots` (immutable)

**Tests:**
- [ ] Snapshots generated daily
- [ ] Metrics accurate
- [ ] Snapshots immutable

**Done when:** Daily KPIs captured reliably.

---

### Task 2.2: Analytics API Endpoints
**Files to touch:**
- `src/routes/analytics.ts`

**What to build:**
1. GET `/admin/analytics/dashboard` → aggregate view
2. GET `/admin/analytics/cleaners` → cleaner performance
3. GET `/admin/analytics/financial` → revenue/refunds/payouts
4. GET `/admin/analytics/trends` → time-series data

**What to enforce:**
- Read-only (no mutations)
- Role-based access (admin only)

**Tests:**
- [ ] Dashboards load correctly
- [ ] Data accurate
- [ ] Access controlled

**Done when:** Analytics visible to ops.

---

### Task 2.3: Weekly Summary Worker
**Files to touch:**
- `src/workers/weeklySummary.ts`

**What to build:**
1. Generate weekly rollup from daily snapshots
2. Email/notify ops team (optional)
3. Store in `kpi_weekly_summaries`

**Tests:**
- [ ] Weekly summaries generated
- [ ] Data accurate

**Done when:** Weekly summaries available.

---

## Phase 3: Risk Flags (No Auto-Bans) (Days 15-18)

### Task 3.1: Risk Score Calculation
**Files to touch:**
- `src/core/clientRiskService.ts`
- `src/services/riskService.ts`

**What to build:**
1. Calculate risk scores for clients/cleaners:
   - High cancellation rate
   - Payment failures
   - Repeated disputes
   - Suspicious patterns
2. Store in `risk_scores` table

**What NOT to do:**
- ❌ Don't auto-ban based on score
- ❌ Don't hide risk scores from users

**Tests:**
- [ ] Risk scores computed
- [ ] Scores update correctly

**Done when:** Risk scoring functional.

---

### Task 3.2: Risk Flags
**Files to touch:**
- `src/services/riskService.ts`

**What to build:**
1. Create discrete flags:
   - `HIGH_CANCELLATION_RATE`
   - `PAYMENT_FAILURES`
   - `REPEATED_DISPUTES`
   - `SUSPICIOUS_BOOKING_PATTERN`
2. Store in `risk_flags` table
3. Flags time-bound (expire after good behavior)

**Tests:**
- [ ] Flags created correctly
- [ ] Flags expire appropriately

**Done when:** Risk flags track issues.

---

### Task 3.3: Admin Risk Review Queue
**Files to touch:**
- `src/routes/admin.ts`

**What to build:**
1. GET `/admin/risk/review` → list flagged users
2. Admin can:
   - Review evidence
   - Clear flag manually
   - Apply restrictions manually (if needed)
   - Log decision

**What to enforce:**
- All risk actions require admin review
- All actions logged in audit log

**Tests:**
- [ ] Risk queue visible
- [ ] Admin can review and act
- [ ] Actions logged

**Done when:** Ops can review and handle risk cases.

---

### Task 3.4: Risk Visibility (Optional)
**Files to touch:**
- `src/routes/admin.ts`

**What to build:**
1. Show risk flags in user profile views
2. Show risk history (immutable)

**Done when:** Risk data visible to ops.

---

## V4 Done Criteria

✅ Boosts increase jobs/earnings without harming fairness  
✅ Analytics reliably guide decisions  
✅ Risk flags correlate with real issues  
✅ No auto-bans (all actions manual)  
✅ V3 flows still work perfectly  
✅ Ops workload stable  

---

## What NOT to Build in V4

❌ Auto-bans based on risk  
❌ Auto-restrictions  
❌ Full auto-matching  
❌ Policy automation  
❌ Complex promotions  

These belong in V5.

---

## V4 → V5 Gate

V4 is complete when:
- Boosts monetize without complaints
- Analytics inform strategy
- Risk flags help ops prioritize

**Wait 6-8 weeks before V5.** V5 is optional—you may choose to stay at V4.

---

End of document.

