# PureTask Backend - Complete Version Feature Breakdown

**Last Updated**: 2025-01-15  
**Status**: Comprehensive analysis of all features across V1-V5

This document provides a complete breakdown of all features, services, and capabilities organized by version (V1 through V5).

---

## 📊 Version Overview

| Version | Status | Focus | Prerequisite |
|---------|--------|-------|--------------|
| **V1** | ✅ **COMPLETE** | Safe Marketplace Launch | Launch |
| **V2** | ⬜ Not Started | Trust & Reliability Layer | V1 stable 2-4 weeks |
| **V3** | ⬜ Not Started | Automation & Growth Layer | V2 stable 2-4 weeks |
| **V4** | ⬜ Not Started | Optimization & Monetization | V3 stable 4-6 weeks |
| **V5** | ⬜ Not Started (Optional) | Platform Maturity | V4 stable 6-8 weeks |

---

# ✅ V1: SAFE MARKETPLACE LAUNCH (COMPLETE)

**Goal**: Ship a safe, correct marketplace with real money.

## Core Features (All Enabled)

### 1. User Management
- ✅ JWT-based authentication
- ✅ User registration (email/password)
- ✅ Password reset/update
- ✅ Role-based access control (client, cleaner, admin)
- ✅ User profiles
- ✅ Cleaner profiles
- ✅ Client profiles

### 2. Credit System
- ✅ Credit purchase via Stripe (4 packages: 50, 100, 200, 500 credits)
- ✅ Real-time credit balance tracking
- ✅ Escrow system (automatic on job creation)
- ✅ Credit release (automatic on job approval)
- ✅ Refunds (automatic on cancellation with fee policy)
- ✅ Credit ledger (full transaction history)
- ✅ **V1 Hardening**: Idempotent credit operations

### 3. Job Management
- ✅ Create jobs (clients)
- ✅ Job status lifecycle:
  - `pending` → `scheduled` → `en_route` → `in_progress` → `awaiting_approval` → `completed`
  - `cancelled` at any point
- ✅ Job discovery (cleaners browse available jobs)
- ✅ **Client Selects Top 3 Cleaners** (not auto-assign)
  - `GET /jobs/:jobId/candidates` - View top matched cleaners
  - `POST /jobs/:jobId/offer` - Send offers to selected cleaners (max 3)
- ✅ **Cleaner Acceptance Flow**
  - Cleaners receive job offers
  - First acceptance wins (other offers expire)
- ✅ Job assignment (manual or cleaner acceptance)
- ✅ Job history (clients and cleaners)
- ✅ Job events (complete audit trail)

### 4. Live Tracking
- ✅ Real-time location updates
- ✅ Status updates:
  - "On my way" (en_route)
  - "Arrived" (check-in)
  - "Started" (in_progress)
  - "Completed" (awaiting_approval)
- ✅ Client approval workflow
- ✅ Dispute system (manual resolution)
- ✅ **V1 Hardening**: Atomic job completion

### 5. Stripe Integration
- ✅ Payment processing
- ✅ Stripe Connect (cleaner payouts)
- ✅ Webhook handling:
  - `payment_intent.succeeded` → Add credits
  - `payout.paid` → Update payout status
- ✅ Customer management
- ✅ **V1 Hardening**: Webhook idempotency

### 6. Payout System
- ✅ Weekly automated payouts
- ✅ Stripe Connect integration
- ✅ Payout history
- ✅ Earnings tracking per job
- ✅ **Tier-Based Payout Percentages**:
  - Bronze: 80%
  - Silver: 82%
  - Gold: 84%
  - Platinum: 85%
- ✅ **V1 Hardening**: Payout locks and idempotency

### 7. Reliability Scoring System (V1 Core Feature)
- ✅ Reliability score calculation (0-100):
  - Cancellations (up to -40 points)
  - Disputes (up to -30 points)
  - Ratings (-10 to +10 points)
  - Completion rate (+10 points)
  - Photo compliance (+10 points)
- ✅ Tier assignment:
  - Platinum: 95+
  - Gold: 85+
  - Silver: 70+
  - Bronze: <70
- ✅ Tier lock protection (7-day lock after promotion)
- ✅ Reliability history tracking
- ✅ `GET /cleaner/reliability` endpoint
- ✅ **Tied to Payout**: Payout percentage based on tier

### 8. Availability & Service Areas
- ✅ Cleaner availability by day of week
- ✅ Time-off management
- ✅ Service area management (zip codes)
- ✅ Availability checking for job matching

### 9. Cancellation Policy
- ✅ **Client cancellations**:
  - >48 hours: 0% fee (free)
  - 24-48 hours: 50% fee
  - <24 hours: 100% fee
  - 2 lifetime grace cancellations
- ✅ **Cleaner cancellations**:
  - Full refund to client
  - Reliability penalty (10-25 points depending on timing)
- ✅ **No-show**:
  - Full refund + 50 bonus credits to client
  - 25-point reliability penalty to cleaner

### 10. Reliability Decay
- ✅ Decay: -2 points per week after 2 weeks inactive (min 50)
- ✅ Automated via `creditEconomyMaintenance` worker

### 11. Admin Features
- ✅ User management (CRUD)
- ✅ Job management (view, modify, override statuses)
- ✅ Basic KPIs dashboard:
  - Total jobs
  - Revenue
  - Active cleaners/clients
  - Cancellation rates
  - Average job value
- ✅ Dispute resolution
- ✅ System health checks
- ✅ Repair tools (fix stuck jobs, payout issues)

### 12. Notifications
- ✅ Multi-channel (Email, SMS, Push)
- ✅ Job event notifications
- ✅ Payment notifications
- ✅ Payout notifications
- ✅ Account notifications
- ✅ Retry logic for failed notifications

### 13. Background Workers (Active)
1. ✅ `autoCancelJobs` - Auto-cancel jobs past scheduled start
2. ✅ `autoExpireAwaitingApproval` - Auto-expire jobs awaiting approval after 7 days
3. ✅ `kpiSnapshot` - Daily KPI snapshot
4. ✅ `payoutWeekly` - Weekly payout processing
5. ✅ `processPayouts` - Process individual payouts to Stripe
6. ✅ `payoutRetry` - Retry failed payouts
7. ✅ `retryFailedNotifications` - Retry failed notifications
8. ✅ `webhookRetry` - Retry failed Stripe webhooks
9. ✅ `backupDaily` - Daily database backups
10. ✅ `reliabilityRecalc` - Daily reliability score recalculation (03:00 UTC)
11. ✅ `creditEconomyMaintenance` - Daily credit economy maintenance (04:00 UTC)

### 14. V1 Hardening Features
- ✅ Stripe webhook idempotency
- ✅ Escrow reservation idempotency
- ✅ Job completion atomicity
- ✅ Payout locks and idempotency
- ✅ Worker concurrency guards (advisory locks)
- ✅ Database schema hardening
- ✅ Environment validation
- ✅ Production guard flags

---

# ⬜ V2: TRUST & RELIABILITY LAYER (NOT STARTED)

**Goal**: Reduce manual ops load, increase trust, stabilize behavior.

**Prerequisite**: V1 stable for 2-4 weeks ✅

## Features (All Disabled - Marked as "V2 FEATURE — DISABLED FOR NOW")

### 1. Properties Management
**Location**: `src/routes/v2.ts`, `src/services/propertiesService.ts`

**Features**:
- ⬜ Multi-property support for clients
- ⬜ Property CRUD operations:
  - `POST /v2/properties` - Create property
  - `GET /v2/properties` - List client properties
  - `GET /v2/properties/:id` - Get property details
  - `PATCH /v2/properties/:id` - Update property
  - `DELETE /v2/properties/:id` - Delete property
- ⬜ Property suggestions (`GET /v2/properties/:id/suggestions`)
- ⬜ One-tap rebook (`GET /v2/jobs/:id/rebook-data`)
- ⬜ Property metadata:
  - Address, coordinates
  - Bedrooms, bathrooms, square feet
  - Pets, kids flags
  - Notes

**Database**: `properties` table (exists in `016_v2_core.sql`)

---

### 2. Teams Management
**Location**: `src/routes/v2.ts`, `src/services/teamsService.ts`

**Features**:
- ⬜ Cleaner team creation
- ⬜ Team member invitations
- ⬜ Team membership management:
  - `POST /v2/teams` - Create team
  - `GET /v2/teams/my` - Get my team
  - `GET /v2/teams/memberships` - Get my memberships
  - `POST /v2/teams/:id/members` - Invite member
  - `POST /v2/teams/:id/accept` - Accept invitation
  - `POST /v2/teams/:id/decline` - Decline invitation
  - `DELETE /v2/teams/:id/members/:memberId` - Remove member
  - `POST /v2/teams/:id/leave` - Leave team
- ⬜ Team statistics (`GET /v2/teams/:id/stats`)
- ⬜ Team roles (lead, member)

**Database**: `teams`, `team_members` tables (exists in `016_v2_core.sql`)

---

### 3. Calendar Integration
**Location**: `src/routes/v2.ts`, `src/services/calendarService.ts`

**Features**:
- ⬜ Google Calendar OAuth connection
- ⬜ Calendar sync (two-way):
  - Jobs → Calendar events
  - Calendar events → Job blocks
- ⬜ Calendar management:
  - `GET /v2/calendar/google/connect` - Get OAuth URL
  - `GET /v2/calendar/google/callback` - Handle OAuth callback
  - `GET /v2/calendar/connection` - Get connection status
  - `DELETE /v2/calendar/connection` - Disconnect
- ⬜ ICS feed generation (`GET /v2/calendar/ics-url`)
- ⬜ Apple Calendar support (ICS)

**Database**: `calendar_connections`, `calendar_events` tables (exists in `016_v2_core.sql`)

---

### 4. AI Features
**Location**: `src/routes/v2.ts`, `src/services/aiService.ts`

**Features**:
- ⬜ AI-powered cleaning checklist generation:
  - `POST /v2/ai/checklist` - Generate checklist based on property details
  - Considers: bedrooms, bathrooms, square feet, pets, kids, cleaning type
- ⬜ AI dispute resolution suggestions:
  - `POST /v2/ai/dispute-suggestion` - Admin-only AI suggestions for dispute resolution
- ⬜ OpenAI integration

---

### 5. Cleaner Goals & Route Optimization
**Location**: `src/routes/v2.ts`, `src/services/cleanerGoalsService.ts`

**Features**:
- ⬜ Cleaner goals system:
  - `GET /v2/cleaner/goals` - Get cleaner goals
  - Auto-create default monthly goals
- ⬜ Route optimization:
  - `GET /v2/cleaner/route-suggestions` - Get route suggestions for a date
- ⬜ Reliability breakdown:
  - `GET /v2/cleaner/reliability-breakdown` - Detailed reliability analysis

---

### 6. Enhanced Reliability Scoring (V2 Service)
**Location**: `src/core/reliabilityScoreV2Service.ts`

**Features** (More advanced than V1):
- ⬜ Base Behavior Score (0-90 pts):
  - Attendance
  - Punctuality
  - Photos
  - Communication
  - Completion
  - Ratings
- ⬜ Streak/Consistency Bonus (0-10 pts)
- ⬜ Event Penalties:
  - Late reschedules
  - Cancellations
  - No-shows
  - Disputes
  - Inconvenience
- ⬜ New cleaner ramp-up blending
- ⬜ More granular tier calculation

**Note**: V1 uses simpler `reliabilityService.ts`, V2 uses `reliabilityScoreV2Service.ts`

---

### 7. Enhanced Dispute Engine
**Location**: `src/core/cancellationService.ts`, `src/core/rescheduleService.ts`

**Features**:
- ⬜ Advanced cancellation service (`CancellationServiceV2`)
- ⬜ Advanced reschedule service (`RescheduleServiceV2`)
- ⬜ Reason code system
- ⬜ Rolling window calculations
- ⬜ Inconvenience scoring
- ⬜ Flexibility scoring

**Database**: `cancellations`, `reschedules` tables (exists in `016_v2_core.sql`)

---

### 8. Enhanced Matching Service
**Location**: `src/core/matchingService.ts`

**Features**:
- ⬜ Advanced matching algorithms
- ⬜ Wave-based matching (prioritizes top tiers)
- ⬜ Availability service integration
- ⬜ Flexibility scoring
- ⬜ Client risk service

---

### 9. Feature Flags System
**Location**: `feature_flags` table (exists in `016_v2_core.sql`)

**Features**:
- ⬜ Global feature flags
- ⬜ Targeted feature flags (by user, city, role)
- ⬜ Rollout percentages
- ⬜ Metadata support

---

### 10. Disabled Workers (V2 Features)
**Location**: `src/workers/disabled/`

1. ⬜ `cleaningScores.ts` - Cleaning quality scoring
2. ⬜ `expireBoosts.ts` - Boost expiration (V4 feature)
3. ⬜ `goalChecker.ts` - Goal progress tracking
4. ⬜ `kpiDailySnapshot.ts` - Enhanced KPI snapshots (replaced by simpler `kpiSnapshot`)
5. ⬜ `stuckJobDetection.ts` - Advanced stuck job detection
6. ⬜ `subscriptionJobs.ts` - Subscription job generation (V3 feature)
7. ⬜ `weeklySummary.ts` - Weekly summary generation (V4 feature)

---

# ⬜ V3: AUTOMATION & GROWTH LAYER (NOT STARTED)

**Goal**: Scale volume without scaling ops headcount.

**Prerequisite**: V2 stable for 2-4 weeks

## Features

### 1. Smart Match Engine (Suggestions Only)
- ⬜ Eligibility filtering:
  - Availability (time window)
  - Service area (distance/zip)
  - Active status
  - Reliability tier (minimum threshold)
  - No conflicting jobs
- ⬜ Ranking & scoring:
  - Reliability score (banded)
  - Tier level (Gold > Silver > Bronze)
  - Distance (if available)
  - Recent activity balance
- ⬜ Suggestion endpoint:
  - `GET /jobs/:id/suggested-cleaners` - Returns top 3-5 ranked cleaners
  - Admin can see suggestions in UI
  - Admin still approves assignment
- ⬜ Preference matching (optional):
  - Cleaner job-type preferences
  - Client preferred cleaner
  - Subscription continuity

---

### 2. Tier-Aware Pricing
- ⬜ Pricing service enhancement:
  - Consider cleaner tier in pricing
  - Tier-based price bands (min/max)
  - Pricing locked in snapshot at booking
- ⬜ Pricing visibility:
  - Show price breakdown
  - Base price
  - Tier adjustment (if any)
  - Platform fee
  - Total

---

### 3. Subscription Engine (Simple)
- ⬜ Subscription creation:
  - `POST /subscriptions` - Create subscription
  - Service type, frequency, time window
  - Preferred cleaner (optional)
  - State: ACTIVE
- ⬜ Recurring job generation:
  - Worker runs daily
  - Check if job needed for next cycle
  - Create job with subscription pricing
  - Link to subscription
  - Reserve credits per job
  - Idempotent (no duplicates)
- ⬜ Subscription lifecycle:
  - `POST /subscriptions/:id/pause` - Pause subscription
  - `POST /subscriptions/:id/resume` - Resume subscription
  - `POST /subscriptions/:id/cancel` - Cancel subscription
  - Existing jobs continue normally
- ⬜ Cleaner continuity (optional):
  - Prefer same cleaner when generating job
  - Check availability
  - Fall back to general matching if unavailable
- ⬜ Subscription billing (if per-cycle):
  - Charge credits on cycle start
  - Handle failed payments
  - Retry logic
  - Notify client on failure

**Worker**: `src/workers/disabled/subscriptionJobs.ts` (needs to be enabled)

---

### 4. Cleaner Wallet UX
- ⬜ Earnings dashboard:
  - `GET /cleaner/earnings` - Show:
    - Pending earnings (not yet paid)
    - Paid out (in payouts)
    - Next payout date
  - Simple language, no ledger internals

---

# ⬜ V4: OPTIMIZATION & MONETIZATION LAYER (NOT STARTED)

**Goal**: Increase LTV + cleaner engagement safely.

**Prerequisite**: V3 stable for 4-6 weeks

## Features

### 1. Boosts (Carefully Scoped)
**Location**: `src/routes/premium.ts`, `src/services/premiumService.ts` (disabled)

- ⬜ Boost purchase:
  - `POST /premium/boosts/purchase` - Cleaner buys boost
  - Boost type: "visibility" or "priority"
  - Duration: 24 hours
  - Cost: credits
  - Hard caps: max 1 boost per day
- ⬜ Boost application to matching:
  - Increase rank score if active boost
  - Don't override eligibility
  - Boost effect capped
- ⬜ Boost expiration worker:
  - `src/workers/disabled/expireBoosts.ts` (needs to be enabled)
  - Runs hourly/daily
  - Expire boosts past `expires_at`
- ⬜ Boost analytics (admin):
  - Boost purchases per cleaner
  - Boost effectiveness
  - Revenue from boosts

---

### 2. Analytics Dashboards (Read-Only)
**Location**: `src/routes/analytics.ts`, `src/services/analyticsService.ts` (disabled)

- ⬜ Daily KPI snapshot enhancement:
  - Jobs created/completed/cancelled
  - Completion rate
  - No-show rate
  - Fill rate
  - Revenue (GMV, net, refunds)
  - Active cleaners/clients
  - Store in `kpi_daily_snapshots` (immutable)
- ⬜ Analytics API endpoints:
  - `GET /analytics/dashboard` - Aggregate view
  - `GET /analytics/cleaners` - Cleaner performance
  - `GET /analytics/financial` - Revenue/refunds/payouts
  - `GET /analytics/trends` - Time-series data
  - `GET /analytics/revenue/trend` - Revenue over time
  - `GET /analytics/revenue/by-period` - Revenue breakdown
  - `GET /analytics/jobs/trend` - Job count over time
  - `GET /analytics/jobs/status` - Job status breakdown
  - `GET /analytics/users/signups` - User signup trend
  - `GET /analytics/top/clients` - Top clients by spending
  - `GET /analytics/top/cleaners` - Top cleaners by earnings
  - `GET /analytics/top/rated-cleaners` - Top rated cleaners
  - `GET /analytics/credits/health` - Credit economy health
  - `GET /analytics/report` - Comprehensive report
- ⬜ Weekly summary worker:
  - `src/workers/disabled/weeklySummary.ts` (needs to be enabled)
  - Generate weekly rollup from daily snapshots
  - Email/notify ops team (optional)
  - Store in `kpi_weekly_summaries`

---

### 3. Manager Dashboard (Advanced)
**Location**: `src/routes/manager.ts`, `src/services/managerDashboardService.ts` (disabled)

- ⬜ Dashboard overview:
  - `GET /manager/overview` - Complete dashboard with all KPIs
  - `GET /manager/alerts` - Active alerts
- ⬜ Supply & demand:
  - `GET /manager/heatmap` - Supply/demand heatmap by hour and day
- ⬜ Cleaner analytics:
  - `GET /manager/tiers` - Tier distribution and metrics
- ⬜ Retention analytics:
  - `GET /manager/retention` - Retention cohort analysis
- ⬜ Operational stats:
  - `GET /manager/support-stats` - Support ticket statistics
  - `GET /manager/background-check-stats` - Background check statistics
  - `GET /manager/full-report` - Comprehensive report

---

### 4. Risk Flags (No Auto-Bans)
- ⬜ Risk score calculation:
  - High cancellation rate
  - Payment failures
  - Repeated disputes
  - Suspicious patterns
  - Store in `risk_scores` table
- ⬜ Risk flags:
  - `HIGH_CANCELLATION_RATE`
  - `PAYMENT_FAILURES`
  - `REPEATED_DISPUTES`
  - `SUSPICIOUS_BOOKING_PATTERN`
  - Store in `risk_flags` table
  - Flags time-bound (expire after good behavior)
- ⬜ Admin risk review queue:
  - `GET /admin/risk/review` - List flagged users
  - Admin can review evidence
  - Admin can clear flag manually
  - Admin can apply restrictions manually
  - All actions logged
- ⬜ Risk visibility (optional):
  - Show risk flags in user profile views
  - Show risk history (immutable)

---

### 5. Premium Features
**Location**: `src/routes/premium.ts`, `src/services/premiumService.ts` (disabled)

- ⬜ Rush jobs:
  - `POST /premium/rush/calculate` - Calculate rush fee
  - Rush fee based on time until start
- ⬜ Referrals:
  - `GET /premium/referrals/code` - Get or generate referral code
  - `GET /premium/referrals/stats` - Get referral stats
  - `POST /premium/referrals/validate` - Validate referral code
  - `GET /premium/referrals/leaderboard` - Referral leaderboard

---

# ⬜ V5: PLATFORM MATURITY (NOT STARTED - OPTIONAL)

**Goal**: High automation, governance, expansion readiness.

**Prerequisite**: V4 stable for 6-8 weeks  
**Note**: V5 is **optional**. Many succeed at V3 or V4.

## Features

### 1. Full Auto-Matching
- ⬜ Confidence-based assignment:
  - Calculate confidence score
  - Consider reliability, availability, cancellation rate
  - Auto-assign if confidence > threshold
  - Require approval if confidence < threshold
  - Log auto-assignments
  - Notify client/cleaner immediately
  - Cleaner can still decline (with penalty if frequent)
- ⬜ SLA enforcement:
  - Enforce assignment within X minutes
  - Enforce confirmation within Y minutes
  - Enforce check-in window
  - Auto-escalate if SLA violated
- ⬜ Auto-reassignment on failure:
  - If cleaner cancels last-minute → auto-find replacement
  - If cleaner no-shows → auto-reassign if time allows
  - Notify client
  - Apply penalties to original cleaner

---

### 2. Policy Automation
- ⬜ Auto-refunds in clear cases:
  - Cleaner no-show → full refund
  - Cleaner cancels < 24h → full refund
  - Job not started within 30min → refund option
  - All auto-refunds logged
  - Admin can override
- ⬜ Auto-penalties:
  - No-show → reliability penalty + visibility reduction
  - Late cancellation → reliability penalty
  - Repeated cancellations → stricter penalties
  - Penalties reversible by admin
- ⬜ Auto-credits for clients:
  - Cleaner no-show → credit client account
  - Service quality issue → partial credit (if measurable)
  - All auto-credits logged

---

### 3. Governance & Appeals
- ⬜ Strikes system:
  - Track strikes for cleaners/clients
  - 3 strikes → temporary suspension
  - 5 strikes → permanent ban (reversible)
  - Strikes decay over time
- ⬜ Appeals workflow:
  - User can appeal strike/ban/penalty
  - Appeal reviewed by admin (or escalation)
  - Decision logged
- ⬜ Reinstatement flow:
  - Admin can reinstate banned users
  - Strikes can be removed (with reason)
  - All actions logged

---

### 4. Multi-Market Readiness
- ⬜ City/Market configuration:
  - Store market configurations
  - Pricing baselines per market
  - Service areas per market
  - Policies per market
  - Tax/VAT rules per market
  - Link jobs to market
- ⬜ Localized pricing:
  - Pricing considers market
  - Base rates per market
  - Tier adjustments per market
  - Add-ons per market
- ⬜ Expansion checklist:
  - Document expansion process
  - Configure market
  - Onboard cleaners
  - Set pricing
  - Launch marketing

---

## Summary by Version

### V1 (✅ Complete)
- **Total Features**: 14 major feature categories
- **Status**: All enabled and working
- **Workers**: 11 active workers
- **API Endpoints**: ~50+ endpoints
- **Hardening**: Full V1 hardening implemented

### V2 (⬜ Not Started)
- **Total Features**: 10 major feature categories
- **Status**: All disabled (marked as "V2 FEATURE — DISABLED FOR NOW")
- **Routes**: `/v2/*` routes exist but not mounted
- **Services**: All services implemented but not used
- **Workers**: 7 disabled workers in `src/workers/disabled/`

### V3 (⬜ Not Started)
- **Total Features**: 4 major feature categories
- **Status**: Not implemented (planned)
- **Dependencies**: Requires V2 completion

### V4 (⬜ Not Started)
- **Total Features**: 5 major feature categories
- **Status**: Routes exist but disabled (`premium.ts`, `analytics.ts`, `manager.ts`)
- **Workers**: 2 disabled workers (`expireBoosts.ts`, `weeklySummary.ts`)

### V5 (⬜ Not Started - Optional)
- **Total Features**: 4 major feature categories
- **Status**: Not implemented (planned)
- **Note**: Optional - many succeed at V3 or V4

---

## How to Enable V2 Features

1. **Uncomment routes in `src/index.ts`**:
   ```typescript
   // Change from:
   // import v2Router from "./routes/v2";
   // app.use("/v2", v2Router);
   
   // To:
   import v2Router from "./routes/v2";
   app.use("/v2", v2Router);
   ```

2. **Enable workers** (move from `disabled/` to active):
   - Move workers from `src/workers/disabled/` to `src/workers/`
   - Update imports in `src/workers/index.ts`

3. **Update environment flags** (if needed)

4. **Run database migrations** (if any new migrations exist)

---

## Files Reference

### V1 (Active)
- `src/routes/jobs.ts` - Job management
- `src/routes/cleaner.ts` - Cleaner endpoints
- `src/routes/admin.ts` - Admin endpoints
- `src/services/reliabilityService.ts` - V1 reliability scoring
- `src/workers/reliabilityRecalc.ts` - Reliability recalculation
- `src/workers/creditEconomyMaintenance.ts` - Credit economy maintenance

### V2 (Disabled)
- `src/routes/v2.ts` - V2 API routes (not mounted)
- `src/services/propertiesService.ts` - Properties
- `src/services/teamsService.ts` - Teams
- `src/services/calendarService.ts` - Calendar
- `src/services/aiService.ts` - AI features
- `src/services/cleanerGoalsService.ts` - Goals
- `src/core/reliabilityScoreV2Service.ts` - V2 reliability scoring
- `src/core/cancellationService.ts` - V2 cancellation service
- `src/core/rescheduleService.ts` - V2 reschedule service
- `src/core/matchingService.ts` - Advanced matching

### V4 (Disabled)
- `src/routes/premium.ts` - Premium features (not mounted)
- `src/routes/analytics.ts` - Analytics (not mounted)
- `src/routes/manager.ts` - Manager dashboard (not mounted)
- `src/services/premiumService.ts` - Premium service
- `src/services/analyticsService.ts` - Analytics service
- `src/services/managerDashboardService.ts` - Manager dashboard service

### Disabled Workers
- `src/workers/disabled/cleaningScores.ts`
- `src/workers/disabled/expireBoosts.ts`
- `src/workers/disabled/goalChecker.ts`
- `src/workers/disabled/kpiDailySnapshot.ts`
- `src/workers/disabled/stuckJobDetection.ts`
- `src/workers/disabled/subscriptionJobs.ts`
- `src/workers/disabled/weeklySummary.ts`

---

**Last Updated**: 2025-01-15  
**Next Review**: After V1 launch stabilization

