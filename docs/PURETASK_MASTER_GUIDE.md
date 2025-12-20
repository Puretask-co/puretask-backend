# PureTask Master Guide - Complete Reference

**Date**: 2025-01-15  
**Last Updated**: 2025-01-15  
**Version Coverage**: V1, V2, V3, V4 (All Complete)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture & Systems](#architecture--systems)
3. [Core Engines](#core-engines)
4. [API Endpoints - Complete Reference](#api-endpoints---complete-reference)
5. [Services & Business Logic](#services--business-logic)
6. [Workers & Background Jobs](#workers--background-jobs)
7. [Database Schema](#database-schema)
8. [Feature Capabilities by Version](#feature-capabilities-by-version)
9. [How Everything Works Together](#how-everything-works-together)
10. [Usage Examples](#usage-examples)
11. [Configuration & Environment](#configuration--environment)
12. [Monitoring & Observability](#monitoring--observability)

---

## Overview

PureTask is an Uber-style cleaning marketplace platform that connects clients with professional cleaners. The platform manages the complete job lifecycle from matching to payment, with sophisticated reliability scoring, tier-based pricing, and monetization features.

### Core Principles

- **Trust First**: Reliability scoring and tier system ensure quality
- **Fair Economics**: Tier-based payouts reward quality cleaners
- **Automation**: Workers handle routine tasks automatically
- **Audit Trail**: Complete event logging for transparency
- **Scalability**: Designed to handle growth from V1 to V4+

---

## Architecture & Systems

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│              (Web, iOS, Android, API Clients)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/REST API
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Express.js API Server                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Routes     │  │  Middleware  │  │   Services   │  │
│  │  (V1-V4)     │  │  (Auth, etc) │  │  (Business   │  │
│  │              │  │              │  │   Logic)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────────┐ ┌▼──────────────┐
│  PostgreSQL  │ │   Stripe    │ │  Background   │
│   Database   │ │   (Payments)│ │   Workers     │
│              │ │             │ │   (Cron Jobs) │
└──────────────┘ └─────────────┘ └───────────────┘
```

### Core Systems

#### 1. **Authentication & Authorization System**
- JWT-based authentication
- Role-based access control (client, cleaner, admin)
- Token-based API access
- Header-based authentication (`x-user-id`, `x-user-role`)

#### 2. **Job Lifecycle System**
- State machine-based job status management
- Event-driven architecture
- Complete audit trail via `job_events` table
- Status transitions: `requested` → `accepted` → `in_progress` → `awaiting_approval` → `completed`

#### 3. **Credit Economy System**
- Credit-based internal currency (1 credit = $0.10)
- Double-entry accounting via `credit_ledger`
- Escrow system for job payments
- Credit releases on job completion

#### 4. **Payment System**
- Stripe Connect for cleaner payouts
- Stripe Payment Intents for client payments
- Credit purchases via Stripe
- Automated payout processing

#### 5. **Matching System**
- Algorithm-based cleaner-job matching
- Distance-based selection
- Reliability and tier considerations
- Boost multiplier support (V4)

#### 6. **Reliability & Tier System**
- Dynamic reliability scoring (0-100)
- Four-tier system (Bronze, Silver, Gold, Platinum)
- Tier-based payout percentages
- Decay and penalty mechanisms

#### 7. **Analytics System** (V4)
- Real-time metrics dashboards
- Revenue and job trends
- User analytics
- Credit economy monitoring

---

## Core Engines

### 1. Matching Engine

**Location**: `src/services/jobMatchingService.ts`

**Purpose**: Matches clients' jobs with the best available cleaners based on multiple factors.

**How It Works**:
1. Receives job requirements (location, time, credits)
2. Finds available cleaners within radius
3. Scores each cleaner based on:
   - Reliability score (30% weight)
   - Tier (20% weight)
   - Distance (15% weight)
   - Price match (15% weight)
   - Past jobs with client (10% weight)
   - Response rate (10% weight)
   - Boost multiplier (V4 - applied to final score)
4. Returns ranked list of candidates

**Key Functions**:
- `findMatchingCleaners()` - Main matching algorithm
- `calculateMatchScore()` - Scoring calculation
- `assignCleanerToJob()` - Job assignment

**Usage**:
```typescript
const matches = await findMatchingCleaners(job, {
  limit: 10,
  minReliability: 50,
  autoAssign: false // V3: Manual selection, V5: Auto-assign
});
```

---

### 2. Reliability Engine

**Location**: `src/services/reliabilityService.ts`

**Purpose**: Calculates and maintains cleaner reliability scores, determines tiers.

**How It Works**:
1. Tracks cleaner performance metrics:
   - Completed jobs
   - Client ratings
   - Cancellations
   - No-shows
   - On-time performance
2. Calculates weighted reliability score (0-100)
3. Maps score to tier:
   - 0-49: Bronze (80% payout)
   - 50-69: Silver (85% payout)
   - 70-84: Gold (90% payout)
   - 85-100: Platinum (95% payout)
4. Applies decay over time (reduces score if inactive)
5. Applies penalties for violations

**Key Functions**:
- `updateCleanerReliability()` - Update score after job completion
- `getTierFromScore()` - Map score to tier
- `calculateReliabilityScore()` - Score calculation

**Usage**:
```typescript
await updateCleanerReliability(cleanerId, {
  jobId,
  rating: 5,
  onTime: true,
  noShow: false
});
```

---

### 3. Pricing Engine

**Location**: `src/services/pricingService.ts` (V3)

**Purpose**: Calculates tier-aware pricing for jobs.

**How It Works**:
1. Takes base hours and cleaning type
2. Applies tier-based rate adjustments:
   - Bronze: $8-12/hour
   - Silver: $10-15/hour
   - Gold: $12-18/hour
   - Platinum: $15-22/hour
3. Adds platform fee (configurable %)
4. Stores pricing snapshot at assignment time

**Key Functions**:
- `calculateJobPricing()` - Calculate pricing for specific tier
- `getPricingEstimate()` - Get price range across all tiers
- `getTierPriceBands()` - Get tier configuration

**Usage**:
```typescript
const pricing = calculateJobPricing({
  cleanerTier: 'gold',
  baseHours: 3,
  cleaningType: 'basic'
});
// Returns: { totalCredits, totalUsd, breakdown, ... }
```

---

### 4. Subscription Engine

**Location**: `src/services/premiumService.ts` (V3)

**Purpose**: Manages recurring cleaning subscriptions.

**How It Works**:
1. Client creates subscription (frequency, day, time, address)
2. Worker (`subscriptionJobs.ts`) generates jobs from subscriptions
3. Jobs follow normal lifecycle
4. Subscriptions can be paused, resumed, or cancelled

**Key Functions**:
- `createSubscription()` - Create new subscription
- `generateJobsFromSubscriptions()` - Worker function
- `pauseSubscription()`, `resumeSubscription()`, `cancelSubscription()`

**Usage**:
```typescript
const subscription = await createSubscription({
  clientId,
  frequency: 'weekly',
  dayOfWeek: 1, // Monday
  preferredTime: '10:00',
  address: '123 Main St',
  creditAmount: 200
});
```

---

### 5. Boost System

**Location**: `src/services/premiumService.ts` (V4)

**Purpose**: Allows cleaners to purchase visibility boosts.

**How It Works**:
1. Cleaner purchases boost (STANDARD, PREMIUM, MEGA)
2. Boost applies multiplier to match score (capped at 1.5x)
3. Boost expires after duration (7, 14, or 30 days)
4. Worker expires boosts automatically

**Key Functions**:
- `purchaseBoost()` - Purchase boost
- `getBoostMultiplier()` - Get active boost multiplier
- `expireBoosts()` - Worker function

**Boost Types**:
- STANDARD: 30 credits, 1.2x multiplier, 7 days
- PREMIUM: 60 credits, 1.35x multiplier, 14 days
- MEGA: 100 credits, 1.5x multiplier, 30 days

**Usage**:
```typescript
const boost = await purchaseBoost(cleanerId, 'STANDARD');
const multiplier = await getBoostMultiplier(cleanerId); // 1.2
```

---

### 6. Risk Assessment Engine

**Location**: `src/services/riskService.ts` (V4)

**Purpose**: Calculates risk scores for users to identify potential issues.

**How It Works**:
1. Analyzes user behavior patterns:
   - Dispute history
   - Cancellation rates
   - Payment issues
   - Account age
   - Activity patterns
2. Generates risk score (0-100, higher = more risk)
3. Flags high-risk users for admin review
4. No auto-bans (all actions require manual review)

**Key Functions**:
- `calculateRiskScore()` - Calculate risk for user
- `calculateRiskFlags()` - Identify risk flags
- `getUserRiskProfile()` - Get complete risk profile

**Usage**:
```typescript
const profile = await getUserRiskProfile(userId, 'client');
// Returns: { riskScore, flags, factors, ... }
```

---

### 7. Analytics Engine

**Location**: `src/services/analyticsService.ts` (V4)

**Purpose**: Provides comprehensive analytics and insights.

**Capabilities**:
- Revenue tracking and trends
- Job metrics and status breakdowns
- User growth and signup trends
- Top clients and cleaners
- Credit economy health
- KPI snapshots (daily/weekly)

**Key Functions**:
- `getDashboardMetrics()` - Overall dashboard
- `getRevenueTrend()` - Revenue over time
- `getJobTrend()` - Job metrics over time
- `getTopClients()`, `getTopCleaners()` - Leaderboards

---

## API Endpoints - Complete Reference

### Authentication (`/auth/*`)

#### `POST /auth/register`
**Purpose**: Register new user account  
**Version**: V1  
**Access**: Public  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "role": "client" | "cleaner"
}
```
**Response**: `{ user: {...}, token: "jwt_token" }`

#### `POST /auth/login`
**Purpose**: Login existing user  
**Version**: V1  
**Access**: Public  
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```
**Response**: `{ user: {...}, token: "jwt_token" }`

---

### Jobs (`/jobs/*` or `/`)

#### `POST /jobs`
**Purpose**: Create new cleaning job  
**Version**: V1  
**Access**: Client (authenticated)  
**Request Body**:
```json
{
  "address": "123 Main St",
  "scheduled_start_at": "2025-01-20T10:00:00Z",
  "scheduled_end_at": "2025-01-20T12:00:00Z",
  "credit_amount": 200,
  "cleaning_type": "basic" | "deep" | "moveout",
  "duration_hours": 2
}
```
**How It Works**:
1. Validates client has sufficient credits
2. Escrows credits (deducts from balance)
3. Creates job in `requested` status
4. Publishes `job_created` event
5. Returns job object

**Response**: `{ job: {...} }`

#### `GET /jobs`
**Purpose**: List jobs for authenticated user  
**Version**: V1  
**Access**: Client/Cleaner (returns their jobs)  
**Query Params**: `status`, `limit`, `offset`  
**Response**: `{ jobs: [...] }`

#### `GET /jobs/:jobId`
**Purpose**: Get job details  
**Version**: V1  
**Access**: Job participant (client/cleaner) or admin  
**Response**: `{ job: {...} }`

#### `POST /jobs/:jobId/transition`
**Purpose**: Transition job to new status  
**Version**: V1  
**Access**: Client/Cleaner (role-dependent)  
**Request Body**:
```json
{
  "eventType": "job_accepted" | "client_approved" | "job_completed" | ...
}
```
**Status Transitions**:
- `requested` → `accepted` (cleaner accepts)
- `accepted` → `in_progress` (cleaner checks in)
- `in_progress` → `awaiting_approval` (cleaner completes)
- `awaiting_approval` → `completed` (client approves)

#### `GET /jobs/:jobId/candidates` (V3)
**Purpose**: Get top matched cleaners for job  
**Version**: V3 (Smart Match Engine)  
**Access**: Client (job owner)  
**How It Works**:
1. Calls matching engine
2. Returns top 5-10 cleaners ranked by score
3. Includes score, reasons, and match details
4. Client can then send offers to top 3

**Response**:
```json
{
  "candidates": [
    {
      "cleanerId": "uuid",
      "tier": "gold",
      "reliabilityScore": 85,
      "score": 92,
      "reasons": ["High reliability", "Perfect distance match", ...]
    }
  ]
}
```

#### `POST /jobs/:jobId/offer` (V3)
**Purpose**: Send job offer to selected cleaners  
**Version**: V3 (Smart Match Engine)  
**Access**: Client (job owner)  
**Request Body**:
```json
{
  "cleanerIds": ["uuid1", "uuid2", "uuid3"]
}
```
**How It Works**:
1. Validates up to 3 cleaners
2. Creates offers with 30-minute expiration
3. First cleaner to accept gets job
4. Other offers expire when job accepted

---

### Cleaner Endpoints (`/cleaner/*`)

#### `GET /cleaner/reliability`
**Purpose**: Get cleaner's reliability breakdown  
**Version**: V1  
**Access**: Cleaner (own data)  
**Response**:
```json
{
  "breakdown": {
    "current_score": 85,
    "tier": "gold",
    "factors": [...],
    "history": [...]
  }
}
```

#### `GET /cleaner/earnings` (V3)
**Purpose**: Get cleaner earnings dashboard  
**Version**: V3 (Cleaner Wallet UX)  
**Access**: Cleaner (own data)  
**Response**:
```json
{
  "earnings": {
    "pendingEarnings": {
      "credits": 500,
      "usd": 50.00,
      "jobs": 5
    },
    "paidOut": {
      "credits": 2000,
      "usd": 200.00,
      "jobs": 20,
      "lastPayout": "2025-01-10T00:00:00Z"
    },
    "nextPayout": {
      "date": "2025-01-17T00:00:00Z",
      "estimatedCredits": 500,
      "estimatedUsd": 50.00
    },
    "payoutSchedule": "weekly"
  }
}
```

---

### Pricing Endpoints (`/pricing/*`) - V3

#### `GET /pricing/estimate`
**Purpose**: Get pricing estimate for job  
**Version**: V3 (Tier-Aware Pricing)  
**Access**: Authenticated  
**Query Params**:
- `hours` (required): Number of hours
- `tier` (optional): Specific tier (bronze/silver/gold/platinum)
- `baseRate` (optional): Override base rate
- `cleaningType` (optional): basic/deep/moveout

**Response** (all tiers):
```json
{
  "hours": 3,
  "estimate": {
    "minPrice": 30.00,
    "maxPrice": 45.00,
    "minCredits": 300,
    "maxCredits": 450,
    "breakdown": {
      "bronze": { "totalUsd": 30.00, "totalCredits": 300, ... },
      "silver": { "totalUsd": 35.00, "totalCredits": 350, ... },
      "gold": { "totalUsd": 40.00, "totalCredits": 400, ... },
      "platinum": { "totalUsd": 45.00, "totalCredits": 450, ... }
    }
  }
}
```

#### `GET /pricing/tiers`
**Purpose**: Get tier price bands configuration  
**Version**: V3  
**Access**: Authenticated  
**Response**: `{ priceBands: { bronze: {...}, silver: {...}, ... } }`

---

### Premium Endpoints (`/premium/*`) - V3/V4

#### `POST /premium/subscriptions`
**Purpose**: Create recurring cleaning subscription  
**Version**: V3 (Subscription Engine)  
**Access**: Client  
**Request Body**:
```json
{
  "frequency": "weekly" | "biweekly" | "monthly",
  "dayOfWeek": 1, // 1=Monday, 7=Sunday
  "preferredTime": "10:00",
  "address": "123 Main St",
  "creditAmount": 200
}
```

#### `GET /premium/subscriptions`
**Purpose**: List client's subscriptions  
**Version**: V3  
**Access**: Client  

#### `POST /premium/subscriptions/:id/pause`
**Purpose**: Pause subscription  
**Version**: V3  
**Access**: Client (subscription owner)  

#### `POST /premium/subscriptions/:id/resume`
**Purpose**: Resume paused subscription  
**Version**: V3  
**Access**: Client (subscription owner)  

#### `POST /premium/subscriptions/:id/cancel`
**Purpose**: Cancel subscription  
**Version**: V3  
**Access**: Client (subscription owner)  

#### `GET /premium/boosts/options` (V4)
**Purpose**: Get available boost options  
**Version**: V4  
**Access**: Cleaner  
**Response**: `{ options: [{ type: "STANDARD", credits: 30, multiplier: 1.2, ... }] }`

#### `GET /premium/boosts/active` (V4)
**Purpose**: Get cleaner's active boost  
**Version**: V4  
**Access**: Cleaner  
**Response**: `{ boost: {...} }` or `{ boost: null }`

#### `POST /premium/boosts/purchase` (V4)
**Purpose**: Purchase visibility boost  
**Version**: V4  
**Access**: Cleaner  
**Request Body**: `{ boostType: "STANDARD" | "PREMIUM" | "MEGA" }`  
**How It Works**:
1. Validates cleaner has sufficient credits
2. Checks no active boost exists
3. Deducts credits
4. Creates boost record
5. Boost applies to next matching cycles

#### `GET /premium/referrals/code` (V4)
**Purpose**: Get or generate referral code  
**Version**: V4  
**Access**: Authenticated  
**Response**: `{ code: {...} }`

#### `GET /premium/referrals/stats` (V4)
**Purpose**: Get referral statistics  
**Version**: V4  
**Access**: Authenticated  
**Response**: `{ stats: { total, pending, earned, ... } }`

#### `POST /premium/rush/calculate` (V4)
**Purpose**: Calculate rush job fee  
**Version**: V4  
**Access**: Client  
**Request Body**:
```json
{
  "scheduledStartAt": "2025-01-15T14:00:00Z",
  "baseCredits": 200
}
```
**Response**: `{ isRush: true, rushFee: 50, totalCredits: 250 }`

---

### V2 Routes (`/v2/*`) - Enhanced Features

#### Properties (`/v2/properties/*`)
- `POST /v2/properties` - Create property
- `GET /v2/properties` - List properties
- `GET /v2/properties/:id` - Get property
- `PUT /v2/properties/:id` - Update property
- `DELETE /v2/properties/:id` - Delete property
- `GET /v2/properties/:id/suggestions` - Get property suggestions

**Purpose**: Multi-property management for clients

#### Teams (`/v2/teams/*`)
- `POST /v2/teams` - Create team
- `GET /v2/teams` - List teams
- `GET /v2/teams/:id` - Get team
- `POST /v2/teams/:id/members` - Add member
- `DELETE /v2/teams/:id/members/:memberId` - Remove member
- `GET /v2/teams/:id/stats` - Get team statistics

**Purpose**: Cleaner team management and collaboration

#### Calendar (`/v2/calendar/*`)
- `GET /v2/calendar/connect` - Get Google Calendar OAuth URL
- `POST /v2/calendar/callback` - Handle OAuth callback
- `GET /v2/calendar/status` - Get connection status
- `POST /v2/calendar/sync` - Sync calendar
- `GET /v2/calendar/events` - Get calendar events

**Purpose**: Google Calendar integration for availability sync

#### AI (`/v2/ai/*`)
- `POST /v2/ai/checklist` - Generate cleaning checklist
- `POST /v2/ai/dispute-suggestion` - Get dispute resolution suggestion (admin only)

**Purpose**: AI-powered assistance (OpenAI integration)

#### Cleaner Goals (`/v2/cleaner/goals/*`)
- `GET /v2/cleaner/goals` - Get cleaner goals
- `GET /v2/cleaner/route-suggestions` - Get route optimization suggestions
- `GET /v2/cleaner/reliability-breakdown` - Get detailed reliability breakdown

**Purpose**: Goal tracking and route optimization

---

### Analytics Endpoints (`/analytics/*`) - V4

**Access**: Admin only

#### `GET /analytics/dashboard`
**Purpose**: Get dashboard overview metrics  
**Query Params**: `timeRange` (day/week/month/year)  
**Response**: `{ metrics: { revenue, users, jobs, credits, cleaners, ... } }`

#### `GET /analytics/revenue/trend`
**Purpose**: Get revenue trend over time  
**Query Params**: `timeRange`  
**Response**: `{ trend: [{ date, revenue, ... }] }`

#### `GET /analytics/revenue/by-period`
**Purpose**: Get revenue grouped by period  
**Query Params**: `timeRange`, `groupBy` (day/week/month)  
**Response**: `{ data: [{ period, revenue, ... }] }`

#### `GET /analytics/jobs/trend`
**Purpose**: Get job metrics trend  
**Query Params**: `timeRange`  
**Response**: `{ trend: [{ date, count, ... }] }`

#### `GET /analytics/jobs/status`
**Purpose**: Get job status breakdown  
**Query Params**: `timeRange`  
**Response**: `{ breakdown: { requested: 10, accepted: 8, ... } }`

#### `GET /analytics/users/signups`
**Purpose**: Get user signup trends  
**Query Params**: `timeRange`, `role` (client/cleaner/all)  
**Response**: `{ trend: [{ date, signups, ... }] }`

#### `GET /analytics/top/clients`
**Purpose**: Get top clients by revenue/jobs  
**Query Params**: `timeRange`, `limit`  
**Response**: `{ data: [{ clientId, revenue, jobs, ... }] }`

#### `GET /analytics/top/cleaners`
**Purpose**: Get top cleaners by jobs/revenue  
**Query Params**: `timeRange`, `limit`  
**Response**: `{ data: [{ cleanerId, jobs, revenue, ... }] }`

#### `GET /analytics/top/rated-cleaners`
**Purpose**: Get top rated cleaners  
**Query Params**: `limit`  
**Response**: `{ data: [{ cleanerId, rating, jobs, ... }] }`

#### `GET /analytics/credits/health`
**Purpose**: Get credit economy health metrics  
**Response**: `{ health: { totalSupply, circulatingCredits, ... } }`

#### `GET /analytics/report`
**Purpose**: Generate full analytics report  
**Query Params**: `timeRange`  
**Response**: `{ generatedAt, metrics, trends, ... }`

---

### Manager Dashboard (`/manager/*`) - V4

**Access**: Admin only

#### `GET /manager/overview`
**Purpose**: Get manager dashboard overview  
**Response**: `{ overview: { gmv, credits, jobs, users, rates, ... } }`

#### `GET /manager/alerts`
**Purpose**: Get active system alerts  
**Response**: `{ alerts: [...], count: 5 }`

#### `GET /manager/heatmap`
**Purpose**: Get supply/demand heatmap  
**Response**: `{ heatmap: { regions: [...], ... } }`

#### `GET /manager/tiers`
**Purpose**: Get tier distribution  
**Response**: `{ distribution: { bronze: 10, silver: 20, gold: 15, platinum: 5 } }`

#### `GET /manager/retention`
**Purpose**: Get retention cohorts  
**Response**: `{ cohorts: [{ cohort, retention: [...] }] }`

#### `GET /manager/support-stats`
**Purpose**: Get support statistics  
**Response**: `{ stats: { openTickets, resolvedTickets, ... } }`

#### `GET /manager/background-check-stats`
**Purpose**: Get background check statistics  
**Response**: `{ stats: { pending, approved, rejected, ... } }`

#### `GET /manager/full-report`
**Purpose**: Generate full manager report  
**Response**: `{ generatedAt, overview, alerts, heatmap, tiers, retention, ... }`

---

### Risk & Admin (`/admin/*`)

#### `GET /admin/risk/review` (V4)
**Purpose**: Get risk review queue  
**Access**: Admin  
**Response**: `{ queue: [...], count: 5 }`

#### `GET /admin/risk/:userId` (V4)
**Purpose**: Get user risk profile  
**Access**: Admin  
**Query Params**: `role` (client/cleaner)  
**Response**: `{ profile: { userId, riskScore, flags, factors, ... } }`

---

## Services & Business Logic

### Core Services

#### `reliabilityService.ts`
**Purpose**: Reliability scoring and tier management  
**Key Functions**:
- `updateCleanerReliability()` - Update score after job
- `getTierFromScore()` - Map score to tier
- `applyReliabilityPenalty()` - Apply penalty
- `getReliabilityBreakdown()` - Get detailed breakdown

#### `jobMatchingService.ts`
**Purpose**: Job-cleaner matching algorithm  
**Key Functions**:
- `findMatchingCleaners()` - Main matching function
- `calculateMatchScore()` - Score calculation
- `assignCleanerToJob()` - Assign cleaner to job
- `reassignCleanerWithPenalty()` - Reassign with penalty

#### `pricingService.ts` (V3)
**Purpose**: Tier-aware pricing calculations  
**Key Functions**:
- `calculateJobPricing()` - Calculate pricing
- `getPricingEstimate()` - Get price estimates
- `getTierPriceBands()` - Get tier configuration

#### `premiumService.ts` (V3/V4)
**Purpose**: Subscriptions, boosts, referrals  
**Key Functions**:
- `createSubscription()` - Create subscription
- `purchaseBoost()` - Purchase boost
- `getBoostMultiplier()` - Get active boost
- `generateReferralCode()` - Generate referral code

#### `earningsService.ts` (V3)
**Purpose**: Cleaner earnings dashboard  
**Key Functions**:
- `getCleanerEarnings()` - Get earnings breakdown

#### `analyticsService.ts` (V4)
**Purpose**: Analytics and metrics  
**Key Functions**:
- `getDashboardMetrics()` - Dashboard overview
- `getRevenueTrend()` - Revenue trends
- `getJobTrend()` - Job trends
- Various top/list functions

#### `managerService.ts` (V4)
**Purpose**: Manager dashboard data  
**Key Functions**:
- `getManagerOverview()` - Overview metrics
- `getActiveAlerts()` - System alerts
- `getHeatmapData()` - Supply/demand heatmap
- Various manager-specific functions

#### `riskService.ts` (V4)
**Purpose**: Risk assessment and flagging  
**Key Functions**:
- `calculateRiskScore()` - Calculate risk
- `calculateRiskFlags()` - Identify flags
- `getUserRiskProfile()` - Get profile
- `getRiskReviewQueue()` - Get review queue

#### `creditsService.ts`
**Purpose**: Credit management  
**Key Functions**:
- `getUserCreditBalance()` - Get balance
- `purchaseCredits()` - Purchase credits
- `escrowCredits()` - Escrow for job
- `releaseCredits()` - Release to cleaner

#### `payoutsService.ts`
**Purpose**: Stripe Connect payouts  
**Key Functions**:
- `getCleanerPayoutPercent()` - Get tier-based payout %
- `createPayout()` - Create payout
- `processPayouts()` - Process weekly payouts

#### `availabilityService.ts`
**Purpose**: Cleaner availability management  
**Key Functions**:
- `isCleanerAvailableForSlot()` - Check availability
- `getPreferences()` - Get cleaner preferences

#### `disputesService.ts`
**Purpose**: Dispute management  
**Key Functions**:
- `createDispute()` - Create dispute
- `resolveDispute()` - Resolve dispute

---

## Workers & Background Jobs

### Worker Overview

Workers are background processes that run on scheduled intervals (via cron) to handle routine tasks, maintenance, and automation.

### Worker Runner

**Location**: `src/workers/index.ts`

**How Workers Are Scheduled**:
- Railway cron jobs
- Manual execution via npm scripts
- Recommended schedules in `docs/WORKER_SCHEDULE.md`

---

### Active Workers (Complete List)

#### 1. `reliabilityRecalc.ts`
**Purpose**: Recalculate all cleaner reliability scores  
**Schedule**: Daily at 3 AM UTC  
**Command**: `npm run worker:reliability-recalc`  
**What It Does**:
1. Fetches all cleaners
2. Recalculates reliability scores based on recent performance
3. Updates tiers if score changed significantly
4. Logs updates

**When To Run**: Daily maintenance to keep scores accurate

---

#### 2. `creditEconomyMaintenance.ts`
**Purpose**: Apply reliability decay and manage tier locks  
**Schedule**: Daily at 4 AM UTC  
**Command**: `npm run worker:credit-economy`  
**What It Does**:
1. Applies reliability decay to inactive cleaners
2. Manages tier locks (temporary promotions)
3. Maintains credit economy health

**When To Run**: Daily to keep economy balanced

---

#### 3. `cleaningScores.ts` (V2)
**Purpose**: Recalculate cleaning scores for properties  
**Schedule**: Daily at 2 AM UTC  
**Command**: `npm run worker:cleaning-scores`  
**What It Does**:
1. Calculates cleaning scores per property
2. Updates property records
3. Influences matching for future jobs

**When To Run**: Daily to maintain property-based scoring

---

#### 4. `goalChecker.ts` (V2)
**Purpose**: Check and award cleaner goals  
**Schedule**: Daily at 5 AM UTC  
**Command**: `npm run worker:goal-checker`  
**What It Does**:
1. Checks cleaner goal progress
2. Awards goals when criteria met
3. Sends notifications

**When To Run**: Daily to track goals

---

#### 5. `stuckJobDetection.ts` (V2)
**Purpose**: Detect stuck jobs, payouts, and system issues  
**Schedule**: Every 15 minutes  
**Command**: `npm run worker:stuck-detection`  
**What It Does**:
1. Detects jobs stuck in states too long
2. Detects no-show jobs
3. Checks for stuck payouts
4. Finds ledger inconsistencies
5. Sends alerts for issues

**When To Run**: Frequently (15 min intervals) for real-time monitoring

---

#### 6. `subscriptionJobs.ts` (V3)
**Purpose**: Generate jobs from active subscriptions  
**Schedule**: Daily at 2 AM UTC  
**Command**: `npm run worker:subscription-jobs`  
**What It Does**:
1. Finds active subscriptions due for job generation
2. Creates jobs based on subscription settings
3. Matches with cleaners
4. Notifies clients and cleaners

**When To Run**: Daily to process recurring subscriptions

**Example**:
- Weekly subscription on Monday 10 AM
- Worker runs Monday 2 AM
- Creates job for Monday 10 AM
- Job follows normal lifecycle

---

#### 7. `expireBoosts.ts` (V4)
**Purpose**: Expire expired boosts  
**Schedule**: Daily at 2 AM UTC  
**Command**: `npm run worker:expire-boosts`  
**What It Does**:
1. Finds boosts where `expires_at < NOW()`
2. Updates status to `expired`
3. Removes multiplier effect

**When To Run**: Daily to clean up expired boosts

---

#### 8. `kpiDailySnapshot.ts` (V4)
**Purpose**: Create daily KPI snapshot  
**Schedule**: Daily at 3 AM UTC  
**Command**: `npm run worker:kpi-daily`  
**What It Does**:
1. Calculates key metrics for the day
2. Stores snapshot in `kpi_snapshots` table
3. Enables historical analytics

**When To Run**: Daily to build analytics history

**Metrics Captured**:
- Revenue
- Job counts
- User counts
- Credit economy metrics
- Tier distribution

---

#### 9. `weeklySummary.ts` (V4)
**Purpose**: Generate weekly summary reports  
**Schedule**: Weekly on Monday at 4 AM UTC  
**Command**: `npm run worker:weekly-summary`  
**What It Does**:
1. Aggregates weekly metrics
2. Generates summary report
3. Sends to admins (if configured)
4. Stores for historical reference

**When To Run**: Weekly for reporting

---

#### 10. `payoutWeekly.ts`
**Purpose**: Process weekly cleaner payouts  
**Schedule**: Weekly on Sunday at 2 AM UTC  
**Command**: `npm run worker:payout-weekly`  
**What It Does**:
1. Finds cleaners with pending earnings
2. Creates payout records
3. Processes via Stripe Connect
4. Updates payout status
5. Notifies cleaners

**When To Run**: Weekly for cleaner payments

---

#### 11. `autoCancelJobs.ts`
**Purpose**: Auto-cancel jobs that haven't been accepted  
**Schedule**: Hourly  
**Command**: `npm run worker:auto-cancel`  
**What It Does**:
1. Finds jobs in `requested` status too long
2. Cancels jobs
3. Refunds credits to client
4. Sends notifications

**When To Run**: Frequently to clean up unaccepted jobs

---

#### 12. `autoExpireAwaitingApproval.ts`
**Purpose**: Auto-approve jobs awaiting client approval too long  
**Schedule**: Daily at 6 AM UTC  
**Command**: `npm run worker:auto-expire`  
**What It Does**:
1. Finds jobs in `awaiting_approval` > 48 hours
2. Auto-approves with default rating (5 stars)
3. Releases credits to cleaner
4. Creates payout record

**When To Run**: Daily to handle client non-response

---

#### 13. `backupDaily.ts`
**Purpose**: Create database backup  
**Schedule**: Daily at 1 AM UTC  
**Command**: `npm run worker:backup-daily`  
**What It Does**:
1. Creates database backup
2. Stores in configured backup location
3. Maintains backup retention policy

**When To Run**: Daily for disaster recovery

---

#### 14. `retryFailedNotifications.ts`
**Purpose**: Retry failed notifications  
**Schedule**: Every 30 minutes  
**Command**: `npm run worker:retry-notifications`  
**What It Does**:
1. Finds failed notifications
2. Retries with exponential backoff
3. Updates status on success/failure

**When To Run**: Frequently to ensure notifications delivered

---

#### 15. `webhookRetry.ts`
**Purpose**: Retry failed webhooks  
**Schedule**: Every 15 minutes  
**Command**: `npm run worker:webhook-retry`  
**What It Does**:
1. Finds failed webhook deliveries
2. Retries with exponential backoff
3. Updates status

**When To Run**: Frequently for external integrations

---

#### 16. `payoutRetry.ts`
**Purpose**: Retry failed payouts  
**Schedule**: Daily at 8 AM UTC  
**Command**: `npm run worker:payout-retry`  
**What It Does**:
1. Finds failed payout attempts
2. Retries via Stripe
3. Updates status

**When To Run**: Daily to recover failed payments

---

#### 17. `queueProcessor.ts`
**Purpose**: Process background job queue  
**Schedule**: Continuous (runs constantly)  
**Command**: `npm run worker:queue-processor`  
**What It Does**:
1. Polls job queue
2. Processes queued tasks
3. Handles async operations

**When To Run**: Continuously for async task processing

---

### Worker Schedule Summary

| Worker | Frequency | Time | Purpose |
|--------|-----------|------|---------|
| backupDaily | Daily | 1 AM | Database backup |
| subscriptionJobs | Daily | 2 AM | Generate subscription jobs |
| expireBoosts | Daily | 2 AM | Expire boosts |
| cleaningScores | Daily | 2 AM | Recalculate property scores |
| reliabilityRecalc | Daily | 3 AM | Recalculate reliability |
| kpiDailySnapshot | Daily | 3 AM | Create KPI snapshot |
| creditEconomyMaintenance | Daily | 4 AM | Economy maintenance |
| goalChecker | Daily | 5 AM | Check goals |
| autoExpireAwaitingApproval | Daily | 6 AM | Auto-approve old jobs |
| payoutRetry | Daily | 8 AM | Retry failed payouts |
| payoutWeekly | Weekly | Sunday 2 AM | Weekly payouts |
| weeklySummary | Weekly | Monday 4 AM | Weekly reports |
| stuckJobDetection | Every 15 min | - | Monitor stuck jobs |
| webhookRetry | Every 15 min | - | Retry webhooks |
| retryFailedNotifications | Every 30 min | - | Retry notifications |
| autoCancelJobs | Hourly | - | Cancel unaccepted jobs |
| queueProcessor | Continuous | - | Process queue |

---

## Database Schema

### Core Tables

#### `users`
**Purpose**: User accounts  
**Key Columns**:
- `id` (TEXT, UUID)
- `email` (CITEXT, unique)
- `password_hash`
- `role` (client/cleaner/admin)
- `created_at`, `updated_at`

#### `jobs`
**Purpose**: Cleaning jobs  
**Key Columns**:
- `id` (UUID)
- `client_id` (TEXT, FK to users)
- `cleaner_id` (TEXT, FK to users, nullable)
- `status` (job_status enum)
- `address`, `scheduled_start_at`, `scheduled_end_at`
- `credit_amount`
- `pricing_snapshot` (JSONB, V3)
- `created_at`, `updated_at`

**Status Values**:
- `requested` - Job created, waiting for cleaner
- `accepted` - Cleaner accepted
- `on_my_way` - Cleaner en route
- `in_progress` - Cleaning in progress
- `awaiting_approval` - Waiting for client approval
- `completed` - Job completed
- `disputed` - Client disputed
- `cancelled` - Cancelled

#### `credit_ledger`
**Purpose**: Credit transaction log (double-entry accounting)  
**Key Columns**:
- `id` (UUID)
- `user_id` (TEXT, FK to users)
- `job_id` (UUID, FK to jobs, nullable)
- `amount` (INTEGER)
- `direction` (credit/debit)
- `reason` (credit_reason enum)
- `created_at`

**Reason Values**:
- `purchase` - Credit purchase
- `job_escrow` - Job payment escrowed
- `job_release` - Credits released to cleaner
- `refund` - Refund to client
- `adjustment` - Admin adjustment

#### `cleaner_profiles`
**Purpose**: Cleaner-specific data  
**Key Columns**:
- `user_id` (TEXT, FK to users, unique)
- `tier` (bronze/silver/gold/platinum)
- `reliability_score` (0-100)
- `hourly_rate_credits`
- `stripe_connect_account_id`
- `created_at`

#### `payouts`
**Purpose**: Cleaner payout records  
**Key Columns**:
- `id` (UUID)
- `cleaner_id` (TEXT, FK to users)
- `job_id` (UUID, FK to jobs)
- `amount_credits`, `amount_cents`
- `payout_percent`
- `status` (pending/paid/failed)
- `stripe_transfer_id`
- `created_at`

#### `job_events`
**Purpose**: Complete audit trail of job lifecycle  
**Key Columns**:
- `id` (UUID)
- `job_id` (UUID, FK to jobs)
- `actor_type` (client/cleaner/admin/system)
- `actor_id` (TEXT, nullable for system)
- `event_type` (TEXT)
- `payload` (JSONB)
- `created_at`

---

### V2 Tables

#### `properties`
**Purpose**: Client properties  
**Key Columns**:
- `id` (UUID)
- `client_id` (TEXT, FK to users)
- `label`, `address_line1`, `city`, `state_region`, `postal_code`
- `bedrooms`, `bathrooms`, `square_feet`
- `cleaning_score` (calculated)
- `created_at`, `updated_at`

#### `cleaner_teams`
**Purpose**: Cleaner teams  
**Key Columns**:
- `id` (UUID)
- `name`, `description`
- `leader_id` (TEXT, FK to users)
- `created_at`

#### `team_members`
**Purpose**: Team membership  
**Key Columns**:
- `team_id` (UUID, FK to cleaner_teams)
- `cleaner_id` (TEXT, FK to users)
- `role` (member/leader)
- `joined_at`

#### `cleaner_goals`
**Purpose**: Cleaner monthly goals  
**Key Columns**:
- `id` (UUID)
- `cleaner_id` (TEXT, FK to users)
- `month`, `year`
- `target_jobs`, `target_revenue`
- `current_jobs`, `current_revenue`
- `achieved_at` (nullable)

#### `calendar_connections`
**Purpose**: Google Calendar OAuth connections  
**Key Columns**:
- `id` (UUID)
- `user_id` (TEXT, FK to users)
- `google_calendar_id`
- `access_token`, `refresh_token`
- `expires_at`
- `created_at`

---

### V3 Tables

#### `cleaning_subscriptions`
**Purpose**: Recurring cleaning subscriptions  
**Key Columns**:
- `id` (UUID)
- `client_id` (TEXT, FK to users)
- `frequency` (weekly/biweekly/monthly)
- `day_of_week` (1-7)
- `preferred_time`
- `address`
- `credit_amount`
- `status` (active/paused/cancelled)
- `created_at`, `updated_at`

---

### V4 Tables

#### `cleaner_boosts`
**Purpose**: Active visibility boosts  
**Key Columns**:
- `id` (UUID)
- `cleaner_id` (TEXT, FK to users)
- `boost_type` (standard/premium/mega)
- `multiplier` (1.2/1.35/1.5)
- `cost_credits`
- `status` (active/expired)
- `purchased_at`, `expires_at`

#### `kpi_snapshots`
**Purpose**: Daily KPI snapshots  
**Key Columns**:
- `id` (UUID)
- `snapshot_date` (DATE)
- `metrics` (JSONB)
- `created_at`

**Metrics Include**:
- Revenue totals
- Job counts by status
- User counts by role
- Credit economy metrics
- Tier distribution

#### `referral_codes`
**Purpose**: User referral codes  
**Key Columns**:
- `id` (UUID)
- `user_id` (TEXT, FK to users)
- `code` (TEXT, unique)
- `reward_credits`, `referee_credits`
- `uses_count`, `max_uses`
- `is_active`
- `created_at`, `expires_at`

#### `referrals`
**Purpose**: Referral tracking  
**Key Columns**:
- `id` (UUID)
- `referrer_id` (TEXT, FK to users)
- `referee_id` (TEXT, FK to users)
- `referral_code` (TEXT)
- `status` (pending/rewarded)
- `jobs_completed`, `jobs_required`
- `created_at`, `rewarded_at`

---

## Feature Capabilities by Version

### V1 - Core Features ✅

**Status**: Complete, Tested, Deployed

#### Reliability System
- Reliability scoring (0-100)
- Four-tier system (Bronze/Silver/Gold/Platinum)
- Tier-based payout percentages
- Reliability penalties
- Reliability decay

#### Job Matching
- Distance-based matching
- Reliability and tier consideration
- Top candidate selection
- Manual assignment

#### Credit Economy
- Credit-based currency
- Escrow system
- Credit releases
- Refunds

#### Payment System
- Stripe integration
- Credit purchases
- Cleaner payouts (Stripe Connect)
- Weekly payout processing

#### Job Lifecycle
- Complete state machine
- Event logging
- Status transitions
- Dispute handling

---

### V2 - Enhanced Features ✅

**Status**: Complete, Tested, Deployed

#### Properties
- Multi-property management
- Property-specific cleaning scores
- Property suggestions

#### Teams
- Cleaner team creation
- Team membership
- Team statistics

#### Calendar Integration
- Google Calendar OAuth
- Availability sync
- Calendar event management

#### AI Features
- Cleaning checklist generation (OpenAI)
- Dispute resolution suggestions (OpenAI)

#### Cleaner Goals
- Monthly goal tracking
- Goal achievement awards
- Route optimization suggestions

#### Enhanced Reliability V2
- Property-based reliability scoring
- Enhanced scoring factors

#### Enhanced Dispute Engine
- Improved dispute workflow
- Better resolution tracking

---

### V3 - Optimization Features ✅

**Status**: Complete, Tested, Deployed

#### Smart Match Engine
- Top 3 cleaner selection
- Offer-based assignment
- Match explanation

#### Tier-Aware Pricing
- Dynamic pricing by tier
- Price estimates
- Pricing snapshots stored

#### Subscription Engine
- Recurring cleaning subscriptions
- Subscription management (pause/resume/cancel)
- Automatic job generation

#### Cleaner Wallet UX
- Earnings dashboard
- Pending/paid breakdown
- Next payout information

---

### V4 - Monetization & Analytics ✅

**Status**: Complete, Deployed (Some tests need fixes)

#### Boosts
- Visibility boost purchases
- Boost multipliers in matching
- Boost expiration

#### Analytics Dashboards
- Revenue analytics
- Job analytics
- User analytics
- Credit economy health
- Top performers

#### Manager Dashboard
- System overview
- Active alerts
- Supply/demand heatmap
- Tier distribution
- Retention cohorts

#### Risk Flags
- Risk scoring
- Risk flag identification
- Risk review queue

#### Premium Features
- Rush job fees
- Referral system
- Referral leaderboard

---

## How Everything Works Together

### Complete Job Lifecycle Flow

#### 1. Job Creation (Client)
```
Client creates job via POST /jobs
  ↓
Credits escrowed (deducted from balance)
  ↓
Job created in 'requested' status
  ↓
Job event: 'job_created' published
  ↓
V3: Client gets candidates via GET /jobs/:id/candidates
  ↓
V3: Client sends offers via POST /jobs/:id/offer
  OR
V1: System matches and assigns cleaner
```

#### 2. Job Assignment (Cleaner)
```
Cleaner receives offer/notification
  ↓
Cleaner accepts via POST /jobs/:id/transition (eventType: 'job_accepted')
  ↓
Job status → 'accepted'
  ↓
V3: Pricing snapshot stored in job.pricing_snapshot
  ↓
Job event: 'job_accepted' published
```

#### 3. Job Execution
```
Cleaner checks in via POST /jobs/:id/transition (eventType: 'job_started')
  ↓
Job status → 'in_progress'
  ↓
Cleaner completes via POST /jobs/:id/transition (eventType: 'job_completed')
  ↓
Job status → 'awaiting_approval'
  ↓
Job event: 'job_completed' published
```

#### 4. Job Completion
```
Client approves via POST /jobs/:id/transition (eventType: 'client_approved')
  ↓
Credits released to cleaner (credit_ledger entry)
  ↓
Payout record created
  ↓
Reliability score updated (based on rating)
  ↓
Job status → 'completed'
  ↓
Job event: 'client_approved' published
  ↓
Payout processed (weekly via worker)
```

#### 5. Alternative: Dispute Flow
```
Client disputes via POST /jobs/:id/transition (eventType: 'client_disputed')
  ↓
Job status → 'disputed'
  ↓
Admin reviews and resolves
  ↓
If refund: Credits refunded to client
  ↓
If no refund: Credits released to cleaner
  ↓
Job status → 'completed'
```

---

### Matching Flow Integration

#### V3 Smart Match (Current)
```
1. Client creates job
2. Client calls GET /jobs/:id/candidates
   → Matching engine scores cleaners
   → V4: Boost multiplier applied
   → Returns top 5-10 candidates
3. Client selects top 3
4. Client calls POST /jobs/:id/offer
   → Offers created with 30-min expiration
5. First cleaner accepts → Job assigned
   → Other offers expire
```

#### V5 Future: Full Auto-Matching (Planned)
```
1. Client creates job
2. Matching engine calculates confidence score
3. If confidence > threshold:
   → Auto-assign immediately
   → Notify client and cleaner
4. If confidence < threshold:
   → Require client approval (same as V3)
```

---

### Reliability & Tier Integration

```
Job Completed
  ↓
updateCleanerReliability() called
  ↓
Calculates new score based on:
  - Previous score
  - Rating (5 stars = +5, 1 star = -10)
  - On-time performance
  - Cancellation history
  ↓
New score calculated (0-100)
  ↓
getTierFromScore() maps to tier:
  - 0-49: Bronze
  - 50-69: Silver
  - 70-84: Gold
  - 85-100: Platinum
  ↓
Tier updated in cleaner_profile
  ↓
Payout percentage determined by tier:
  - Bronze: 80%
  - Silver: 85%
  - Gold: 90%
  - Platinum: 95%
  ↓
Next payout uses new percentage
```

---

### Pricing Integration (V3)

```
Job Created
  ↓
Cleaner Assigned
  ↓
calculateJobPricing() called with:
  - Cleaner tier
  - Job hours
  - Cleaning type
  ↓
Pricing calculated:
  - Base rate from cleaning type
  - Tier adjustment applied
  - Platform fee added
  ↓
Pricing snapshot stored in job.pricing_snapshot
  ↓
This snapshot used for:
  - Payout calculation
  - Dispute resolution
  - Analytics
```

---

### Boost Integration (V4)

```
Cleaner Purchases Boost
  ↓
Boost record created in cleaner_boosts
  ↓
Status: 'active', expires_at set
  ↓
Next Matching Cycle:
  ↓
Matching engine finds candidates
  ↓
getBoostMultiplier() called for each cleaner
  ↓
If active boost exists:
  → Multiplier applied to score (capped at 1.5x)
  → Boost info added to match reasons
  ↓
Boosted cleaner ranks higher
  ↓
Worker (expireBoosts) runs daily:
  → Finds expired boosts
  → Sets status to 'expired'
  → Multiplier no longer applies
```

---

### Subscription Integration (V3)

```
Client Creates Subscription
  ↓
Subscription stored in cleaning_subscriptions
  ↓
Status: 'active'
  ↓
Worker (subscriptionJobs) runs daily:
  ↓
Finds subscriptions due for job generation:
  - Weekly: Check if day matches
  - Biweekly: Check if 2 weeks passed
  - Monthly: Check if month passed
  ↓
Creates job from subscription:
  - Uses subscription address
  - Uses subscription credit_amount
  - Sets scheduled time
  ↓
Job follows normal lifecycle:
  - Matching → Assignment → Execution → Completion
  ↓
Next cycle repeats
```

---

## Usage Examples

### Example 1: Complete Job Flow (V3)

```typescript
// 1. Client creates job
const jobRes = await fetch('/jobs', {
  method: 'POST',
  headers: { 'x-user-id': clientId, 'x-user-role': 'client' },
  body: JSON.stringify({
    address: '123 Main St',
    scheduled_start_at: '2025-01-20T10:00:00Z',
    scheduled_end_at: '2025-01-20T12:00:00Z',
    credit_amount: 200,
    cleaning_type: 'basic',
    duration_hours: 2
  })
});
const job = jobRes.json().job;

// 2. Get pricing estimate (optional)
const estimateRes = await fetch('/pricing/estimate?hours=2');
const estimate = estimateRes.json().estimate;
// Shows: minPrice: $20, maxPrice: $30 (varies by tier)

// 3. Get matching candidates
const candidatesRes = await fetch(`/jobs/${job.id}/candidates`);
const { candidates } = candidatesRes.json();
// Returns top 5-10 cleaners with scores

// 4. Send offers to top 3
await fetch(`/jobs/${job.id}/offer`, {
  method: 'POST',
  body: JSON.stringify({
    cleanerIds: [candidates[0].cleanerId, candidates[1].cleanerId, candidates[2].cleanerId]
  })
});

// 5. Cleaner accepts (handled by cleaner app)
// Job automatically assigned, other offers expire

// 6. Job lifecycle continues...
// in_progress → awaiting_approval → completed
```

### Example 2: Cleaner Purchases Boost (V4)

```typescript
// 1. Cleaner checks boost options
const optionsRes = await fetch('/premium/boosts/options', {
  headers: { 'x-user-id': cleanerId, 'x-user-role': 'cleaner' }
});
const { options } = optionsRes.json();
// Returns: STANDARD (30 credits, 1.2x), PREMIUM (60 credits, 1.35x), MEGA (100 credits, 1.5x)

// 2. Cleaner purchases boost
const purchaseRes = await fetch('/premium/boosts/purchase', {
  method: 'POST',
  headers: { 'x-user-id': cleanerId, 'x-user-role': 'cleaner' },
  body: JSON.stringify({ boostType: 'STANDARD' })
});
const { boost } = purchaseRes.json();
// Boost active for 7 days, multiplier 1.2x

// 3. Boost applies to next matching cycles
// When cleaner appears in candidate list, score multiplied by 1.2x
// Boost info shown in match reasons: "Boost: 20% multiplier"

// 4. Boost expires after 7 days (handled by worker)
```

### Example 3: Create Subscription (V3)

```typescript
// Client creates weekly cleaning subscription
const subRes = await fetch('/premium/subscriptions', {
  method: 'POST',
  headers: { 'x-user-id': clientId, 'x-user-role': 'client' },
  body: JSON.stringify({
    frequency: 'weekly',
    dayOfWeek: 1, // Monday
    preferredTime: '10:00',
    address: '123 Main St',
    creditAmount: 200
  })
});
const { subscription } = subRes.json();

// Worker runs daily at 2 AM:
// - Monday: Creates job for Monday 10 AM
// - Next Monday: Creates next job
// - Continues weekly

// Client can pause/resume/cancel anytime
```

### Example 4: Admin Reviews Risk (V4)

```typescript
// 1. Admin checks risk review queue
const queueRes = await fetch('/admin/risk/review', {
  headers: { 'x-user-id': adminId, 'x-user-role': 'admin' }
});
const { queue } = queueRes.json();
// Returns users with active risk flags

// 2. Admin reviews specific user
const profileRes = await fetch(`/admin/risk/${userId}?role=client`, {
  headers: { 'x-user-id': adminId, 'x-user-role': 'admin' }
});
const { profile } = profileRes.json();
// Returns: {
//   riskScore: 75,
//   flags: [{ type: 'high_cancellation_rate', severity: 'medium' }],
//   factors: [{ type: 'cancellation_rate', value: 0.3, description: '30% cancellation rate' }]
// }

// 3. Admin takes action (via admin routes)
// - Issue strike
// - Suspend account
// - Flag for monitoring
```

---

## Configuration & Environment

### Required Environment Variables

#### Core (V1)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

#### Payment Configuration
- `CENTS_PER_CREDIT` - Credit value in cents (default: 10 = $0.10)
- `PLATFORM_FEE_PERCENT` - Platform fee percentage (default: 20)

#### V2 Optional
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (for Calendar)
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI
- `OPENAI_API_KEY` - OpenAI API key (for AI features)
- `OPENAI_MODEL` - OpenAI model (default: "gpt-4o-mini")

#### V3/V4
- `CLEANER_PAYOUT_SCHEDULE` - Payout schedule (weekly/biweekly/monthly)

#### Dispute Window
- `DISPUTE_WINDOW_HOURS` - Dispute filing window (default: 48)

---

### Feature Flags

All features are code-enabled (no feature flags). To disable features:
- Comment out routes in `src/index.ts`
- Move workers to `disabled/` directory

---

## Monitoring & Observability

### Logging

**Logger**: `src/lib/logger.ts`  
**Format**: Structured JSON logs

**Key Log Events**:
- `job_created` - Job created
- `job_accepted` - Cleaner accepted
- `job_completed` - Job completed
- `credits_escrowed` - Credits escrowed
- `credits_released_to_cleaner` - Credits released
- `payout_recorded` - Payout created
- `reliability_updated` - Reliability score updated
- `boost_purchased` - Boost purchased
- `risk_score_calculated` - Risk score calculated

### Health Checks

**Endpoint**: `GET /health`  
**Response**: `{ ok: true, status: "ok" }`

Used by Railway/deployment platforms for health monitoring.

### Event System

**Location**: `src/lib/events.ts`  
**Purpose**: Publish events for external systems (n8n, webhooks)

**Events Published**:
- Job lifecycle events
- Payment events
- User events
- System events

**Webhook Endpoints**:
- `POST /events` - General events
- `POST /n8n/events` - n8n-specific

### Metrics & Analytics

**V4 Analytics Endpoints**: Provide real-time metrics  
**KPI Snapshots**: Daily snapshots stored in database  
**Weekly Summaries**: Aggregated weekly reports

---

## Key Concepts & Terminology

### Credits
- Internal currency: 1 credit = $0.10 (configurable)
- Used for all job payments
- Clients purchase credits via Stripe
- Cleaners receive credits, converted to USD payouts

### Reliability Score
- 0-100 score measuring cleaner performance
- Based on: ratings, on-time performance, cancellations, completion rate
- Updated after each job
- Decays if cleaner inactive

### Tier System
- Four tiers: Bronze, Silver, Gold, Platinum
- Determined by reliability score
- Affects payout percentage and pricing

### Escrow
- Credits held in escrow when job created
- Released to cleaner on completion
- Refunded to client if job cancelled

### Boost
- Cleaner-paid visibility boost
- Applies multiplier to match score
- Capped at 1.5x to prevent unfairness
- Temporary (7-30 days)

### Pricing Snapshot
- Stored at job assignment time
- Captures pricing breakdown (tier, base, fees)
- Used for disputes and analytics
- Prevents pricing disputes

### Risk Score
- 0-100 score (higher = more risk)
- Calculated on-demand
- Used for admin review queue
- No automatic actions (manual review required)

---

## Best Practices

### For Clients
1. Create jobs with accurate address and time
2. Review cleaner candidates before sending offers
3. Approve jobs promptly (auto-approves after 48h)
4. File disputes within 48 hours if needed
5. Use subscriptions for recurring cleaning

### For Cleaners
1. Maintain high reliability score (complete jobs on time)
2. Respond to offers quickly
3. Check in on time
4. Complete jobs thoroughly
5. Consider boosts for visibility (if needed)

### For Admins
1. Monitor risk review queue regularly
2. Review analytics dashboards weekly
3. Check worker execution logs
4. Monitor stuck jobs and payouts
5. Review disputes promptly

### For Developers
1. Always use event system for state changes
2. Log important operations
3. Use transactions for financial operations
4. Test workers in dry-run mode first
5. Monitor database connection pool

---

## Troubleshooting

### Common Issues

#### Jobs Not Matching Cleaners
- Check cleaner availability
- Verify reliability scores
- Check distance radius
- Review matching weights

#### Credits Not Releasing
- Check job status (must be 'completed')
- Verify payout records
- Check credit_ledger entries
- Review worker logs

#### Reliability Scores Not Updating
- Check reliabilityRecalc worker execution
- Verify job completion events
- Review reliabilityService logs
- Check for errors in score calculation

#### Workers Not Running
- Verify cron schedule
- Check worker logs
- Verify database connectivity
- Check for errors in worker code

---

## Additional Resources

### Documentation Files
- `docs/ALL_VERSIONS_STATUS.md` - Version status overview
- `docs/VERSION_FEATURE_BREAKDOWN.md` - Feature breakdown by version
- `docs/WORKER_SCHEDULE.md` - Worker scheduling guide
- `docs/RAILWAY_SETUP.md` - Deployment guide

### Code References
- `src/index.ts` - Main application entry point
- `src/routes/*` - All API routes
- `src/services/*` - Business logic services
- `src/workers/*` - Background workers
- `DB/migrations/*` - Database migrations

---

**Last Updated**: 2025-01-15  
**Coverage**: V1, V2, V3, V4 (All Complete)  
**Status**: Production-Ready

