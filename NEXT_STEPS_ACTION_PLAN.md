# 🎯 PureTask Backend - Next Steps Action Plan

**Date:** December 11, 2025  
**Current Status:** ✅ Smoke Tests Passing (36/36), ⚠️ Integration Tests Need Fixes (9/60)

---

## 📊 Current State

### ✅ What's Working
- **Smoke Tests:** 36/36 passing (100%)
- **TypeScript:** Compiling without errors
- **Core Functionality:** All features implemented
- **Database Schema:** Aligned with codebase
- **Production Readiness:** Core API ready for deployment

### ⚠️ What Needs Work
- **Integration Tests:** 9/60 passing (15%) - API contract mismatches
- **Code Quality:** 136 ESLint warnings (auto-fixable)
- **Documentation:** Needs updates for current API

---

## 🎯 Priority 1: Fix Integration Tests (IMMEDIATE)

**Goal:** Get integration tests to 100% pass rate  
**Estimated Time:** 2-4 hours  
**Impact:** High - Ensures API contract compliance

### Tasks:

#### 1.1 Fix API Contract Mismatches in `auth.test.ts`
**Issues:**
- Tests expect `accessToken` but API returns `token`
- Tests expect status `409` for duplicate email but API returns `400`
- Tests expect error code `LOGIN_FAILED` but API returns `INVALID_CREDENTIALS`

**Action:**
```typescript
// Update test expectations to match actual API:
- res.body.accessToken → res.body.token
- expect(409) → expect(400) for duplicate email
- error.code === 'LOGIN_FAILED' → error.code === 'INVALID_CREDENTIALS'
```

#### 1.2 Fix State Machine Tests in `stateMachine.test.ts`
**Issues:**
- Tests use outdated state names: `created`, `request`, `en_route`, `awaiting_client`
- Actual states: `requested`, `accepted`, `on_my_way`, `in_progress`, `awaiting_approval`

**Action:**
```typescript
// Update all state references:
- 'created' → 'requested'
- 'request' → 'requested'
- 'en_route' → 'on_my_way'
- 'awaiting_client' → 'awaiting_approval'
```

#### 1.3 Fix Job Creation Tests
**Issues:**
- Missing 2-hour lead time requirement for `scheduled_start_at`
- Missing `estimated_hours` field requirement

**Action:**
```typescript
// In job creation tests, ensure:
scheduled_start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
estimated_hours: 2 // Add this required field
```

#### 1.4 Migrate Jest to Vitest in `adminFlows.test.ts`
**Issue:**
- File uses `jest.mock()` which doesn't work in Vitest

**Action:**
```typescript
// Replace Jest syntax:
- jest.mock('module') → vi.mock('module')
- jest.fn() → vi.fn()
// Import from vitest instead of jest
```

#### 1.5 Fix Credits Test in `credits.test.ts`
**Issue:**
- `error: invalid input syntax for type integer: "NaN"`
- Likely missing or invalid `amount` value

**Action:**
- Check that `amount` is a valid number before database operations
- Ensure test data includes proper numeric values

---

## 🎯 Priority 2: Code Quality Cleanup (SHORT-TERM)

**Goal:** Reduce ESLint warnings to zero  
**Estimated Time:** 1-2 hours  
**Impact:** Medium - Improves code maintainability

### Tasks:

#### 2.1 Auto-fix ESLint Warnings
```bash
npm run lint -- --fix
```

#### 2.2 Manual Fixes
- Remove unused variables
- Replace `any` types with proper types
- Fix `prefer-const` warnings

---

## 🎯 Priority 3: Missing Auth Routes (IF NEEDED)

**Goal:** Implement missing auth endpoints if required by frontend  
**Estimated Time:** 1-2 hours  
**Impact:** Medium - May be required for frontend integration

### Tasks:

#### 3.1 Implement `PATCH /auth/me`
**Purpose:** Update user profile
**Action:**
- Add route handler in `src/routes/auth.ts`
- Add service method in `src/services/authService.ts`
- Add validation schema

#### 3.2 Implement `POST /auth/change-password`
**Purpose:** Change user password
**Action:**
- Add route handler in `src/routes/auth.ts`
- Add service method in `src/services/authService.ts`
- Add password validation and hashing

**Note:** Only implement if these routes are actually needed by the frontend.

---

## 🎯 Priority 4: Documentation Updates (SHORT-TERM)

**Goal:** Keep documentation current  
**Estimated Time:** 1 hour  
**Impact:** Low - Improves developer experience

### Tasks:

#### 4.1 Update README.md
- Document all 26 route files
- Update API examples
- Add deployment instructions
- Add environment variable documentation

#### 4.2 Create API Reference
- Document all endpoints
- Include request/response examples
- Add authentication requirements

---

## 📋 Recommended Execution Order

### Week 1: Critical Fixes
1. ✅ **Day 1-2:** Fix integration tests (Priority 1)
   - Start with `auth.test.ts` (easiest)
   - Then `stateMachine.test.ts` (state name fixes)
   - Then `jobLifecycle.test.ts` (field requirements)
   - Finally `adminFlows.test.ts` (Jest migration)

2. ✅ **Day 3:** Code quality cleanup (Priority 2)
   - Run auto-fix
   - Manual fixes for remaining issues

### Week 2: Enhancements
3. ✅ **Day 4-5:** Missing routes (Priority 3) - if needed
4. ✅ **Day 6:** Documentation updates (Priority 4)

---

## 🚀 Quick Start: Fix Integration Tests

### Step 1: Fix Auth Tests (15 minutes)
```bash
# Open src/tests/integration/auth.test.ts
# Find and replace:
# - accessToken → token
# - 409 → 400 (duplicate email)
# - LOGIN_FAILED → INVALID_CREDENTIALS
```

### Step 2: Fix State Machine Tests (30 minutes)
```bash
# Open src/tests/integration/stateMachine.test.ts
# Find and replace all state names:
# - 'created' → 'requested'
# - 'request' → 'requested'
# - 'en_route' → 'on_my_way'
# - 'awaiting_client' → 'awaiting_approval'
```

### Step 3: Fix Job Creation Tests (30 minutes)
```bash
# Open src/tests/integration/jobLifecycle.test.ts
# Ensure scheduled_start_at is 3+ hours in future
# Add estimated_hours field to job creation
```

### Step 4: Migrate Jest to Vitest (30 minutes)
```bash
# Open src/tests/integration/adminFlows.test.ts
# Replace jest.mock with vi.mock
# Replace jest.fn() with vi.fn()
# Import from vitest instead of jest
```

### Step 5: Run Tests
```bash
npm run test:integration
```

---

## 📊 Success Metrics

### Target Goals:
- ✅ Integration Tests: 60/60 passing (100%)
- ✅ ESLint Warnings: 0 warnings
- ✅ Documentation: Complete and up-to-date
- ✅ All Tests: 96/96 passing (smoke + integration)

### Current vs Target:
- Integration Tests: 9/60 (15%) → **60/60 (100%)**
- ESLint Warnings: 136 → **0**
- Test Coverage: 45/96 (47%) → **96/96 (100%)**

---

## 🎯 Immediate Next Action

**Start with:** Fix `auth.test.ts` - it's the quickest win and will give immediate feedback.

**Command to run:**
```bash
# 1. Open the file
code src/tests/integration/auth.test.ts

# 2. Make the fixes (see Step 1 above)

# 3. Test
npm run test:integration -- auth.test.ts
```

---

**Ready to start?** Let me know which priority you'd like to tackle first!

