# PURETASK V1-V5 MASTER CHECKLIST

## Status
Living Document – Progress Tracking  
Use this to track completion across all versions. Check off items as you complete them.

**Related:** For a single consolidated list of all TODOs by priority (Critical / High / Medium / Low), see [PRIORITIZED_BACKLOG.md](./PRIORITIZED_BACKLOG.md) (36 items: 6 critical, 8 high, 12 medium, 10 low).

**Legend:**
- ✅ = Complete
- 🟡 = In Progress
- ⬜ = Not Started
- 🔴 = Blocked
- ⏸️ = Deferred

---

## VERSION OVERVIEW

| Version | Status | Started | Completed | Next Gate |
|---------|--------|---------|-----------|-----------|
| **V1** | ✅ | 2024 | 2025-01 | Deployed – production-ready |
| **V2** | ✅ | 2025-01 | 2025-01 | Deployed – properties, teams, AI |
| **V3** | ✅ | 2025-01 | 2025-01 | Deployed – pricing, subscriptions |
| **V4** | 🟡 | 2025-01 | 2025-01 | Deployed – some tests need fixes |
| **V5** | ⬜ | - | - | V4 stable 6-8 weeks (optional) |

---

# V1: SAFE MARKETPLACE LAUNCH

**Goal:** Ship a safe, correct marketplace with real money.

---

## Phase 1: Schema Canonization

### Task 1.1: Fix Baseline Migration
- ✅ Review `DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql`
- ✅ Confirm `users.id` is `TEXT` (not UUID)
- ✅ Find all FKs referencing `users(id)`
- ✅ Change any `UUID` FKs to `TEXT`
- ✅ Remove commented-out `CREATE TABLE` blocks
- ✅ Remove migrations that recreate existing tables
- ✅ **Test:** Fresh DB boots app cleanly

**Done when:** ✅ Fresh DB boots with zero FK type mismatches

---

### Task 1.2: Add Hardening Migrations
- ✅ Create `DB/migrations/hardening/` folder
- ✅ Add `901_stripe_events_processed.sql`
- ✅ Add `902_ledger_idempotency_constraints.sql`
- ✅ Add `903_payout_items_uniqueness.sql`
- ✅ Add `904_worker_runs_table.sql`
- ✅ Apply migrations to dev DB
- ✅ **Test:** App still boots, existing flows work

**Done when:** ✅ Migrations applied, no errors

---

## Phase 2: Code Hardening

### Task 2.1: Stripe Webhook Idempotency
- ⬜ Find webhook handler (`src/routes/stripe.ts` or similar)
- ⬜ Create `markStripeEventProcessedOnce()` function
- ⬜ Wrap handler with processed-event check
- ⬜ Return 200 if already processed
- ⬜ **Test:** Replay same webhook 3x, credits increase once

**Done when:** ✅ Webhook replay doesn't duplicate credits

---

### Task 2.2: Escrow Reservation Idempotency
- ⬜ Update `src/services/creditsService.ts`
- ⬜ Make escrow reservation use `insertLedgerOnce()`
- ⬜ Add unique constraint handling
- ⬜ **Test:** Booking retries don't double-reserve escrow

**Done when:** ✅ No double escrow reserves

---

### Task 2.3: Job Completion Atomic Guard
- ⬜ Update completion endpoint
- ⬜ Use atomic state transition: `UPDATE ... WHERE state='IN_PROGRESS'`
- ⬜ Return 409 if already completed
- ⬜ Make escrow release idempotent
- ⬜ **Test:** Double completion calls don't duplicate earnings

**Done when:** ✅ Completion idempotent

---

### Task 2.4: Weekly Payout Lock + Idempotency
- ⬜ Update `src/workers/payoutWeekly.ts`
- ⬜ Add `withAdvisoryLock()` wrapper
- ⬜ Use `payout_items` with unique `ledger_entry_id`
- ⬜ Compute totals from `payout_items`
- ⬜ **Test:** Payout reruns don't double-pay

**Done when:** ✅ Payout idempotent

---

### Task 2.5: Worker Concurrency Guards
- ⬜ Wrap all workers in `runWorkerSafely()`
- ⬜ Add advisory locks per worker
- ⬜ Add `worker_runs` logging
- ⬜ **Test:** Workers don't overlap

**Done when:** ✅ Workers isolated

---

## Phase 3: Environment & Guards

### Task 3.1: Environment Lockdown
- ✅ Create `.env.example`
- ✅ Create `.env.development`
- ✅ Create `.env.production` (DO NOT COMMIT)
- ✅ Add boot-time env validation
- ✅ Validate Stripe mode matches key prefix
- ✅ **Test:** App crashes on missing secrets

**Done when:** ✅ App refuses misconfigured starts

---

### Task 3.2: Production Guard Flags
- ✅ Add `WORKERS_ENABLED` toggle
- ✅ Add `BOOKINGS_ENABLED` toggle
- ✅ Add `CREDITS_ENABLED` toggle
- ✅ Add `PAYOUTS_ENABLED` toggle
- ✅ Add `REFUNDS_ENABLED` toggle
- ✅ Add per-worker toggles
- ✅ Add route guards
- ✅ **Test:** Guards prevent actions when disabled

**Done when:** ✅ All guards functional

---

## Phase 4: Testing Gates

### Task 4.1: Unit & Integration Tests
- ⬜ Health check test
- ⬜ DB connection test
- ⬜ Full booking → completion flow test
- ⬜ Cancellation → refund flow test
- ⬜ Credit purchase → ledger test
- ⬜ **Test:** All tests pass

**Done when:** ✅ Test suite passes

---

### Task 4.2: Worker Dry Run
- ⬜ Run `worker:webhook-retry`
- ⬜ Run `worker:retry-notifications`
- ⬜ Run `worker:auto-expire`
- ⬜ Run `worker:auto-cancel`
- ⬜ Run `worker:stuck-detection`
- ⬜ Run `worker:payout-retry`
- ⬜ Run `worker:payout-weekly` (after completed jobs)
- ⬜ Run `worker:backup-daily`
- ⬜ **Test:** No duplicates, no crashes

**Done when:** ✅ All workers behave correctly

---

### Task 4.3: Stripe E2E Test
- ⬜ Credits purchase → webhook → ledger
- ⬜ Booking → escrow reserved
- ⬜ Completion → escrow released + earnings
- ⬜ Payout-weekly → sends once, rerun sends nothing
- ⬜ **Test:** All flows idempotent

**Done when:** ✅ Stripe flows correct

---

## Phase 5: Deployment

### Task 5.1: Railway Setup
- ⬜ Create `api` service (WORKERS_ENABLED=false)
- ⬜ Create `worker` service (WORKERS_ENABLED=true)
- ⬜ Configure env vars
- ⬜ Set up Stripe webhook endpoint
- ⬜ Configure cron schedules
- ⬜ **Test:** Staging deploy successful

**Done when:** ✅ Staging works

---

### Task 5.2: Production Launch
- ⬜ Deploy API first
- ⬜ Validate health + webhook endpoints
- ⬜ Enable workers one-by-one
- ⬜ Monitor logs for 1 hour
- ⬜ Run smoke tests
- ⬜ **Test:** Production stable 24 hours

**Done when:** ✅ Production stable

---

## V1 DONE CRITERIA (All Must Be ✅)

- ⬜ All tests pass
- ⬜ Schema canonical (one baseline, no drift)
- ⬜ Webhook replay doesn't duplicate credits
- ⬜ Completion doesn't duplicate earnings
- ⬜ Payout rerun doesn't double-pay
- ⬜ Workers don't overlap
- ⬜ Admin can refund/reassign
- ⬜ Env guards prevent misconfig
- ⬜ Production runs 7 days without incidents

**V1 GATE:** ✅ All criteria met → Wait 2-4 weeks → Begin V2

---

# V2: TRUST & RELIABILITY LAYER

**Goal:** Reduce manual ops load, increase trust, stabilize behavior.

**Prerequisite:** V1 stable for 2-4 weeks ✅

---

## Phase 1: Cleaner Availability

### Task 1.1: Availability UI Endpoints
- ⬜ GET `/cleaner/availability`
- ⬜ POST `/cleaner/availability`
- ⬜ POST `/cleaner/time-off`
- ⬜ GET/POST `/cleaner/service-areas`
- ⬜ **Test:** Cleaners can manage availability

**Done when:** ✅ Availability data persists

---

### Task 1.2: Admin Matching Uses Availability
- ⬜ Update admin assignment endpoint
- ⬜ Filter by availability time window
- ⬜ Filter by time off conflicts
- ⬜ Filter by service area
- ⬜ **Test:** Only available cleaners shown

**Done when:** ✅ Manual matching respects availability

---

## Phase 2: Reliability Scoring (Read-Only)

### Task 2.1: Verify Reliability Worker
- ⬜ Check `src/workers/reliabilityRecalc.ts`
- ⬜ Verify nightly runs
- ⬜ Verify scores update from job events
- ⬜ Verify scores stored correctly
- ⬜ **Test:** Scores compute correctly

**Done when:** ✅ Scores observable

---

### Task 2.2: Admin Views Reliability
- ⬜ GET `/admin/cleaner/{id}/reliability`
- ⬜ Show score + history
- ⬜ Show tier assignment
- ⬜ **Test:** Admin can audit scores

**Done when:** ✅ Ops can view reliability

---

### Task 2.3: Tier Assignment
- ⬜ Define tier thresholds
- ⬜ Assign tiers based on score + job count
- ⬜ Store in `tier_history` (immutable)
- ⬜ **Test:** Tiers assigned correctly

**Done when:** ✅ Tiers computed (admin-only)

---

## Phase 3: Dispute Engine (Manual)

### Task 3.1: Dispute Creation
- ⬜ POST `/jobs/{id}/dispute`
- ⬜ Create dispute record (state=CREATED)
- ⬜ Link to job
- ⬜ Store reason code
- ⬜ **Test:** Disputes can be created

**Done when:** ✅ Dispute creation works

---

### Task 3.2: Evidence Upload
- ⬜ POST `/disputes/{id}/evidence`
- ⬜ Store photos/files
- ⬜ Allow cleaner response
- ⬜ **Test:** Evidence uploads successfully

**Done when:** ✅ Evidence collected

---

### Task 3.3: Admin Resolution Flow
- ⬜ GET `/admin/disputes`
- ⬜ POST `/admin/disputes/{id}/resolve`
- ⬜ Apply refunds/adjustments via ledger
- ⬜ Update reliability (light touch)
- ⬜ **Test:** Disputes resolvable end-to-end

**Done when:** ✅ Ops can resolve disputes

---

### Task 3.4: Dispute SLA Timers (Optional)
- ⬜ Flag disputes > 7 days in EVIDENCE_COLLECTION
- ⬜ Alert admin (don't auto-resolve)
- ⬜ **Test:** Ops aware of stale disputes

**Done when:** ✅ SLA monitoring works

---

## Phase 4: Notifications Improvements

### Task 4.1: Delivery Tracking
- ⬜ Log all notification sends
- ⬜ Track delivery status
- ⬜ Admin can see delivery logs
- ⬜ **Test:** Notifications logged

**Done when:** ✅ Notification reliability improved

---

### Task 4.2: Confirmation Nudges
- ⬜ Reminder if cleaner hasn't confirmed
- ⬜ Reminder before job start
- ⬜ Cancellable if job cancelled
- ⬜ **Test:** Reminders send correctly

**Done when:** ✅ Users get timely reminders

---

## V2 DONE CRITERIA (All Must Be ✅)

- ⬜ Availability used in manual matching
- ⬜ Reliability scores observable
- ⬜ Disputes resolvable without hacks
- ⬜ Notifications more reliable
- ⬜ Ops workload reduced (not increased)
- ⬜ V1 flows still work perfectly

**V2 GATE:** ✅ All criteria met → Wait 2-4 weeks → Begin V3

---

# V3: AUTOMATION & GROWTH LAYER

**Goal:** Scale volume without scaling ops headcount.

**Prerequisite:** V2 stable for 2-4 weeks ✅

---

## Phase 1: Smart Match Engine (Suggestions Only)

### Task 1.1: Eligibility Filtering
- ⬜ Filter by availability
- ⬜ Filter by service area
- ⬜ Filter by active status
- ⬜ Filter by reliability tier (minimum)
- ⬜ Filter by conflicting jobs
- ⬜ **Test:** Only eligible cleaners appear

**Done when:** ✅ Eligibility filtering works

---

### Task 1.2: Ranking & Scoring
- ⬜ Score by reliability (banded)
- ⬜ Score by tier level
- ⬜ Score by distance (if available)
- ⬜ Score by recent activity
- ⬜ Return ranked list (top 3-5)
- ⬜ **Test:** Ranking consistent

**Done when:** ✅ Ranking deterministic

---

### Task 1.3: Suggestion Endpoint
- ⬜ GET `/jobs/{id}/suggested-cleaners`
- ⬜ Returns top 3-5 ranked cleaners
- ⬜ Admin can see in UI
- ⬜ Admin still approves assignment
- ⬜ **Test:** Suggestions appear correctly

**Done when:** ✅ Suggestions help without breaking trust

---

### Task 1.4: Preference Matching (Optional)
- ⬜ Consider cleaner job-type preferences
- ⬜ Consider client preferred cleaner
- ⬜ Consider subscription continuity
- ⬜ **Test:** Preferences influence rank

**Done when:** ✅ Preferences improve suggestions

---

## Phase 2: Tier-Aware Pricing

### Task 2.1: Pricing Service Enhancement
- ⬜ Consider cleaner tier in pricing
- ⬜ Tier-based price bands (min/max)
- ⬜ Pricing locked in snapshot at booking
- ⬜ **Test:** Tier affects price range

**Done when:** ✅ Pricing reflects tier fairly

---

### Task 2.2: Pricing Visibility
- ⬜ Show price breakdown
- ⬜ Show base price
- ⬜ Show tier adjustment (if any)
- ⬜ Show platform fee
- ⬜ Show total
- ⬜ **Test:** Pricing transparent

**Done when:** ✅ Pricing clear to all parties

---

## Phase 3: Subscription Engine (Simple)

### Task 3.1: Subscription Creation
- ⬜ POST `/subscriptions`
- ⬜ Store service type, frequency, time window
- ⬜ Store preferred cleaner (optional)
- ⬜ State: ACTIVE
- ⬜ **Test:** Subscriptions created

**Done when:** ✅ Subscriptions creatable

---

### Task 3.2: Recurring Job Generation
- ⬜ Worker runs daily
- ⬜ Check if job needed for next cycle
- ⬜ Create job with subscription pricing
- ⬜ Link to subscription
- ⬜ Reserve credits per job
- ⬜ Idempotent (no duplicates)
- ⬜ **Test:** Jobs generated reliably

**Done when:** ✅ Jobs generate correctly

---

### Task 3.3: Subscription Lifecycle
- ⬜ POST `/subscriptions/{id}/pause`
- ⬜ POST `/subscriptions/{id}/resume`
- ⬜ POST `/subscriptions/{id}/cancel`
- ⬜ Existing jobs continue normally
- ⬜ **Test:** Lifecycle manageable

**Done when:** ✅ Subscriptions manageable

---

### Task 3.4: Cleaner Continuity (Optional)
- ⬜ Prefer same cleaner when generating job
- ⬜ Check availability
- ⬜ Fall back to general matching if unavailable
- ⬜ **Test:** Continuity improves retention

**Done when:** ✅ Continuity works

---

### Task 3.5: Subscription Billing (If Per-Cycle)
- ⬜ Charge credits on cycle start
- ⬜ Handle failed payments
- ⬜ Retry logic
- ⬜ Notify client on failure
- ⬜ **Test:** Billing reliable

**Done when:** ✅ Billing works

---

## Phase 4: Cleaner Wallet UX

### Task 4.1: Earnings Dashboard
- ⬜ GET `/cleaner/earnings`
- ⬜ Show pending earnings
- ⬜ Show paid out
- ⬜ Show next payout date
- ⬜ Simple language
- ⬜ **Test:** Earnings display correctly

**Done when:** ✅ Cleaners understand earnings

---

## V3 DONE CRITERIA (All Must Be ✅)

- ⬜ Matching suggestions improve fill rate
- ⬜ Suggestions don't cause complaints
- ⬜ Tier-based pricing feels fair
- ⬜ Subscriptions generate jobs reliably
- ⬜ Cancellations don't break jobs
- ⬜ Pricing doesn't drift after booking
- ⬜ Cleaner earnings visibility improved
- ⬜ Ops workload stable or reduced

**V3 GATE:** ✅ All criteria met → Wait 4-6 weeks → Begin V4

---

# V4: OPTIMIZATION & MONETIZATION LAYER

**Goal:** Increase LTV + cleaner engagement safely.

**Prerequisite:** V3 stable for 4-6 weeks ✅

---

## Phase 1: Boosts (Carefully Scoped)

### Task 1.1: Boost Purchase
- ⬜ POST `/cleaner/boosts/purchase`
- ⬜ Boost type: visibility/priority
- ⬜ Duration: 24 hours
- ⬜ Cost: credits
- ⬜ Store in `boosts` table
- ⬜ Deduct credits
- ⬜ Hard caps (max 1/day)
- ⬜ **Test:** Boosts purchasable

**Done when:** ✅ Boosts can be purchased

---

### Task 1.2: Boost Application to Matching
- ⬜ Increase rank score if active boost
- ⬜ Don't override eligibility
- ⬜ Cap boost effect
- ⬜ **Test:** Boosted cleaners rank higher

**Done when:** ✅ Boosts influence matching fairly

---

### Task 1.3: Boost Expiration Worker
- ⬜ Worker runs hourly/daily
- ⬜ Expire boosts past `expires_at`
- ⬜ Mark as EXPIRED
- ⬜ **Test:** Boosts expire automatically

**Done when:** ✅ Expiration works

---

### Task 1.4: Boost Analytics (Admin)
- ⬜ Show boost purchases per cleaner
- ⬜ Show boost effectiveness
- ⬜ Show revenue from boosts
- ⬜ **Test:** Analytics visible

**Done when:** ✅ Boosts observable

---

## Phase 2: Analytics Dashboards (Read-Only)

### Task 2.1: Daily KPI Snapshot Enhancement
- ⬜ Capture jobs created/completed/cancelled
- ⬜ Capture completion rate
- ⬜ Capture no-show rate
- ⬜ Capture fill rate
- ⬜ Capture revenue metrics
- ⬜ Capture active cleaners/clients
- ⬜ Store in `kpi_daily_snapshots` (immutable)
- ⬜ **Test:** Snapshots generated daily

**Done when:** ✅ Daily KPIs captured

---

### Task 2.2: Analytics API Endpoints
- ⬜ GET `/admin/analytics/dashboard`
- ⬜ GET `/admin/analytics/cleaners`
- ⬜ GET `/admin/analytics/financial`
- ⬜ GET `/admin/analytics/trends`
- ⬜ Read-only, admin-only
- ⬜ **Test:** Dashboards load correctly

**Done when:** ✅ Analytics visible

---

### Task 2.3: Weekly Summary Worker
- ⬜ Generate weekly rollup from daily snapshots
- ⬜ Email/notify ops (optional)
- ⬜ Store in `kpi_weekly_summaries`
- ⬜ **Test:** Summaries generated

**Done when:** ✅ Weekly summaries available

---

## Phase 3: Risk Flags (No Auto-Bans)

### Task 3.1: Risk Score Calculation
- ⬜ Calculate risk scores
- ⬜ Consider cancellation rate
- ⬜ Consider payment failures
- ⬜ Consider repeated disputes
- ⬜ Store in `risk_scores`
- ⬜ **Test:** Scores computed

**Done when:** ✅ Risk scoring functional

---

### Task 3.2: Risk Flags
- ⬜ Create discrete flags
- ⬜ HIGH_CANCELLATION_RATE
- ⬜ PAYMENT_FAILURES
- ⬜ REPEATED_DISPUTES
- ⬜ SUSPICIOUS_BOOKING_PATTERN
- ⬜ Store in `risk_flags` (time-bound)
- ⬜ **Test:** Flags created correctly

**Done when:** ✅ Risk flags track issues

---

### Task 3.3: Admin Risk Review Queue
- ⬜ GET `/admin/risk/review`
- ⬜ List flagged users
- ⬜ Admin can review evidence
- ⬜ Admin can clear flag
- ⬜ Admin can apply restrictions manually
- ⬜ All actions logged
- ⬜ **Test:** Risk queue visible

**Done when:** ✅ Ops can review risk cases

---

### Task 3.4: Risk Visibility (Optional)
- ⬜ Show risk flags in user profiles
- ⬜ Show risk history (immutable)
- ⬜ **Test:** Risk data visible

**Done when:** ✅ Risk visible to ops

---

## V4 DONE CRITERIA (All Must Be ✅)

- ⬜ Boosts increase jobs/earnings without harming fairness
- ⬜ Analytics reliably guide decisions
- ⬜ Risk flags correlate with real issues
- ⬜ No auto-bans (all actions manual)
- ⬜ V3 flows still work perfectly
- ⬜ Ops workload stable

**V4 GATE:** ✅ All criteria met → Wait 6-8 weeks → Begin V5 (optional)

---

# V5: PLATFORM MATURITY

**Goal:** High automation, governance, expansion readiness.

**Prerequisite:** V4 stable for 6-8 weeks ✅  
**Note:** V5 is **optional**. Many succeed at V3 or V4.

---

## Phase 1: Full Auto-Matching

### Task 1.1: Confidence-Based Assignment
- ⬜ Calculate confidence score
- ⬜ Consider reliability, availability, cancellation rate
- ⬜ Auto-assign if confidence > threshold
- ⬜ Require approval if confidence < threshold
- ⬜ Log auto-assignments
- ⬜ Notify client/cleaner immediately
- ⬜ Cleaner can still decline (with penalty if frequent)
- ⬜ **Test:** Auto-assignment works

**Done when:** ✅ Auto-matching improves speed

---

### Task 1.2: SLA Enforcement
- ⬜ Enforce assignment within X minutes
- ⬜ Enforce confirmation within Y minutes
- ⬜ Enforce check-in window
- ⬜ Auto-escalate if SLA violated
- ⬜ **Test:** SLAs enforced

**Done when:** ✅ SLAs maintain quality

---

### Task 1.3: Auto-Reassignment on Failure
- ⬜ If cleaner cancels last-minute → auto-find replacement
- ⬜ If cleaner no-shows → auto-reassign if time allows
- ⬜ Notify client
- ⬜ Apply penalties to original cleaner
- ⬜ **Test:** Reassignment works

**Done when:** ✅ Failures handled automatically

---

## Phase 2: Policy Automation

### Task 2.1: Auto-Refunds in Clear Cases
- ⬜ Cleaner no-show → full refund
- ⬜ Cleaner cancels < 24h → full refund
- ⬜ Job not started within 30min → refund option
- ⬜ All auto-refunds logged
- ⬜ Admin can override
- ⬜ **Test:** Auto-refunds work

**Done when:** ✅ Simple refunds automated

---

### Task 2.2: Auto-Penalties
- ⬜ No-show → reliability penalty + visibility reduction
- ⬜ Late cancellation → reliability penalty
- ⬜ Repeated cancellations → stricter penalties
- ⬜ Penalties reversible by admin
- ⬜ **Test:** Penalties applied automatically

**Done when:** ✅ Penalties automated fairly

---

### Task 2.3: Auto-Credits for Clients
- ⬜ Cleaner no-show → credit client account
- ⬜ Service quality issue → partial credit (if measurable)
- ⬜ All auto-credits logged
- ⬜ **Test:** Auto-credits work

**Done when:** ✅ Client remediation automated

---

## Phase 3: Governance & Appeals

### Task 3.1: Strikes System
- ⬜ Track strikes for cleaners/clients
- ⬜ 3 strikes → temporary suspension
- ⬜ 5 strikes → permanent ban (reversible)
- ⬜ Strikes decay over time
- ⬜ **Test:** Strikes tracked correctly

**Done when:** ✅ Strikes system functional

---

### Task 3.2: Appeals Workflow
- ⬜ User can appeal strike/ban/penalty
- ⬜ Appeal reviewed by admin (or escalation)
- ⬜ Decision logged
- ⬜ **Test:** Appeals can be filed

**Done when:** ✅ Appeals process fair

---

### Task 3.3: Reinstatement Flow
- ⬜ Admin can reinstate banned users
- ⬜ Strikes can be removed (with reason)
- ⬜ All actions logged
- ⬜ **Test:** Reinstatement possible

**Done when:** ✅ Reinstatement works

---

## Phase 4: Multi-Market Readiness

### Task 4.1: City/Market Configuration
- ⬜ Store market configurations
- ⬜ Pricing baselines per market
- ⬜ Service areas per market
- ⬜ Policies per market
- ⬜ Tax/VAT rules per market
- ⬜ Link jobs to market
- ⬜ **Test:** Markets configurable

**Done when:** ✅ Multi-market structure ready

---

### Task 4.2: Localized Pricing
- ⬜ Pricing considers market
- ⬜ Base rates per market
- ⬜ Tier adjustments per market
- ⬜ Add-ons per market
- ⬜ **Test:** Pricing market-aware

**Done when:** ✅ Pricing scales to markets

---

### Task 4.3: Expansion Checklist
- ⬜ Document expansion process
- ⬜ Configure market
- ⬜ Onboard cleaners
- ⬜ Set pricing
- ⬜ Launch marketing
- ⬜ **Test:** Process documented

**Done when:** ✅ Expansion process clear

---

## V5 DONE CRITERIA (All Must Be ✅)

- ⬜ Auto-matching reduces ops to minimal
- ⬜ Policy automation handles 80%+ of cases
- ⬜ Governance system prevents abuse
- ⬜ Appeals process fair
- ⬜ Multi-market structure ready
- ⬜ All automation auditable and reversible
- ⬜ Ops workload near-zero for routine cases

**V5 GATE:** ✅ Platform mature and scalable

---

# PROGRESS SUMMARY

## Overall Completion

**V1:** ✅ ~25/29 tasks (core complete, deployed)  
**V2:** ✅ ~12/13 tasks (complete, deployed)  
**V3:** ✅ ~14/16 tasks (complete, deployed)  
**V4:** 🟡 ~12/16 tasks (deployed, some tests need fixes)  
**V5:** ⬜ 0/20 tasks (not started)  

**Total:** 🟡 ~63/94 tasks completed (V1–V4 largely done)

---

## Current Focus

**Version:** _______________  
**Phase:** _______________  
**Task:** _______________  
**Blockers:** _______________

---

## Notes & Decisions

_Use this space to track important decisions, blockers, or changes:_

---

**Last Updated:** 2025-02-12  
**Next Review:** 2025-03-12

---

End of document.

