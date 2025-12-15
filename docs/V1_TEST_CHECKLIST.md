# 🧪 V1 Test Checklist

**Purpose:** Comprehensive test checklist to verify V1 functionality before production deployment  
**Last Updated:** 2025-01-12

Run these tests in order to ensure everything works correctly.

---

## 📋 Test Execution Order

### Phase 1: Pre-Build Tests (Fast)
Run these before building the production bundle:

1. **Type Checking**
   ```bash
   npm run typecheck
   ```
   - ✅ **Expected:** No TypeScript errors
   - ❌ **If fails:** Fix type errors before proceeding

2. **Linting**
   ```bash
   npm run lint
   ```
   - ✅ **Expected:** No linting errors
   - ❌ **If fails:** Fix linting issues before proceeding

---

### Phase 2: Unit Tests (Fast)
Run these to verify individual components work:

```bash
npm test
```

**Test Files:**
- `src/tests/unit/paymentIdempotency.test.ts` - Payment idempotency logic
- `src/tests/unit/disputeRouting.test.ts` - Dispute routing logic
- `src/tests/unit/refundChargebackProcessors.test.ts` - Refund/chargeback handling

**✅ Expected:** All unit tests pass  
**❌ If fails:** Review unit test failures and fix underlying issues

---

### Phase 3: Smoke Tests (Fast)
Run these to verify basic API functionality:

```bash
npm run test:smoke
```

**Test Files:**
- `src/tests/smoke/health.test.ts` - Health check endpoints
- `src/tests/smoke/auth.test.ts` - Authentication flows
- `src/tests/smoke/jobs.test.ts` - Job CRUD operations
- `src/tests/smoke/credits.test.ts` - Credit operations
- `src/tests/smoke/messages.test.ts` - Messaging functionality
- `src/tests/smoke/events.test.ts` - Event system
- `src/tests/smoke/jobLifecycle.test.ts` - Full job lifecycle

**✅ Expected:** All smoke tests pass  
**❌ If fails:** Critical functionality broken - do not deploy

**Requirements:**
- Database connection required
- Valid `DATABASE_URL` in `.env`

---

### Phase 4: Integration Tests (Medium)
Run these to verify system integration:

```bash
npm run test:integration
```

**Test Files:**
- `src/tests/integration/auth.test.ts` - Auth integration
- `src/tests/integration/jobLifecycle.test.ts` - Complete job flow
- `src/tests/integration/stateMachine.test.ts` - State machine transitions
- `src/tests/integration/credits.test.ts` - Credit system integration
- `src/tests/integration/disputeFlow.test.ts` - Dispute resolution flow
- `src/tests/integration/stripeWebhook.test.ts` - Stripe webhook handling
- `src/tests/integration/adminFlows.test.ts` - Admin operations

**✅ Expected:** All integration tests pass  
**❌ If fails:** Integration issues - review error messages

**Requirements:**
- Database connection required
- Test users may need to exist (check test setup)

---

### Phase 5: V1 Hardening Tests (Critical)
Run these to verify V1 hardening features:

```bash
npm run test:v1-hardening
```

**Test File:** `src/tests/integration/v1Hardening.test.ts`

**What it tests:**
1. ✅ **Environment Guard Flags** - Verify all guard flags are defined
2. ✅ **Ledger Idempotency** - Duplicate escrow/purchase entries prevented
3. ✅ **Stripe Webhook Idempotency** - Duplicate webhook processing prevented
4. ✅ **Atomic Job Completion** - Job completion is transactional

**✅ Expected:** All V1 hardening tests pass  
**❌ If fails:** **CRITICAL** - V1 hardening features broken. Do not deploy.

**Requirements:**
- Database connection required
- Test users will be created automatically

---

### Phase 6: Build Verification
Ensure production build works:

```bash
npm run build
```

**✅ Expected:** Build succeeds with no errors  
**❌ If fails:** Fix build errors before deployment

**Verify:**
- `dist/` directory created
- All TypeScript files compiled
- No runtime errors in build output

---

### Phase 7: Worker Dry-Run Tests (Medium)
Test workers in a controlled environment:

```bash
npm run test:worker-dryrun
```

**What it tests:**
- Worker execution without side effects
- Worker idempotency (safe to run multiple times)
- Database integrity after worker runs
- Worker concurrency guards

**Tested Workers:**
- `auto-cancel`
- `payouts`
- `kpi-snapshot`
- `retry-events`

**✅ Expected:** All workers run successfully and are idempotent  
**❌ If fails:** Worker issues detected - review before enabling workers in production

**Requirements:**
- Database connection required
- Workers must be in `WORKERS_ENABLED=true` mode (or script will warn)

**Note:** This script tests workers but may not process real payouts if `PAYOUTS_ENABLED=false`

---

### Phase 8: Stripe End-to-End Test (Slow)
Full Stripe integration flow test:

```bash
npm run test:stripe-e2e
```

**What it tests:**
1. Create test users (client + cleaner)
2. Create Stripe customer
3. Create payment intent
4. Simulate webhook (payment succeeded)
5. Verify credits added
6. Create job
7. Complete job (atomic completion)
8. Verify credits released to cleaner
9. Verify webhook idempotency

**✅ Expected:** All steps pass  
**❌ If fails:** Stripe integration broken - do not deploy

**Requirements:**
- Database connection required
- **Stripe test account** (uses `sk_test_` keys)
- Valid `STRIPE_SECRET_KEY` in `.env`
- `CREDITS_ENABLED=true`

**⚠️ WARNING:** This test uses Stripe test mode but still creates test records. Run on staging/test database only.

---

## 🎯 Critical Test Suite (Minimum for V1 Launch)

If you're short on time, run at minimum:

```bash
# 1. Type check
npm run typecheck

# 2. V1 hardening tests (CRITICAL)
npm run test:v1-hardening

# 3. Build
npm run build

# 4. Smoke tests
npm run test:smoke
```

**These 4 test suites verify:**
- ✅ Code compiles
- ✅ V1 hardening features work (idempotency, guards, transactions)
- ✅ Production build succeeds
- ✅ Basic API functionality works

---

## 📊 Test Coverage

Run with coverage to see what's tested:

```bash
npm run test:coverage
```

**Target Coverage:**
- **Critical paths:** 80%+ (payment flows, job lifecycle, credits)
- **V1 hardening:** 100% (all idempotency guards, transactions)

---

## 🚨 Pre-Production Test Checklist

Before deploying to production, ensure:

- [ ] **Type checking passes:** `npm run typecheck`
- [ ] **Linting passes:** `npm run lint`
- [ ] **All unit tests pass:** `npm test`
- [ ] **All smoke tests pass:** `npm run test:smoke`
- [ ] **All integration tests pass:** `npm run test:integration`
- [ ] **V1 hardening tests pass:** `npm run test:v1-hardening` ⚠️ **CRITICAL**
- [ ] **Production build succeeds:** `npm run build`
- [ ] **Worker dry-run passes:** `npm run test:worker-dryrun` (if database available)
- [ ] **Stripe E2E test passes:** `npm run test:stripe-e2e` (if Stripe test account available)

---

## 🔧 Troubleshooting Test Failures

### Database Connection Errors

**Error:** `ECONNRESET` or connection timeout

**Solution:**
1. Verify `DATABASE_URL` is set correctly in `.env`
2. Check database is accessible from your network
3. Verify SSL mode: connection string should include `?sslmode=require`
4. For Neon: Check IP allowlist if using static IPs

### Missing Test Users

**Error:** Tests fail because test users don't exist

**Solution:**
1. Most tests create their own test users
2. Check test setup files in `src/tests/setup.ts`
3. Some integration tests may require pre-existing test users
4. Check test file comments for setup requirements

### Stripe Test Failures

**Error:** Stripe API errors in tests

**Solution:**
1. Verify `STRIPE_SECRET_KEY` is a test key (starts with `sk_test_`)
2. Ensure Stripe test account is active
3. Check Stripe API rate limits
4. Verify webhook secret is set (even if not used in tests)

### Worker Test Failures

**Error:** Workers fail in dry-run

**Solution:**
1. Verify `WORKERS_ENABLED=true` (or script will skip)
2. Check database connectivity
3. Review worker logs for specific errors
4. Verify worker dependencies (e.g., Stripe for payout worker)

### Idempotency Test Failures

**Error:** V1 hardening idempotency tests fail

**Solution:**
1. **CRITICAL** - Do not deploy if these fail
2. Check database constraints exist:
   - `stripe_events_processed` table
   - Unique constraints on `credit_ledger`
   - `payout_items` uniqueness
3. Verify migrations 901-905 have been run
4. Check transaction handling in services

---

## 📝 Test Data Cleanup

Most tests clean up after themselves, but if you need manual cleanup:

```sql
-- Clean up test users (use with caution!)
DELETE FROM credit_ledger WHERE user_id LIKE 'test-%';
DELETE FROM jobs WHERE client_id LIKE 'test-%' OR cleaner_id LIKE 'test-%';
DELETE FROM users WHERE id LIKE 'test-%';

-- Clean up test Stripe events
DELETE FROM stripe_events_processed WHERE stripe_event_id LIKE 'evt_test_%';
DELETE FROM stripe_events WHERE stripe_event_id LIKE 'evt_test_%';
```

---

## 🎯 Success Criteria for V1 Launch

**All of these must pass:**

1. ✅ Type checking: No errors
2. ✅ Linting: No errors
3. ✅ V1 hardening tests: All pass (100% critical)
4. ✅ Smoke tests: All pass
5. ✅ Production build: Succeeds
6. ✅ Stripe E2E: Passes (if Stripe test account available)

**Optional but recommended:**
- Integration tests: All pass
- Worker dry-run: Passes
- Test coverage: 80%+ on critical paths

---

## 🔄 Continuous Testing

**During Development:**
```bash
# Watch mode for fast feedback
npm run test:watch

# Run specific test file
npm test src/tests/integration/v1Hardening.test.ts

# Run tests matching pattern
npm test -- --grep "idempotency"
```

**Before Commits:**
```bash
npm run typecheck && npm run lint && npm run test:v1-hardening
```

**Before Deployment:**
```bash
npm run typecheck && npm run lint && npm test && npm run test:v1-hardening && npm run build
```

---

## 📚 Additional Test Resources

- **Test Utilities:** `src/tests/helpers/testUtils.ts` - Helper functions for creating test data
- **Test Setup:** `src/tests/setup.ts` - Database connection and setup
- **Test Config:** `vitest.config.ts` - Vitest configuration

---

**Last Updated:** 2025-01-12  
**Next Review:** After V1 launch

