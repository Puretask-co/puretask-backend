# Move 1: Test Infrastructure Failures Report

**Date**: [INSERT DATE]  
**Status**: IN PROGRESS - Fixing systematically

---

## 📊 **SUMMARY**

- **Total Test Suites**: 58
- **Passed**: 2
- **Failed**: 56
- **Total Tests**: 43
- **Passed**: 39
- **Failed**: 4

---

## 🚨 **CRITICAL ISSUES (Blocking)**

### **1. Vitest vs Jest Confusion** 🔴 **CRITICAL**
**Impact**: 20+ test files failing  
**Issue**: Tests importing from `vitest` but project uses Jest

**Affected Files**:
- `src/tests/integration/disputeFlow.test.ts`
- `src/tests/smoke/jobLifecycle.test.ts`
- `src/tests/integration/v3Features.test.ts`
- `src/tests/integration/v1Hardening.test.ts`
- `src/tests/integration/stripeWebhook.test.ts`
- `src/tests/smoke/jobs.test.ts`
- `src/tests/smoke/auth.test.ts`
- `src/tests/smoke/events.test.ts`
- `src/tests/smoke/credits.test.ts`
- `src/tests/smoke/messages.test.ts`
- `src/tests/smoke/health.test.ts`
- `src/tests/unit/refundChargebackProcessors.test.ts`
- `src/tests/unit/paymentIdempotency.test.ts`
- `src/tests/unit/disputeRouting.test.ts`

**Fix**: Replace `import { describe, it, expect } from "vitest"` with `import { describe, it, expect } from "@jest/globals"`

---

### **2. `vi` Import from Jest** 🔴 **CRITICAL**
**Impact**: 25+ test files failing  
**Issue**: `vi` is Vitest-specific, not available in Jest. Should use `jest.fn()` instead.

**Affected Files**:
- `src/services/__tests__/onboardingReminderService.test.ts`
- `src/services/__tests__/cleanerOnboardingService.test.ts`
- `src/tests/integration/onboardingFlow.test.ts`
- `src/tests/integration/externalServices.test.ts`
- `src/middleware/__tests__/csrf.test.ts`
- `src/routes/__tests__/cleanerOnboarding.test.ts`
- `src/services/__tests__/phoneVerificationService.test.ts`
- `src/lib/__tests__/errorRecovery.test.ts`
- `src/services/__tests__/payoutsService.test.ts`
- `src/services/__tests__/reliabilityService.test.ts`
- `src/tests/integration/stripe.test.ts`
- `src/lib/__tests__/security.test.ts`
- `src/workers/__tests__/autoCancelJobs.test.ts`
- `src/middleware/__tests__/jwtAuth.test.ts`
- `src/middleware/__tests__/security.test.ts`
- `src/workers/__tests__/onboardingReminderWorker.test.ts`
- `src/services/__tests__/fileUploadService.test.ts`
- `src/routes/__tests__/adminIdVerifications.test.ts`
- `src/middleware/__tests__/adminAuth.test.ts`
- `src/services/__tests__/creditsService.test.ts`
- `src/middleware/__tests__/rateLimit.test.ts`
- `src/services/__tests__/jobMatchingService.test.ts`
- `src/services/__tests__/matchingService.test.ts`
- `src/services/__tests__/pricingService.test.ts`
- `src/lib/__tests__/events.test.ts`
- `src/services/__tests__/jobsService.test.ts`
- `src/workers/__tests__/payoutWeekly.test.ts`

**Fix**: 
- Replace `import { vi } from '@jest/globals'` with `import { jest } from '@jest/globals'`
- Replace `vi.fn()` with `jest.fn()`
- Replace `vi.mock()` with `jest.mock()`
- Replace `vi.spyOn()` with `jest.spyOn()`

---

## ⚠️ **HIGH PRIORITY ISSUES**

### **3. TypeScript Type Errors**
**Impact**: Multiple test files

**Issues**:
- `src/tests/integration/credits.test.ts`: Wrong property names (`creditsAmount` vs `creditAmount`, `amount` vs `creditAmount`)
- `src/services/__tests__/cleanerOnboardingService.test.ts`: Missing `is_active` property in availability blocks
- `src/middleware/__tests__/csrf.test.ts`: Cannot assign to read-only `req.ip`
- `src/tests/integration/externalServices.test.ts`: `TWILIO_PHONE_NUMBER` should be `TWILIO_FROM_NUMBER`
- `src/lib/__tests__/errorRecovery.test.ts`: `maxAttempts` doesn't exist in `RetryConfig`
- `src/services/__tests__/payoutsService.test.ts`: Wrong argument type for `getCleanerPayouts`
- `src/services/__tests__/reliabilityService.test.ts`: Wrong argument type for `computeReliabilityScoreFromStats`
- `src/tests/integration/adminFlows.test.ts`: Missing `rowCount` in mock query results
- `src/middleware/__tests__/adminAuth.test.ts`: Implicit `any` types
- `src/middleware/__tests__/rateLimit.test.ts`: Wrong import name (`productionRateLimiter` vs `productionRateLimit`)
- `src/lib/__tests__/events.test.ts`: Wrong import paths
- `src/workers/__tests__/payoutWeekly.test.ts`: Wrong import (`runPayoutsWorker` doesn't exist)
- `src/tests/integration/v2Features.test.ts`: Missing worker modules
- `src/__tests__/integration/api/auth.test.ts`: Missing `toBeValidJWT` matcher

**Fix**: Fix each type error individually

---

### **4. Missing Modules/Imports**
**Impact**: Multiple test files

**Issues**:
- `src/lib/__tests__/events.test.ts`: Cannot find `../db/client` and `../lib/logger` (wrong paths)
- `src/tests/integration/v2Features.test.ts`: Missing worker modules
- `src/routes/admin/analytics.ts`: Cannot find `../../types/express`
- `src/middleware/__tests__/security.test.ts`: `sanitizeBody` not exported

**Fix**: Fix import paths or create missing files

---

### **5. Duplicate Imports**
**Impact**: 2 test files

**Issues**:
- `src/tests/integration/onboardingFlow.test.ts`: Duplicate `request` import
- `src/routes/__tests__/cleanerOnboarding.test.ts`: Duplicate `request` import and `mockQuery` redeclaration

**Fix**: Remove duplicate imports

---

### **6. Database Migration Issues**
**Impact**: Migration tests failing

**Issues**:
- `src/tests/integration/migrations.test.ts`: Columns `onboarding_current_step`, `onboarding_reminder_sent_at` don't exist
- Migration `035_onboarding_enhancements.sql` may not have been run

**Fix**: Run migration or update tests

---

### **7. TypeScript Compilation Errors in Source**
**Impact**: Multiple test files can't compile

**Issues**:
- `src/lib/sanitization.ts`: Type conversion errors (lines 93, 98)

**Fix**: Fix type assertions in source code

---

## 📋 **FIX PRIORITY ORDER**

1. **Fix Vitest imports** (Critical - blocks 20+ files)
2. **Fix `vi` imports** (Critical - blocks 25+ files)
3. **Fix TypeScript errors in source** (`src/lib/sanitization.ts`)
4. **Fix missing modules/imports**
5. **Fix TypeScript type errors in tests**
6. **Fix duplicate imports**
7. **Fix database migration issues**

---

## ✅ **FIXES APPLIED**

[Will be updated as fixes are applied]

---

## 📝 **NOTES**

- Some tests may need database setup
- Some tests may need environment variables
- Migration tests require database to be in sync

---

**Next Steps**: Start fixing issues in priority order.
