# V4 PureTask - Complete Capabilities List

**Date**: 2025-01-15  
**Status**: ✅ **ENABLED** (Implementation complete, requires V3 stable for 4-6 weeks before production use)

---

## 🎯 V4 Mission Statement

**Goal**: Increase LTV (Lifetime Value) + cleaner engagement safely.

**Focus**: Monetize and optimize without eroding trust. Add visibility (analytics) and optional spending (boosts) with careful caps and audits.

---

## 📊 V4 Feature Categories

V4 consists of **5 major feature categories**:

1. **Boosts** (Monetization)
2. **Analytics Dashboards** (Visibility)
3. **Manager Dashboard** (Advanced Operations)
4. **Risk Flags** (Safety & Monitoring)
5. **Premium Features** (Rush Jobs & Referrals)

---

## 1. 🚀 BOOSTS (Monetization Feature)

### Overview
Allows cleaners to purchase visibility/priority boosts to increase their ranking in job matching, providing a revenue stream while maintaining fairness.

### Capabilities

#### Boost Purchase
- **Endpoint**: `POST /premium/boosts/purchase`
- **Access**: Cleaners only
- **Boost Types**:
  - `STANDARD`: 30 credits, 1.5x multiplier, 24 hours duration
  - `PREMIUM`: 60 credits, 2.0x multiplier, 48 hours duration
  - `MEGA`: 100 credits, 3.0x multiplier, 72 hours duration
- **Features**:
  - Deducts credits from cleaner wallet
  - Stores boost in `cleaner_boosts` table
  - Hard cap: Max 1 active boost at a time
  - Boost expires automatically after duration

#### Boost Management
- **Endpoint**: `GET /premium/boosts/active` - Get cleaner's active boost
- **Endpoint**: `GET /premium/boosts/options` - Get available boost options and pricing
- **Features**:
  - Track boost status (active/expired)
  - Track jobs received during boost period
  - Boost multiplier affects ranking (doesn't bypass eligibility)

#### Boost Application to Matching
- **Location**: Integrated into matching service
- **Features**:
  - Increases rank score when active boost exists
  - Does NOT override eligibility requirements
  - Boost effect is capped (doesn't dominate ranking)
  - Cleaners still must meet reliability/availability requirements

#### Boost Expiration Worker
- **Worker**: `src/workers/expireBoosts.ts` (disabled, needs to be enabled)
- **Schedule**: Hourly or daily
- **Features**:
  - Automatically expires boosts past `ends_at` timestamp
  - Marks boosts as `EXPIRED` status
  - Idempotent (safe to run multiple times)

#### Boost Analytics (Admin)
- **Features**:
  - Track boost purchases per cleaner
  - Measure boost effectiveness (did boosted cleaner get job?)
  - Revenue tracking from boosts
  - Admin-visible analytics

### Safety Features
- ✅ Hard caps prevent abuse (max 1 boost at a time)
- ✅ Boost doesn't bypass reliability requirements
- ✅ Boost effect is capped to maintain fairness
- ✅ Fully auditable (ledger entries for all purchases)

---

## 2. 📈 ANALYTICS DASHBOARDS (Read-Only Visibility)

### Overview
Comprehensive analytics system for business intelligence, revenue tracking, and operational insights. All endpoints are read-only and admin-only.

### Capabilities

#### Dashboard Overview
- **Endpoint**: `GET /analytics/dashboard`
- **Access**: Admin only
- **Time Ranges**: day, week, month, quarter, year, all
- **Metrics**:
  - Jobs: created, completed, cancelled counts
  - Completion rates
  - Revenue: GMV, net revenue, refunds
  - Active users: cleaners and clients
  - Average job value
  - Cancellation rates

#### Revenue Analytics
- **Endpoint**: `GET /analytics/revenue/trend` - Revenue over time (time-series)
- **Endpoint**: `GET /analytics/revenue/by-period` - Revenue breakdown by day/week/month
- **Features**:
  - Time-series revenue data
  - Period-based grouping (daily, weekly, monthly)
  - Revenue trends and growth metrics
  - Refund tracking
  - Net revenue calculations

#### Job Analytics
- **Endpoint**: `GET /analytics/jobs/trend` - Job count over time
- **Endpoint**: `GET /analytics/jobs/status` - Job status breakdown
- **Features**:
  - Job creation trends
  - Job completion rates
  - Job status distribution
  - Time-series job data
  - Fill rate (jobs assigned vs created)

#### User Analytics
- **Endpoint**: `GET /analytics/users/signups` - User signup trend
- **Features**:
  - Signup trends over time
  - Filter by role (client, cleaner, all)
  - New user acquisition metrics
  - User growth rates

#### Top Performers
- **Endpoint**: `GET /analytics/top/clients` - Top clients by spending
- **Endpoint**: `GET /analytics/top/cleaners` - Top cleaners by earnings
- **Endpoint**: `GET /analytics/top/rated-cleaners` - Top rated cleaners
- **Features**:
  - Leaderboards (configurable limit, default 10, max 100)
  - Ranking by spending/earnings/ratings
  - Time-range filtering
  - User identification (email, user_id)

#### Credit Economy Health
- **Endpoint**: `GET /analytics/credits/health`
- **Features**:
  - Total credit supply
  - Circulating credits
  - Weekly velocity (credits spent per week)
  - Inflation rate
  - Purchase to refund ratio

#### Comprehensive Reports
- **Endpoint**: `GET /analytics/report` - Generate full analytics report
- **Features**:
  - Combines all analytics endpoints
  - Time-range filtering
  - Complete business metrics snapshot
  - Export-ready format

#### Daily KPI Snapshots
- **Worker**: `src/workers/kpiDailySnapshot.ts` (disabled, needs to be enabled)
- **Schedule**: Daily (typically 1:00 AM UTC)
- **Features**:
  - Immutable daily snapshots stored in `kpi_daily_snapshots` table
  - Captures: jobs created/completed/cancelled, completion rate, no-show rate, fill rate
  - Revenue metrics: GMV, net, refunds
  - Active users count
  - Historical data preservation

#### Weekly Summary Worker
- **Worker**: `src/workers/weeklySummary.ts` (disabled, needs to be enabled)
- **Schedule**: Weekly (typically Monday mornings)
- **Features**:
  - Generate weekly rollup from daily snapshots
  - Store in `kpi_weekly_summaries` table
  - Optional email/notification to ops team
  - Weekly trend analysis

---

## 3. 🎛️ MANAGER DASHBOARD (Advanced Operations)

### Overview
Advanced operational dashboard for managers/executives with comprehensive business metrics, supply/demand analysis, and retention insights.

### Capabilities

#### Dashboard Overview
- **Endpoint**: `GET /manager/overview`
- **Access**: Admin only
- **Features**:
  - GMV (Gross Merchandise Value): today, this week, this month, last month, MoM growth
  - Credits: purchased, spent, refunded, total supply, velocity per day
  - Jobs: today, this week, completion rate, average rating, average job value
  - Users: total clients/cleaners, active (30d), new this week
  - Rates: refund rate, dispute rate, cancellation rate, payout error rate, workflow error rate

#### Active Alerts
- **Endpoint**: `GET /manager/alerts`
- **Features**:
  - List of active alerts requiring attention
  - Alert count
  - System health indicators

#### Supply & Demand Heatmap
- **Endpoint**: `GET /manager/heatmap`
- **Features**:
  - Supply/demand visualization by hour and day of week
  - Identify peak demand periods
  - Identify supply gaps
  - Hour-by-hour and day-by-day breakdown
  - Helps with capacity planning

#### Cleaner Analytics
- **Endpoint**: `GET /manager/tiers`
- **Features**:
  - Tier distribution: Bronze, Silver, Gold, Platinum
  - Metrics per tier: count, average reliability score, jobs completed, earnings
  - Tier health indicators
  - Cleaner performance by tier

#### Retention Analytics
- **Endpoint**: `GET /manager/retention`
- **Features**:
  - Retention cohort analysis
  - User retention rates by cohort
  - Churn analysis
  - Long-term user behavior tracking

#### Operational Statistics
- **Endpoint**: `GET /manager/support-stats` - Support ticket statistics
- **Endpoint**: `GET /manager/background-check-stats` - Background check statistics
- **Features**:
  - Support ticket metrics
  - Background check completion rates
  - Operational efficiency metrics

#### Comprehensive Report
- **Endpoint**: `GET /manager/full-report`
- **Features**:
  - Combines all manager dashboard endpoints
  - Complete operational overview
  - Generated timestamp
  - Single API call for all metrics

---

## 4. 🚨 RISK FLAGS (Safety & Monitoring)

### Overview
Risk scoring and flagging system to identify potentially problematic users. **No auto-bans** - all actions require manual admin review.

### Capabilities

#### Risk Score Calculation
- **Location**: Risk service (to be implemented)
- **Features**:
  - Calculate risk scores for clients and cleaners
  - Factors:
    - High cancellation rate
    - Payment failures
    - Repeated disputes
    - Suspicious booking patterns
  - Store in `risk_scores` table
  - Scores update based on behavior

#### Risk Flags
- **Location**: Risk service (to be implemented)
- **Flag Types**:
  - `HIGH_CANCELLATION_RATE` - User cancels frequently
  - `PAYMENT_FAILURES` - Multiple payment failures
  - `REPEATED_DISPUTES` - Multiple disputes filed
  - `SUSPICIOUS_BOOKING_PATTERN` - Unusual booking behavior
- **Features**:
  - Store flags in `risk_flags` table
  - Flags are time-bound (expire after good behavior)
  - Automatic flag expiration based on behavior improvement
  - Historical flag tracking (immutable)

#### Admin Risk Review Queue
- **Endpoint**: `GET /admin/risk/review` (to be implemented)
- **Features**:
  - List flagged users requiring review
  - Review evidence and context
  - Manual flag clearing
  - Manual restriction application (if needed)
  - All actions logged in audit log
  - Decision history tracking

#### Risk Visibility
- **Features** (optional):
  - Show risk flags in user profile views (admin)
  - Show risk history (immutable, audit trail)
  - Risk score indicators
  - Flag reasons and timestamps

### Safety Principles
- ✅ **No Auto-Bans**: All risk actions require manual admin review
- ✅ **Transparent**: Risk scores/flags visible to admins
- ✅ **Reversible**: Flags can be cleared, restrictions can be removed
- ✅ **Auditable**: All risk actions logged
- ✅ **Time-Bound**: Flags expire automatically with good behavior

---

## 5. 💎 PREMIUM FEATURES (Additional Monetization)

### Overview
Additional premium features including rush jobs and referral system.

### Capabilities

#### Rush Jobs
- **Endpoint**: `POST /premium/rush/calculate`
- **Features**:
  - Calculate rush fee for jobs with short notice
  - Rush fee based on time until scheduled start
  - Configuration:
    - Minimum hours ahead: 2 hours (configurable)
    - Rush multiplier: 1.25x (25% fee)
    - Max rush fee: 50 credits
  - Apply rush fee to job pricing
  - Rush jobs marked in database

#### Referral System
- **Endpoint**: `GET /premium/referrals/code` - Get or generate referral code
- **Endpoint**: `GET /premium/referrals/stats` - Get user's referral stats
- **Endpoint**: `POST /premium/referrals/validate` - Validate referral code
- **Endpoint**: `GET /premium/referrals/leaderboard` - Referral leaderboard
- **Features**:
  - Users can generate unique referral codes
  - Track referrals by code
  - Referral statistics per user
  - Referral validation (for signup flow)
  - Leaderboard showing top referrers
  - Referral rewards (to be configured)

---

## 📁 File Locations

### Routes (Disabled - Not Mounted)
- `src/routes/premium.ts` - Premium features routes (boosts, rush, subscriptions, referrals)
- `src/routes/analytics.ts` - Analytics API routes
- `src/routes/manager.ts` - Manager dashboard routes

### Services
- `src/services/premiumService.ts` - Boost purchase, rush fees, subscription management
- `src/services/analyticsService.ts` - Analytics calculations and aggregations
- `src/services/managerDashboardService.ts` - Manager dashboard metrics
- `src/services/referralService.ts` - Referral code generation and tracking
- `src/services/riskService.ts` - Risk scoring and flagging (to be implemented)

### Workers (Disabled)
- `src/workers/expireBoosts.ts` - Boost expiration worker
- `src/workers/weeklySummary.ts` - Weekly summary generation worker
- `src/workers/kpiDailySnapshot.ts` - Enhanced daily KPI snapshot worker

### Database Tables
- `cleaner_boosts` - Boost purchases and status
- `kpi_daily_snapshots` - Daily immutable KPI snapshots
- `kpi_weekly_summaries` - Weekly rollups
- `risk_scores` - Risk score calculations (to be created)
- `risk_flags` - Risk flags (to be created)
- `referrals` - Referral tracking (if exists)

---

## ⚠️ What V4 Does NOT Include

V4 explicitly **does not** include:
- ❌ Auto-bans based on risk scores
- ❌ Auto-restrictions
- ❌ Full auto-matching (that's V5)
- ❌ Policy automation
- ❌ Complex promotions

These belong in **V5** (Platform Maturity).

---

## ✅ V4 Done Criteria

V4 is complete when:
- ✅ Boosts increase jobs/earnings without harming fairness
- ✅ Analytics reliably guide business decisions
- ✅ Risk flags correlate with real issues
- ✅ No auto-bans (all actions manual)
- ✅ V3 flows still work perfectly
- ✅ Operations workload remains stable

---

## 🚧 Current Status

**Status**: ✅ **ENABLED** (Code implementation complete)

**Prerequisites** (for production use):
- [ ] V3 stable for 4-6 weeks
- [ ] Subscriptions working reliably
- [ ] Matching suggestions trusted
- [ ] Team agrees on V4 scope

**Implementation**:
- ✅ Routes **mounted** in `src/index.ts` (analytics, manager)
- ✅ Premium router already enabled (boosts, rush, referrals)
- ✅ Services implemented and **active**
- ✅ Workers moved from `disabled/` to active directory
- ✅ Boost multiplier integrated into matching service
- ✅ Risk service built and endpoints added
- ⚠️ Risk tables (`risk_scores`, `risk_flags`) can be added via migration for persistence (currently calculated on-demand)

---

## 📊 Summary Statistics

| Category | Endpoints | Workers | Services |
|----------|-----------|---------|----------|
| **Boosts** | 3 | 1 | 1 |
| **Analytics** | 11 | 2 | 1 |
| **Manager Dashboard** | 7 | 0 | 1 |
| **Risk Flags** | 2 | 0 | 1 |
| **Premium Features** | 4 | 0 | 2 |
| **TOTAL** | **26** | **3** | **6** |

---

**Last Updated**: 2025-01-15  
**Next Review**: After V3 stabilization (4-6 weeks)

