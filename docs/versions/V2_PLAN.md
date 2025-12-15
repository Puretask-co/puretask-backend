# V2 COMPLETION PLAN

## Status
Canonical – V2 Trust & Reliability Layer  
**Goal:** Reduce manual ops load, increase trust, stabilize behavior without breaking V1.

**Prerequisite:** V1 must be stable for 2-4 weeks before starting V2.

---

## V2 Mission Statement

Add reliability scoring, cleaner availability, and manual dispute resolution. Make these **observable and informational first**, not automated punishments.

---

## Pre-Flight Checklist

- [ ] V1 stable for 2+ weeks
- [ ] No pending V1 incidents
- [ ] Ops team agrees V2 scope
- [ ] Backend supports read-only reliability scores

---

## Phase 1: Cleaner Availability (Days 1-3)

### Task 1.1: Availability UI Endpoints
**Files to touch:**
- `src/routes/cleaner.ts`
- `src/services/availabilityService.ts`

**What to build:**
1. GET `/cleaner/availability` → return weekly schedule
2. POST `/cleaner/availability` → update schedule
3. POST `/cleaner/time-off` → add blackout dates
4. GET `/cleaner/service-areas` → get/update areas

**Schema:** (Should already exist from baseline)
- `cleaner_availability`
- `cleaner_time_off`
- `cleaner_service_areas`

**Tests:**
- [ ] Cleaner can set availability
- [ ] Time off blocks assignment
- [ ] Service areas filter job visibility

**Done when:** Cleaners can manage availability, data persists.

---

### Task 1.2: Admin Matching Uses Availability
**Files to touch:**
- `src/routes/admin.ts`
- `src/services/jobMatchingService.ts`

**What to build:**
1. Admin assignment endpoint considers:
   - Cleaner availability for job time
   - Time off conflicts
   - Service area match

**Tests:**
- [ ] Admin sees only available cleaners
- [ ] Unavailable cleaners excluded

**Done when:** Manual matching respects availability.

---

## Phase 2: Reliability Scoring (Read-Only First) (Days 4-7)

### Task 2.1: Verify Reliability Worker
**Files to check:**
- `src/workers/reliabilityRecalc.ts`
- `src/core/reliabilityScoreV2Service.ts`

**What to verify:**
1. Worker runs nightly
2. Scores update from job events
3. Scores stored in `reliability_scores` table

**What NOT to do yet:**
- ❌ Don't hide jobs from low-score cleaners
- ❌ Don't apply penalties automatically
- ❌ Don't change pricing

**Tests:**
- [ ] Worker runs without errors
- [ ] Scores update after job completion
- [ ] Scores visible in admin view

**Done when:** Scores compute correctly and are observable.

---

### Task 2.2: Admin Views Reliability
**Files to touch:**
- `src/routes/admin.ts`
- Admin dashboard/view (if exists)

**What to build:**
1. GET `/admin/cleaner/{id}/reliability` → show score + history
2. Show tier assignment (if tiers exist)

**Tests:**
- [ ] Admin can see reliability scores
- [ ] Historical scores visible

**Done when:** Ops can audit reliability data.

---

### Task 2.3: Tier Assignment (If Not Already)
**Files to touch:**
- `src/services/reliabilityService.ts`

**What to build:**
1. Tier thresholds (Bronze/Silver/Gold/Platinum)
2. Tier assignment based on score + job count
3. Store in `tier_history` (immutable)

**What NOT to do:**
- ❌ Don't gate matching by tier yet
- ❌ Don't change pricing by tier yet

**Tests:**
- [ ] Tiers assigned correctly
- [ ] Tier history logged

**Done when:** Tiers computed, visible to admin only.

---

## Phase 3: Dispute Engine (Manual Resolution) (Days 8-12)

### Task 3.1: Dispute Creation Endpoint
**Files to touch:**
- `src/routes/disputes.ts` (create)
- `src/services/disputeService.ts`

**What to build:**
1. POST `/jobs/{id}/dispute` (client can file)
2. Create dispute record:
   - `state = CREATED`
   - Link to job
   - Store reason code

**Schema:** (Should exist)
- `disputes` table
- `dispute_events` table

**Tests:**
- [ ] Client can file dispute on completed job
- [ ] Dispute created with correct state
- [ ] Job linked correctly

**Done when:** Disputes can be created.

---

### Task 3.2: Evidence Upload
**Files to touch:**
- `src/routes/disputes.ts`
- `src/services/disputeService.ts`

**What to build:**
1. POST `/disputes/{id}/evidence` → upload photos/files
2. Store in `dispute_evidence` (or similar)
3. Cleaner can respond with evidence

**Tests:**
- [ ] Evidence uploads successfully
- [ ] Evidence linked to dispute
- [ ] Multiple files supported

**Done when:** Evidence can be collected.

---

### Task 3.3: Admin Resolution Flow
**Files to touch:**
- `src/routes/admin.ts`
- `src/services/disputeService.ts`

**What to build:**
1. GET `/admin/disputes` → list pending disputes
2. POST `/admin/disputes/{id}/resolve` → admin resolves
   - Options: `RESOLVED_CLIENT`, `RESOLVED_CLEANER`, `ESCALATED`
3. On resolution:
   - Update dispute state
   - Apply refunds/adjustments via ledger
   - Update reliability scores (optional, light touch)

**What NOT to automate:**
- ❌ No auto-refunds
- ❌ No auto-escalations
- ❌ All decisions require admin review

**Tests:**
- [ ] Admin can list disputes
- [ ] Admin can resolve with reason
- [ ] Refunds applied correctly
- [ ] Dispute state transitions correctly

**Done when:** Ops can resolve disputes end-to-end.

---

### Task 3.4: Dispute SLA Timers (Optional)
**Files to touch:**
- `src/workers/stuckDetection.ts` (or new worker)

**What to build:**
1. Flag disputes stuck in `EVIDENCE_COLLECTION` > 7 days
2. Alert admin (don't auto-resolve)

**Done when:** Ops aware of stale disputes.

---

## Phase 4: Notifications Improvements (Days 13-14)

### Task 4.1: Delivery Tracking
**Files to touch:**
- `src/services/communicationsService.ts`
- `notification_deliveries` table (if exists)

**What to build:**
1. Log all notification sends
2. Track delivery status (sent/delivered/failed)
3. Admin can see delivery logs

**Tests:**
- [ ] Notifications logged
- [ ] Delivery status tracked
- [ ] Retries work correctly

**Done when:** Notification reliability improved.

---

### Task 4.2: Confirmation Nudges
**Files to touch:**
- `src/workers/retryFailedNotifications.ts`
- Notification templates

**What to build:**
1. Send reminder if cleaner hasn't confirmed assignment
2. Send reminder before job start time
3. All reminders cancellable if no longer relevant

**Tests:**
- [ ] Reminders send correctly
- [ ] Reminders cancel if job cancelled
- [ ] No spam

**Done when:** Users get timely reminders.

---

## V2 Done Criteria

✅ Availability data used in manual matching  
✅ Reliability scores compute and are observable  
✅ Disputes can be created and resolved manually  
✅ Notifications more reliable  
✅ Ops workload reduced (not increased)  
✅ No automation breaks trust  
✅ V1 flows still work perfectly  

---

## What NOT to Build in V2

❌ Auto-matching based on reliability  
❌ Auto-penalties for low scores  
❌ Auto-refunds in disputes  
❌ Tier-based pricing  
❌ Subscriptions  

These belong in V3-V5.

---

## V2 → V3 Gate

V2 is complete when:
- Availability reduces assignment mistakes
- Reliability scores feel "fair enough" in audits
- Disputes resolvable without hacks
- Ops burden decreased

**Wait 2-4 weeks before V3.** Let V2 stabilize.

---

End of document.

