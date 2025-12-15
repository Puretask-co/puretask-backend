# V1 Review: Critical Questions Analysis

**Date:** 2025-01-12  
**Status:** Pre-production review

---

## 1. Are the guard flag defaults appropriate for V1 launch?

### Current Defaults
```typescript
BOOKINGS_ENABLED: process.env.BOOKINGS_ENABLED !== "false", // Default: enabled
PAYOUTS_ENABLED: process.env.PAYOUTS_ENABLED === "true",     // Default: disabled
CREDITS_ENABLED: process.env.CREDITS_ENABLED !== "false",    // Default: enabled
REFUNDS_ENABLED: process.env.REFUNDS_ENABLED !== "false",    // Default: enabled
WORKERS_ENABLED: process.env.WORKERS_ENABLED !== "false",    // Default: enabled
```

### ✅ **RECOMMENDATION: Keep current defaults with one change**

**Current state is appropriate because:**
- `BOOKINGS_ENABLED=true` ✅ - V1 launch needs bookings enabled
- `CREDITS_ENABLED=true` ✅ - Credits are core to V1 functionality
- `REFUNDS_ENABLED=true` ✅ - Necessary for dispute resolution in V1
- `WORKERS_ENABLED=true` ✅ - Workers are essential for automation
- `PAYOUTS_ENABLED=false` ✅ - **Correct**: Payouts should be opt-in for V1 launch

**⚠️ ONE RECOMMENDATION:** Consider making `PAYOUTS_ENABLED` explicitly required in production:

```typescript
// In production, require explicit opt-in for payouts
if (env.NODE_ENV === "production" && env.PAYOUTS_ENABLED && !process.env.PAYOUTS_ENABLED) {
  throw new Error("PAYOUTS_ENABLED must be explicitly set to 'true' in production");
}
```

**Rationale:** Payouts move real money. Making it opt-in prevents accidental enablement.

---

## 2. Should all workers use runWorkerWithLock, or only critical ones?

### Current State
- ✅ **payouts** worker uses `runWorkerWithLock`
- ❌ **14 other workers** do NOT use locks

### ✅ **RECOMMENDATION: Apply locks to ALL money/state-mutation workers**

**Critical Workers (MUST have locks):**
1. ✅ **payouts** - Already locked (moves real money)
2. ❌ **auto-cancel** - Changes job status, triggers refunds (can affect money)
3. ❌ **retry-events** - Retries webhooks (could duplicate payments if not idempotent)
4. ❌ **credit-economy** - Modifies credit balances (affects money)
5. ❌ **subscription-jobs** - Creates jobs (affects escrow)

**Important Workers (SHOULD have locks):**
6. ❌ **nightly-scores** - Recalculates reliability (affects matching/pricing)
7. ❌ **reliability-recalc** - Recalculates reliability (affects matching/pricing)
8. ❌ **stuck-detection** - May trigger state changes
9. ❌ **goal-checker** - May award credits (affects money)

**Read-Only Workers (OPTIONAL locks, but recommended for consistency):**
10. ❌ **kpi-snapshot** - Read-only, but locks prevent concurrent runs
11. ❌ **kpi-daily** - Read-only, but locks prevent concurrent runs
12. ❌ **photo-cleanup** - Deletes data (should be locked)
13. ❌ **cleaning-scores** - Read-only calculations
14. ❌ **expire-boosts** - Modifies boost status (low risk, but should be locked)
15. ❌ **weekly-summary** - Read-only analytics

### Implementation Strategy

**Phase 1 (Before V1 Launch - Critical):**
Apply `runWorkerWithLock` to:
- `auto-cancel`
- `retry-events`
- `credit-economy`
- `subscription-jobs`

**Phase 2 (Post-V1 - Important):**
Apply to:
- `nightly-scores`
- `reliability-recalc`
- `stuck-detection`
- `goal-checker`

**Phase 3 (Post-V1 - Nice to have):**
Apply to remaining workers for consistency.

**Rationale:** 
- **Concurrency protection**: Prevents duplicate processing if workers run simultaneously
- **Observability**: `worker_runs` table provides execution history
- **Safety**: Low cost (advisory locks are cheap), high benefit
- **Consistency**: All workers behave the same way

---

## 3. Do we need additional test coverage before production?

### Current Test Coverage

**✅ Well Covered:**
- Job lifecycle (smoke + integration)
- State machine transitions
- Credit system (integration)
- Auth flows
- Stripe webhooks (integration)
- V1 hardening (idempotency, guards, atomic operations)

**⚠️ Gaps Identified:**

#### Missing Critical Tests:

1. **Payout Worker End-to-End**
   - [ ] Test payout creation from earnings
   - [ ] Test payout processing via Stripe
   - [ ] Test payout failure handling
   - [ ] Test concurrent payout worker runs (idempotency)

2. **Worker Concurrency**
   - [ ] Test that `runWorkerWithLock` prevents concurrent runs
   - [ ] Test that advisory locks release properly
   - [ ] Test worker failure recovery

3. **Guard Flag Behavior**
   - [ ] Test that `BOOKINGS_ENABLED=false` blocks job creation
   - [ ] Test that `CREDITS_ENABLED=false` blocks ledger operations
   - [ ] Test that `PAYOUTS_ENABLED=false` blocks payout processing
   - [ ] Test that `WORKERS_ENABLED=false` blocks all workers

4. **Error Recovery & Edge Cases**
   - [ ] Test partial failure scenarios (e.g., job completion fails mid-transaction)
   - [ ] Test duplicate webhook handling (already tested, but verify in production-like env)
   - [ ] Test ledger integrity after failures

5. **Production-like Integration**
   - [ ] Run Stripe E2E test with real Stripe test account
   - [ ] Run worker dry-run with production-like data volume
   - [ ] Load test critical endpoints

### ✅ **RECOMMENDATION: Add 3 critical test suites before launch**

**Priority 1 (Must Have):**
1. **Payout Worker Tests** - Money-moving code needs heavy testing
2. **Guard Flag Tests** - Verify kill switches actually work
3. **Worker Lock Tests** - Verify concurrency protection works

**Priority 2 (Should Have):**
4. **Error Recovery Tests** - Verify system recovers gracefully
5. **Production-like E2E** - Run Stripe test with real account

**Priority 3 (Nice to Have):**
6. Load tests
7. Chaos engineering (intentional failure injection)

---

## 4. Are the environment validation rules too strict or too lenient?

### Current Validation Rules

```typescript
// Stripe mode consistency
- ✅ Validates STRIPE_SECRET_KEY starts with sk_test_ or sk_live_
- ✅ Warns if test mode in production
- ✅ Warns if live mode in development

// Database URL
- ✅ Validates DATABASE_URL contains "postgres://" or "postgresql://"

// JWT Secret
- ⚠️ Warns (doesn't fail) if JWT_SECRET < 32 chars in production

// Guard Flags
- ✅ Logs warnings for disabled flags in production
```

### ✅ **RECOMMENDATION: Strengthen validation (more strict)**

**Current validation is too lenient for production.**

**Changes needed:**

1. **Stripe Mode in Production (STRICT):**
   ```typescript
   if (env.NODE_ENV === "production" && isTestMode) {
     throw new Error("❌ FATAL: Cannot use Stripe test key in production!");
   }
   ```

2. **JWT Secret Strength (STRICT):**
   ```typescript
   if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 64) {
     throw new Error("❌ FATAL: JWT_SECRET must be at least 64 characters in production");
   }
   ```

3. **Database URL Format (STRICT):**
   ```typescript
   if (!env.DATABASE_URL.match(/^postgres(ql)?:\/\/.+/)) {
     throw new Error("❌ FATAL: Invalid DATABASE_URL format");
   }
   ```

4. **Required Environment Variables (STRICT):**
   ```typescript
   // All required vars should fail fast, not just warn
   const requiredVars = [
     "DATABASE_URL",
     "JWT_SECRET",
     "STRIPE_SECRET_KEY",
     "STRIPE_WEBHOOK_SECRET",
     "N8N_WEBHOOK_SECRET",
   ];
   
   for (const varName of requiredVars) {
     if (!process.env[varName]) {
       throw new Error(`❌ FATAL: Missing required environment variable: ${varName}`);
     }
   }
   ```

5. **Production-Specific Guards (NEW):**
   ```typescript
   if (env.NODE_ENV === "production") {
     // Require explicit payout enablement
     if (env.PAYOUTS_ENABLED && !process.env.PAYOUTS_ENABLED) {
       throw new Error("❌ FATAL: PAYOUTS_ENABLED must be explicitly set to 'true' in production");
     }
     
     // Warn about disabled features
     if (!env.BOOKINGS_ENABLED) {
       console.warn("⚠️  WARNING: Bookings are DISABLED in production");
     }
   }
   ```

**Rationale:**
- **Fail fast**: Catch misconfigurations before deployment
- **Production safety**: Strict rules prevent costly mistakes
- **Clear errors**: "FATAL" prefix makes severity obvious
- **Explicit opt-in**: Payouts require conscious decision

**Development should remain lenient:**
- Warnings only (not errors) in development
- Allow test Stripe keys in development
- Shorter JWT secrets OK in development

---

## Summary of Recommendations

### ✅ 1. Guard Flags
**Action:** Keep defaults, add explicit payout requirement in production  
**Priority:** Medium  
**Risk if not done:** Medium (accidental payout enablement)

### ✅ 2. Worker Locks
**Action:** Apply `runWorkerWithLock` to at least 4 critical workers before launch  
**Priority:** High  
**Risk if not done:** High (concurrent processing, duplicate payouts)

### ✅ 3. Test Coverage
**Action:** Add payout worker tests, guard flag tests, worker lock tests  
**Priority:** High  
**Risk if not done:** High (undetected bugs in production)

### ✅ 4. Environment Validation
**Action:** Strengthen validation to fail fast on misconfigurations  
**Priority:** High  
**Risk if not done:** High (production misconfigurations cause outages)

---

## Implementation Order

1. **Before V1 Launch (Critical):**
   - Strengthen environment validation (fail fast)
   - Add locks to 4 critical workers
   - Add payout worker tests
   - Add guard flag tests

2. **Post-V1 (Important):**
   - Add locks to remaining workers
   - Add error recovery tests
   - Run production-like E2E tests

3. **Ongoing:**
   - Expand test coverage as features are added
   - Monitor worker execution in production
   - Refine validation rules based on operational experience

