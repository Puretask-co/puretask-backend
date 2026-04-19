# V2 Features - Complete Detailed Breakdown

**Status**: ⬜ All V2 features are **DISABLED** - Routes exist but not mounted, services implemented but not used

**Location**: All V2 routes are in `src/routes/v2.ts` but commented out in `src/index.ts`

---

## 📋 Table of Contents

1. [Routes Not Mounted (`/v2/*`)](#routes-not-mounted-v2)
2. [Services Implemented But Not Used](#services-implemented-but-not-used)
3. [7 Disabled Workers](#7-disabled-workers)
4. [Feature Categories](#feature-categories)
   - [1. Properties Management](#1-properties-management)
   - [2. Teams Management](#2-teams-management)
   - [3. Calendar Integration](#3-calendar-integration)
   - [4. AI Features](#4-ai-features)
   - [5. Cleaner Goals & Route Optimization](#5-cleaner-goals--route-optimization)
   - [6. Enhanced Reliability V2](#6-enhanced-reliability-v2)
   - [7. Enhanced Dispute Engine](#7-enhanced-dispute-engine)

---

## Routes Not Mounted (`/v2/*`)

### Current Status

**File**: `src/index.ts` (lines 36-37)

```typescript
// V2 FEATURE — DISABLED FOR NOW (next-gen APIs)
// import v2Router from "./routes/v2";
// app.use("/v2", v2Router);
```

**What this means**: The entire `/v2/*` router exists and is fully implemented, but it's commented out, so **none of these endpoints are accessible**.

### All V2 Routes (Not Accessible)

**File**: `src/routes/v2.ts` (540 lines, fully implemented)

#### Properties Routes (6 endpoints)
- `POST /v2/properties` - Create property
- `GET /v2/properties` - List client properties
- `GET /v2/properties/:id` - Get property details
- `GET /v2/properties/:id/suggestions` - Get cleaning suggestions
- `PATCH /v2/properties/:id` - Update property
- `DELETE /v2/properties/:id` - Delete property
- `GET /v2/jobs/:id/rebook-data` - One-tap rebook data

#### Teams Routes (8 endpoints)
- `POST /v2/teams` - Create team
- `GET /v2/teams/my` - Get my team (as owner)
- `GET /v2/teams/memberships` - Get teams I belong to
- `POST /v2/teams/:id/members` - Invite member
- `POST /v2/teams/:id/accept` - Accept invitation
- `POST /v2/teams/:id/decline` - Decline invitation
- `DELETE /v2/teams/:id/members/:memberId` - Remove member
- `POST /v2/teams/:id/leave` - Leave team
- `GET /v2/teams/:id/stats` - Get team statistics

#### Calendar Routes (5 endpoints)
- `GET /v2/calendar/google/connect` - Get Google OAuth URL
- `GET /v2/calendar/google/callback` - Handle OAuth callback
- `GET /v2/calendar/connection` - Get connection status
- `DELETE /v2/calendar/connection` - Disconnect calendar
- `GET /v2/calendar/ics-url` - Get ICS feed URL (Apple Calendar)

#### AI Routes (2 endpoints)
- `POST /v2/ai/checklist` - Generate AI cleaning checklist
- `POST /v2/ai/dispute-suggestion` - Generate AI dispute resolution suggestion (admin only)

#### Goals & Route Optimization Routes (3 endpoints)
- `GET /v2/cleaner/goals` - Get cleaner's goals
- `GET /v2/cleaner/route-suggestions` - Get route optimization suggestions
- `GET /v2/cleaner/reliability-breakdown` - Get detailed reliability breakdown

**Total**: 24 API endpoints fully implemented but disabled

---

## Services Implemented But Not Used

All these services are fully implemented with complete business logic, but they're **not being called** because the routes are disabled.

### 1. Properties Service
**File**: `src/services/propertiesService.ts` (534 lines)

**What it does**:
- Property CRUD operations
- Cleaning score calculation (0-100 based on last cleaning dates)
- Cleaning suggestions (when to schedule next cleaning)
- One-tap rebook functionality
- Property metadata (bedrooms, bathrooms, pets, kids, square feet)

**Key Functions**:
- `createProperty()` - Create new property
- `getPropertyById()` - Get property details
- `getClientProperties()` - List all client properties
- `updateProperty()` - Update property details
- `deleteProperty()` - Delete property (checks for active subscriptions)
- `calculateCleaningScore()` - Calculate 0-100 score based on cleaning history
- `updateCleaningScore()` - Update score after job completion
- `getPropertySuggestions()` - Get cleaning suggestions (basic/deep/moveout)
- `getRebookData()` - Get data for one-tap rebooking

**Database Tables Used**:
- `properties` (exists in `016_v2_core.sql`)
- Links to `jobs` via `property_id`

---

### 2. Teams Service
**File**: `src/services/teamsService.ts` (529 lines)

**What it does**:
- Cleaner team creation and management
- Team member invitations and management
- Team roles (owner, lead, member)
- Team statistics and job assignment
- Team job assignment (assign jobs to teams)

**Key Functions**:
- `createTeam()` - Create new team (owner is creator)
- `getTeamById()` - Get team details
- `getTeamWithMembers()` - Get team with member list
- `getCleanerTeam()` - Get team owned by cleaner
- `getCleanerMemberships()` - Get teams cleaner belongs to
- `updateTeam()` - Update team name/description
- `inviteTeamMember()` - Invite cleaner to team
- `acceptTeamInvitation()` - Accept team invitation
- `declineTeamInvitation()` - Decline invitation
- `removeTeamMember()` - Remove member (owner only)
- `leaveTeam()` - Leave team (owner can't leave)
- `assignJobToTeam()` - Assign job to team
- `getTeamStats()` - Get team statistics (jobs, earnings, ratings)

**Database Tables Used**:
- `cleaner_teams` (exists in `016_v2_core.sql`)
- `team_members` (exists in `016_v2_core.sql`)
- Links to `jobs` via `team_id`

**Team Features**:
- Max members per team (configurable)
- Role-based permissions (owner can assign jobs, leads can manage members)
- Team statistics (total jobs, completed jobs, avg rating, total earnings)
- Per-member statistics

---

### 3. Calendar Service
**File**: `src/services/calendarService.ts` (527 lines)

**What it does**:
- Google Calendar OAuth2 integration
- Two-way calendar sync (jobs → calendar, calendar → job blocks)
- ICS feed generation (Apple Calendar support)
- Token refresh management
- Calendar event creation/update/deletion

**Key Functions**:
- `getGoogleConnectUrl()` - Generate OAuth URL
- `handleGoogleCallback()` - Exchange code for tokens, save connection
- `getUserCalendarConnection()` - Get user's calendar connection
- `disconnectCalendar()` - Disconnect calendar
- `toggleCalendarSync()` - Enable/disable sync
- `syncJobToCalendar()` - Create/update calendar event for job
- `deleteJobFromCalendar()` - Delete calendar event
- `refreshAccessToken()` - Refresh expired tokens
- `generateICSFeedUrl()` - Generate ICS feed URL
- `generateICSContent()` - Generate ICS content for user's jobs

**Database Tables Used**:
- `calendar_connections` (exists in `016_v2_core.sql`)
- `calendar_events` (exists in `016_v2_core.sql`)

**Calendar Features**:
- Google OAuth2 flow
- Automatic token refresh
- Two-way sync (jobs appear in calendar, calendar blocks prevent job assignment)
- ICS export for Apple Calendar
- Sync enabled/disabled toggle

**Environment Variables Required**:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

---

### 4. AI Service
**File**: `src/services/aiService.ts` (439 lines)

**What it does**:
- AI-powered cleaning checklist generation
- AI-powered dispute resolution suggestions
- OpenAI GPT-4 integration
- Fallback logic when AI unavailable

**Key Functions**:
- `generateChecklist()` - Generate cleaning checklist using AI
- `generateDisputeSuggestion()` - Generate dispute resolution suggestion
- `invokeModel()` - Base OpenAI API call
- `generateFallbackChecklist()` - Fallback when AI unavailable
- `generateFallbackDisputeSuggestion()` - Fallback dispute suggestion

**AI Checklist Features**:
- Input: bedrooms, bathrooms, square feet, pets, kids, cleaning type, special notes
- Output: estimated hours, step-by-step checklist, pro tips, supplies needed
- Considers property details for personalized checklist
- Fallback to deterministic checklist if AI unavailable

**AI Dispute Suggestion Features**:
- Input: job details, client complaint, cleaner response, photos, history
- Output: recommended action (full_refund/partial_refund/no_refund/reclean), confidence, summary, notes
- Considers: client dispute history, cleaner reliability, photo evidence, time spent
- Fallback to rule-based suggestion if AI unavailable

**Environment Variables Required**:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: "gpt-4o-mini")

---

### 5. Cleaner Goals Service
**File**: `src/services/cleanerGoalsService.ts` (534 lines)

**What it does**:
- Monthly goal creation and tracking
- Goal progress updates
- Goal achievement rewards (bonus credits)
- Route optimization suggestions
- Detailed reliability breakdown

**Key Functions**:
- `createGoal()` - Create monthly goal
- `createDefaultMonthlyGoals()` - Auto-create goals based on cleaner history
- `getCleanerGoals()` - Get cleaner's goals for month
- `updateGoalProgress()` - Update goal progress when job completes
- `checkAndAwardGoals()` - Award credits when goals achieved
- `getRouteSuggestions()` - Get route optimization suggestions
- `getReliabilityBreakdown()` - Get detailed reliability analysis

**Goal Types**:
- `jobs` - Number of jobs completed
- `earnings` - Earnings target
- `rating` - Average rating target

**Goal Templates**:
- STARTER: 10 jobs → 50 credits
- REGULAR: 20 jobs → 150 credits
- PRO: 35 jobs → 300 credits
- ELITE: 50 jobs → 500 credits

**Route Suggestions**:
- Gap warnings (too little time between jobs)
- Open slot suggestions (large gaps between jobs)
- Clustering opportunities (jobs in same ZIP code)

**Reliability Breakdown**:
- Current score and tier
- Last 30 days stats (on-time checkins, late, no-shows, cancellations, etc.)
- Score components (checkin score, completion score, rating score, penalties)
- Next tier information (name, points needed)

**Database Tables Used**:
- `cleaner_goals` (exists in `016_v2_core.sql`)

---

### 6. Enhanced Reliability V2 Service
**File**: `src/core/reliabilityScoreV2Service.ts` (631 lines)

**What it does**:
- Advanced reliability scoring (more granular than V1)
- Base Behavior Score (0-90 points)
- Streak/Consistency Bonus (0-10 points)
- Event Penalties (late reschedules, cancellations, no-shows, disputes)
- New cleaner ramp-up blending
- Tier calculation

**Key Differences from V1**:
- **V1** (`src/services/reliabilityService.ts`): Simple scoring (cancellations, disputes, ratings, completion, photos)
- **V2** (`src/core/reliabilityScoreV2Service.ts`): Advanced scoring with:
  - Base Behavior Score breakdown:
    - Attendance (did cleaner show up?)
    - Punctuality (on-time check-ins)
    - Photos (photo compliance)
    - Communication (proactive messages, response time)
    - Completion (job completion rate)
    - Ratings (average rating)
  - Streak Bonus (consistency over time)
  - Event Penalties (more granular):
    - Late reschedules (<24h)
    - Cancellations (24-48h, <24h buckets)
    - No-shows
    - Disputes (cleaner at fault)
    - High inconvenience jobs
  - New cleaner ramp-up (blends score for first 10 jobs)

**Key Functions**:
- `recomputeForCleaner()` - Recompute score for single cleaner
- `recomputeAllCleaners()` - Recompute all cleaner scores
- `calculateBaseBehaviorScore()` - Calculate 0-90 base score
- `calculateStreakBonus()` - Calculate 0-10 streak bonus
- `calculateEventPenalties()` - Calculate total penalties
- `blendNewCleanerScore()` - Blend score for new cleaners

**Database Tables Used**:
- `cleaner_profiles` (reliability_score, tier)
- `jobs` (for job history)
- `job_events` (for check-in times, etc.)

**Note**: V1 uses simpler `reliabilityService.ts`. V2 uses this more advanced service but it's not currently active.

---

### 7. Enhanced Dispute Engine (Cancellation & Reschedule Services)
**Files**: 
- `src/core/cancellationService.ts` (700 lines)
- `src/core/rescheduleService.ts` (574 lines)

**What it does**:
- Advanced cancellation processing with time windows
- Reschedule request/response workflow
- Reason code system
- Rolling window calculations
- Inconvenience scoring
- Integration with risk and reliability systems

#### Cancellation Service V2
**File**: `src/core/cancellationService.ts`

**Key Functions**:
- `processCancellation()` - Main cancellation entrypoint
- `calculateFeeBreakdown()` - Calculate cancellation fees
- `applyGraceCancellation()` - Apply grace cancellation if available
- `routeCredits()` - Route credits (refund, fee, cleaner comp, platform comp)

**Cancellation Windows**:
- `>48h`: 0% fee (free)
- `24-48h`: 50% fee
- `<24h`: 100% fee
- Grace cancellations: 2 per client lifetime

**Credit Routing**:
- Client refund (based on fee percentage)
- Cancellation fee (platform keeps)
- Cleaner compensation (if cleaner cancelled, they get comp)
- Platform compensation
- Bonus credits (for no-shows)

**Database Tables Used**:
- `cancellations` (exists in `016_v2_core.sql`)
- `client_profiles` (grace cancellations)

#### Reschedule Service V2
**File**: `src/core/rescheduleService.ts`

**Key Functions**:
- `createRequest()` - Create reschedule request
- `respond()` - Accept or decline reschedule
- `checkCleanerAvailability()` - Check if cleaner available for new time
- `evaluateReasonableness()` - Determine if reschedule is reasonable
- `countReschedulesForJob()` - Count previous reschedules

**Reschedule Workflow**:
1. Client or cleaner requests reschedule
2. Request sent to other party
3. Other party accepts or declines
4. If accepted: job time updated
5. If declined: can cancel or keep original time

**Reasonableness Factors**:
- Cleaner availability for new time
- Time until original start
- Previous reschedule count
- New time vs original time

**Database Tables Used**:
- `reschedules` (exists in `016_v2_core.sql`)

---

## 7 Disabled Workers

All these workers are in `src/workers/disabled/` and are **imported but not actively scheduled**.

**File**: `src/workers/index.ts` (lines 10-18)

```typescript
import { runCleaningScores } from "./disabled/cleaningScores";
import { runExpireBoosts } from "./disabled/expireBoosts";
import { runGoalChecker } from "./disabled/goalChecker";
import { runKpiDailySnapshot } from "./disabled/kpiDailySnapshot";
import { runStuckJobDetection } from "./disabled/stuckJobDetection";
import { runSubscriptionJobs } from "./disabled/subscriptionJobs";
import { runWeeklySummary } from "./disabled/weeklySummary";
```

### 1. Cleaning Scores Worker
**File**: `src/workers/disabled/cleaningScores.ts`

**What it does**:
- Recalculates cleaning scores for all properties
- Runs periodically (e.g., daily)
- Updates `properties.cleaning_score` based on last cleaning dates

**When to enable**: When Properties feature is enabled (V2)

**Dependencies**: 
- `propertiesService.recalculateAllScores()`

---

### 2. Expire Boosts Worker
**File**: `src/workers/disabled/expireBoosts.ts`

**What it does**:
- Expires boosts that have passed their `expires_at` time
- Marks boosts as `EXPIRED`
- Runs hourly or daily

**When to enable**: When Boosts feature is enabled (V4)

**Dependencies**:
- `boosts` table (exists in schema)
- Boost service

---

### 3. Goal Checker Worker
**File**: `src/workers/disabled/goalChecker.ts`

**What it does**:
- Checks if cleaner goals have been achieved
- Awards bonus credits when goals met
- Updates goal progress
- Runs daily

**When to enable**: When Cleaner Goals feature is enabled (V2)

**Dependencies**:
- `cleanerGoalsService.checkAndAwardGoals()`
- `cleaner_goals` table

---

### 4. KPI Daily Snapshot Worker
**File**: `src/workers/disabled/kpiDailySnapshot.ts`

**What it does**:
- Generates daily KPI snapshots
- Captures: jobs created/completed/cancelled, revenue, active users, etc.
- Stores in `kpi_daily_snapshots` table (immutable)
- Runs daily at midnight

**When to enable**: When Analytics feature is enabled (V4)

**Note**: V1 has a simpler `kpiSnapshot` worker that's active. This is the enhanced version.

**Dependencies**:
- `kpi_daily_snapshots` table
- Analytics service

---

### 5. Stuck Job Detection Worker
**File**: `src/workers/disabled/stuckJobDetection.ts`

**What it does**:
- Detects jobs stuck in intermediate states
- Flags jobs that haven't progressed in expected time
- Alerts admin or auto-escalates
- Runs hourly

**When to enable**: When advanced monitoring is needed (V2+)

**Dependencies**:
- `jobs` table
- Job state machine

---

### 6. Subscription Jobs Worker
**File**: `src/workers/disabled/subscriptionJobs.ts`

**What it does**:
- Generates recurring jobs from active subscriptions
- Checks if job needed for next cycle
- Creates job with subscription pricing
- Reserves credits per job
- Idempotent (prevents duplicates)
- Runs daily

**When to enable**: When Subscriptions feature is enabled (V3)

**Dependencies**:
- `subscriptions` table
- `subscriptionService`
- Job creation service

---

### 7. Weekly Summary Worker
**File**: `src/workers/disabled/weeklySummary.ts`

**What it does**:
- Generates weekly rollup from daily snapshots
- Aggregates metrics for the week
- Emails/notifies ops team (optional)
- Stores in `kpi_weekly_summaries`
- Runs weekly (e.g., Sunday night)

**When to enable**: When Analytics feature is enabled (V4)

**Dependencies**:
- `kpi_daily_snapshots` table
- `kpi_weekly_summaries` table
- Analytics service

---

## Feature Categories

### 1. Properties Management

**Purpose**: Enable multi-property support for clients (B2B, property managers, recurring clients)

**Features**:
- ✅ Create multiple properties per client
- ✅ Property metadata (bedrooms, bathrooms, square feet, pets, kids)
- ✅ Cleaning score tracking (0-100 based on last cleaning dates)
- ✅ Cleaning suggestions (when to schedule next cleaning)
- ✅ One-tap rebook (quickly rebook same property/cleaner)

**Use Cases**:
- Property management companies managing multiple units
- Clients with multiple homes
- Recurring cleaning schedules
- Cleaning score helps prioritize which properties need cleaning

**Database Schema**:
```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  has_pets BOOLEAN,
  has_kids BOOLEAN,
  cleaning_score NUMERIC(5,2) DEFAULT 100,
  last_basic_at TIMESTAMPTZ,
  last_deep_at TIMESTAMPTZ,
  last_moveout_at TIMESTAMPTZ,
  ...
);
```

**How to Enable**:
1. Uncomment `v2Router` in `src/index.ts`
2. Ensure `properties` table exists (from `016_v2_core.sql`)
3. Update job creation to optionally link to `property_id`

---

### 2. Teams Management

**Purpose**: Enable cleaners to form teams and work together

**Features**:
- ✅ Create teams (owner, lead, member roles)
- ✅ Invite team members
- ✅ Team job assignment
- ✅ Team statistics (jobs, earnings, ratings)
- ✅ Per-member statistics

**Use Cases**:
- Cleaner partnerships
- Cleaning companies with multiple cleaners
- Team-based job assignments
- Shared earnings tracking

**Database Schema**:
```sql
CREATE TABLE cleaner_teams (
  id SERIAL PRIMARY KEY,
  owner_cleaner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  max_members INT DEFAULT 10,
  ...
);

CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL,
  cleaner_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'owner', 'lead', 'member'
  status TEXT NOT NULL, -- 'pending', 'active', 'inactive'
  ...
);
```

**How to Enable**:
1. Uncomment `v2Router` in `src/index.ts`
2. Ensure `cleaner_teams` and `team_members` tables exist
3. Update job assignment to support team assignment

---

### 3. Calendar Integration

**Purpose**: Sync jobs with user's calendar (Google, Apple)

**Features**:
- ✅ Google Calendar OAuth2 connection
- ✅ Two-way sync (jobs → calendar, calendar → job blocks)
- ✅ ICS feed generation (Apple Calendar)
- ✅ Automatic token refresh
- ✅ Sync enable/disable toggle

**Use Cases**:
- Cleaners see jobs in their calendar app
- Clients see scheduled cleanings in calendar
- Calendar conflicts prevent double-booking
- Better time management

**Database Schema**:
```sql
CREATE TABLE calendar_connections (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'google', 'apple', 'outlook'
  external_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  ...
);

CREATE TABLE calendar_events (
  id SERIAL PRIMARY KEY,
  connection_id INT NOT NULL,
  job_id UUID,
  external_event_id TEXT NOT NULL,
  ...
);
```

**How to Enable**:
1. Uncomment `v2Router` in `src/index.ts`
2. Set up Google OAuth credentials
3. Set environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
4. Ensure `calendar_connections` and `calendar_events` tables exist

---

### 4. AI Features

**Purpose**: AI-powered assistance for checklists and dispute resolution

**Features**:
- ✅ AI-generated cleaning checklists (personalized by property)
- ✅ AI dispute resolution suggestions (admin tool)
- ✅ Fallback logic when AI unavailable
- ✅ OpenAI GPT-4 integration

**Use Cases**:
- Generate detailed cleaning checklists based on property details
- Help admins make fair dispute decisions
- Reduce manual work for ops team

**How to Enable**:
1. Uncomment `v2Router` in `src/index.ts`
2. Set `OPENAI_API_KEY` environment variable
3. Optionally set `OPENAI_MODEL` (default: "gpt-4o-mini")

**Cost Considerations**:
- OpenAI API calls cost money per request
- Fallback logic ensures system works without AI
- Can be disabled per feature if needed

---

### 5. Cleaner Goals & Route Optimization

**Purpose**: Motivate cleaners and optimize their routes

**Features**:
- ✅ Monthly goals (jobs, earnings, ratings)
- ✅ Goal progress tracking
- ✅ Goal achievement rewards (bonus credits)
- ✅ Route optimization suggestions
- ✅ Detailed reliability breakdown

**Use Cases**:
- Motivate cleaners with achievable goals
- Reward high performers
- Help cleaners optimize their daily routes
- Show cleaners how to improve their reliability score

**Database Schema**:
```sql
CREATE TABLE cleaner_goals (
  id SERIAL PRIMARY KEY,
  cleaner_id TEXT NOT NULL,
  goal_type TEXT NOT NULL, -- 'jobs', 'earnings', 'rating'
  month DATE NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  reward_credits INT NOT NULL,
  is_awarded BOOLEAN DEFAULT FALSE,
  ...
);
```

**How to Enable**:
1. Uncomment `v2Router` in `src/index.ts`
2. Enable `goalChecker` worker (move from `disabled/`)
3. Ensure `cleaner_goals` table exists

---

### 6. Enhanced Reliability V2

**Purpose**: More granular and accurate reliability scoring

**Key Differences from V1**:

| Feature | V1 (Current) | V2 (Disabled) |
|---------|-------------|---------------|
| **Scoring Method** | Simple additive | Base score + streak + penalties |
| **Base Score** | Direct calculation | 0-90 base behavior score |
| **Streak Bonus** | ❌ None | ✅ 0-10 points for consistency |
| **Penalties** | Simple | Granular (late reschedules, inconvenience) |
| **New Cleaner** | Same scoring | Ramp-up blending (first 10 jobs) |
| **Components** | 5 factors | 6 base components + events |

**V2 Base Behavior Score (0-90)**:
- Attendance: Did cleaner show up?
- Punctuality: On-time check-ins
- Photos: Photo compliance rate
- Communication: Proactive messages, response time
- Completion: Job completion rate
- Ratings: Average rating

**V2 Streak Bonus (0-10)**:
- Consistency over time
- Rewards reliable behavior patterns

**V2 Event Penalties**:
- Late reschedules (<24h): -5 points each
- Cancellations (24-48h): -10 points each
- Cancellations (<24h): -15 points each
- No-shows: -25 points each
- Disputes (cleaner fault): -20 points each
- High inconvenience: -10 points each

**How to Enable**:
1. Replace V1 `reliabilityService.ts` calls with `reliabilityScoreV2Service.ts`
2. Update `reliabilityRecalc` worker to use V2 service
3. Ensure all required data is available (inconvenience scores, reschedule data)

**Note**: V2 is more accurate but more complex. V1 is simpler and works well for launch.

---

### 7. Enhanced Dispute Engine

**Purpose**: Advanced cancellation and reschedule handling

**Features**:
- ✅ Time-window based cancellation fees
- ✅ Grace cancellations (2 per client lifetime)
- ✅ Reschedule request/response workflow
- ✅ Reason code system
- ✅ Inconvenience scoring
- ✅ Integration with risk and reliability systems

**Cancellation Service V2**:
- Time windows: >48h (0%), 24-48h (50%), <24h (100%)
- Grace cancellations: 2 per client lifetime
- Credit routing: refund, fee, cleaner comp, platform comp
- No-show handling: full refund + bonus credits to client

**Reschedule Service V2**:
- Request → pending → accept/decline workflow
- Reasonableness evaluation
- Availability checking
- Integration with cancellation (if declined)

**How to Enable**:
1. Replace V1 cancellation logic with `CancellationServiceV2`
2. Add reschedule endpoints (not in V1)
3. Ensure `cancellations` and `reschedules` tables exist
4. Update job cancellation/reschedule flows

**Note**: V1 has basic cancellation. V2 adds reschedules and more sophisticated fee calculation.

---

## How to Enable All V2 Features

### Step 1: Uncomment Routes
**File**: `src/index.ts`

```typescript
// Change from:
// import v2Router from "./routes/v2";
// app.use("/v2", v2Router);

// To:
import v2Router from "./routes/v2";
app.use("/v2", v2Router);
```

### Step 2: Enable Workers (Optional)
Move workers from `src/workers/disabled/` to `src/workers/`:
- `cleaningScores.ts` (for Properties)
- `goalChecker.ts` (for Goals)
- `stuckJobDetection.ts` (for monitoring)

### Step 3: Set Environment Variables
- `GOOGLE_CLIENT_ID` (for Calendar)
- `GOOGLE_CLIENT_SECRET` (for Calendar)
- `GOOGLE_REDIRECT_URI` (for Calendar)
- `OPENAI_API_KEY` (for AI features)

### Step 4: Run Database Migrations
Ensure all V2 tables exist:
- `properties`
- `cleaner_teams`, `team_members`
- `calendar_connections`, `calendar_events`
- `cleaner_goals`
- `cancellations`, `reschedules`

### Step 5: Test
- Test each endpoint
- Verify database operations
- Check worker functionality

---

## Summary

**V2 Features Status**:
- ✅ **24 API endpoints** fully implemented but disabled
- ✅ **7 services** fully implemented but not used
- ✅ **7 workers** implemented but disabled
- ✅ **10 major feature categories** ready to enable

**To Enable**: Simply uncomment 2 lines in `src/index.ts` and set environment variables.

**Recommendation**: Enable V2 features incrementally:
1. Start with Properties (most requested)
2. Add Calendar (high value, low risk)
3. Add Teams (if needed)
4. Add AI features (requires OpenAI API key)
5. Add Goals (requires worker)
6. Upgrade to V2 Reliability (more complex, test thoroughly)
7. Add Enhanced Dispute Engine (requires careful testing)

---

**Last Updated**: 2025-01-15  
**Status**: All V2 features implemented but disabled, ready to enable when V1 is stable

