# V2 Features - Complete Execution Plan

**Goal**: Enable all V2 features that are currently implemented but disabled.

**Status**: All V2 features are fully implemented but disabled - routes commented out, workers in `disabled/` folder.

**Prerequisite**: V1 is stable and working (✅ confirmed)

---

## 📋 Execution Checklist

### Phase 1: Enable V2 Routes ✅
- [ ] Uncomment `v2Router` import and mount in `src/index.ts`
- [ ] Verify all 24 V2 endpoints are accessible

### Phase 2: Enable V2 Workers ✅
- [ ] Move `cleaningScores.ts` from `disabled/` to active workers
- [ ] Move `goalChecker.ts` from `disabled/` to active workers
- [ ] Move `stuckJobDetection.ts` from `disabled/` to active workers
- [ ] Update `src/workers/index.ts` imports to reflect new locations
- [ ] Update worker type definitions if needed

### Phase 3: Environment Variables ✅
- [ ] Document required V2 environment variables:
  - `GOOGLE_CLIENT_ID` (for Calendar integration)
  - `GOOGLE_CLIENT_SECRET` (for Calendar integration)
  - `GOOGLE_REDIRECT_URI` (for Calendar OAuth callback)
  - `OPENAI_API_KEY` (for AI features)
- [ ] Add validation in `src/config/env.ts` (optional)
- [ ] Update `.env.example` with V2 variables (optional)

### Phase 4: Database Verification ✅
- [ ] Verify migration `016_v2_core.sql` has been run
- [ ] Verify all V2 tables exist:
  - ✅ `properties`
  - ✅ `cleaner_teams`
  - ✅ `team_members`
  - ✅ `calendar_connections`
  - ✅ `calendar_events`
  - ✅ `cleaner_goals`
  - ✅ `cancellations` (check in migrations)
  - ✅ `reschedules` (check in migrations)
- [ ] Check for any missing indexes or constraints

### Phase 5: Testing ✅
- [ ] Test Properties endpoints (`/v2/properties/*`)
- [ ] Test Teams endpoints (`/v2/teams/*`)
- [ ] Test Calendar endpoints (`/v2/calendar/*`)
- [ ] Test AI endpoints (`/v2/ai/*`)
- [ ] Test Goals endpoints (`/v2/cleaner/goals`, etc.)
- [ ] Test workers manually (if needed)
- [ ] Verify no breaking changes to V1 functionality

---

## 🔧 Detailed Implementation Steps

### Step 1: Enable V2 Routes

**File**: `src/index.ts` (lines 36-37, 165)

**Current State**:
```typescript
// V2 FEATURE — DISABLED FOR NOW (next-gen APIs)
// import v2Router from "./routes/v2";
// app.use("/v2", v2Router);
```

**Action**: Uncomment these lines.

**Result**: 24 V2 API endpoints will become accessible:
- 6 Properties endpoints
- 8 Teams endpoints
- 5 Calendar endpoints
- 2 AI endpoints
- 3 Goals/Route endpoints

---

### Step 2: Enable V2 Workers

**Files to move**:
1. `src/workers/disabled/cleaningScores.ts` → `src/workers/cleaningScores.ts`
2. `src/workers/disabled/goalChecker.ts` → `src/workers/goalChecker.ts`
3. `src/workers/disabled/stuckJobDetection.ts` → `src/workers/stuckJobDetection.ts`

**File to update**: `src/workers/index.ts`

**Current State** (lines 10-16):
```typescript
import { runCleaningScores } from "./disabled/cleaningScores";
import { runExpireBoosts } from "./disabled/expireBoosts";
import { runGoalChecker } from "./disabled/goalChecker";
import { runKpiDailySnapshot } from "./disabled/kpiDailySnapshot";
import { runStuckJobDetection } from "./disabled/stuckJobDetection";
```

**Action**: Update imports after moving files:
```typescript
import { runCleaningScores } from "./cleaningScores";
import { runGoalChecker } from "./goalChecker";
import { runStuckJobDetection } from "./stuckJobDetection";
```

**Workers to enable**:
- `cleaningScores` - Recalculates cleaning scores for properties (daily)
- `goalChecker` - Checks and awards cleaner goals (daily)
- `stuckJobDetection` - Detects jobs stuck in intermediate states (hourly)

**Workers to keep disabled** (V3/V4 features):
- `expireBoosts` - For V4 Boosts feature
- `kpiDailySnapshot` - Enhanced analytics (V4)
- `subscriptionJobs` - For V3 Subscriptions (enable separately)
- `weeklySummary` - For V4 Analytics

---

### Step 3: Environment Variables

**Required for Calendar** (Google OAuth2):
- `GOOGLE_CLIENT_ID` - Google OAuth2 client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth2 client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL (e.g., `https://app.puretask.com/auth/google/callback`)

**Required for AI Features**:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4

**Note**: These are optional - Calendar and AI features will gracefully degrade if not set (fallback logic exists).

---

### Step 4: Database Verification

**Migration File**: `DB/migrations/016_v2_core.sql`

**Tables Created**:
- ✅ `properties` - Multi-property support
- ✅ `cleaner_teams` - Team management
- ✅ `team_members` - Team membership
- ✅ `calendar_connections` - Calendar OAuth
- ✅ `calendar_events` - Calendar sync events
- ✅ `cleaner_goals` - Monthly goals
- ✅ `favorite_cleaners` - Saved favorites
- ✅ `cancellations` - Enhanced cancellation tracking
- ✅ `reschedules` - Reschedule requests

**Verification**: Check if migration has been run in your database.

---

### Step 5: Testing Strategy

**Manual Testing**:
1. Test Properties CRUD operations
2. Test Teams creation and member management
3. Test Calendar OAuth flow (requires Google credentials)
4. Test AI checklist generation (requires OpenAI key)
5. Test Goals endpoints
6. Verify workers run without errors

**Integration Testing**:
- Ensure V1 endpoints still work
- Verify no conflicts between V1 and V2
- Check database constraints

---

## 🚨 Risks & Considerations

### Feature Dependencies
- **Calendar**: Requires Google OAuth setup (can be done later)
- **AI Features**: Requires OpenAI API key (can be done later)
- **Properties**: No external dependencies
- **Teams**: No external dependencies
- **Goals**: Requires `goalChecker` worker enabled

### Backward Compatibility
- ✅ V2 routes use `/v2/*` prefix - no conflicts with V1
- ✅ Services are independent - V1 services still work
- ✅ Database tables are additive - existing tables unchanged

### Performance
- Workers add scheduled tasks (ensure Railway/scheduler configured)
- Calendar sync adds OAuth API calls
- AI features add OpenAI API calls (costs money)

---

## 📊 Success Criteria

✅ All V2 routes accessible at `/v2/*`  
✅ Workers scheduled and running  
✅ Database tables exist and accessible  
✅ No breaking changes to V1  
✅ Documentation updated  

---

## 🎯 Next Steps After Enablement

1. **Monitor**: Watch for errors in logs
2. **Test**: Manual testing of each feature
3. **Gradual Rollout**: Consider feature flags for gradual enablement
4. **User Communication**: Notify users when features are available

---

**Created**: 2025-01-15  
**Status**: Ready for execution

