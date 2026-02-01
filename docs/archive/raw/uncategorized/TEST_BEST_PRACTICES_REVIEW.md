# Test Best Practices Review - PureTask Backend

**Date:** 2025-01-11  
**Scope:** Review of test failures and best practices compliance

---

## Executive Summary

**Test Status:** 7 failed | 28 passed (35 total)

**Key Issues Found:**
1. ❌ **Events API tests** - Tests don't match actual API contract (HMAC signature in header, not body)
2. ❌ **Job lifecycle test** - Data integrity issues (user doesn't exist when creating payout)
3. ❌ **Schema mismatch** - `reliability_score` column doesn't exist in database
4. ⚠️ **Test isolation** - Database connection errors during cleanup
5. ⚠️ **Test data setup** - Credits consumed between tests

---

## 1. Events API Test Failures (4 failures)

### ❌ **Issue: Tests Don't Match API Contract**

**Problem:**
```typescript
// ❌ WRONG - Test sends webhook_secret in body
const response = await request(app)
  .post("/events")
  .send({
    event_type: "test_event",
    webhook_secret: env.N8N_WEBHOOK_SECRET,  // Wrong!
  });
```

**Reality:**
```typescript
// ✅ CORRECT - API expects HMAC signature in header
const response = await request(app)
  .post("/events")
  .set("x-n8n-signature", computeN8nSignature(body))  // Header!
  .send({
    event_type: "test_event",
  });
```

**Best Practice Violation:**
- ❌ Tests should match the actual API contract
- ❌ Tests should use the provided helper function `computeN8nSignature()`
- ❌ Tests expect wrong response format (expects `{success: true}`, but API returns `204 No Content`)

**Fix Required:**
1. Update tests to use `x-n8n-signature` header
2. Use `computeN8nSignature()` helper from `src/lib/auth.ts`
3. Update expected response format (204 instead of 200 with body)

---

## 2. Job Lifecycle Test Failures (3 failures)

### ❌ **Issue 1: Payout Creation Fails - User Doesn't Exist**

**Error:**
```
Cannot create payout: cleaner user d2364ab6-d9d6-42cd-97c3-945d816f9c65 does not exist.
This indicates a data integrity issue - the user should exist if a job was assigned to them.
```

**Root Cause Analysis:**
1. ✅ User WAS created (logs show `user_registered` at line 623)
2. ❌ User check in `payoutsService.ts:101` fails to find user
3. Possible causes:
   - Transaction isolation issue
   - User cleaned up before payout creation
   - Database connection issue

**Best Practice Violation:**
- ⚠️ **Transaction isolation** - User check happens in different transaction than user creation
- ⚠️ **Test cleanup timing** - Cleanup might be running too early
- ⚠️ **Error handling** - Error message is good, but root cause unclear

**Fix Required:**
1. Ensure user exists in same transaction context
2. Add retry logic or wait for transaction commit
3. Improve test isolation (don't cleanup until after all assertions)

### ❌ **Issue 2: Schema Mismatch - `reliability_score` Column Missing**

**Error:**
```
column "reliability_score" does not exist
```

**Root Cause:**
- Code references `cleaner_profiles.reliability_score` in multiple places
- Database schema doesn't have this column
- Migration might not have been run

**Best Practice Violation:**
- ❌ **Schema drift** - Code and database schema are out of sync
- ❌ **Migration management** - Missing column indicates migration not applied

**Fix Required:**
1. Check if migration `001_init.sql` was run
2. Verify `cleaner_profiles` table has `reliability_score` column
3. Run missing migrations if needed

### ⚠️ **Issue 3: Insufficient Credits**

**Error:**
```
Insufficient credits. Required: 50, Available: 0
```

**Root Cause:**
- Credits were added in `beforeAll` (line 25: `addCreditsToUser(client.id, 500)`)
- Credits were consumed by first test
- Subsequent tests don't have credits

**Best Practice Violation:**
- ⚠️ **Test isolation** - Tests share state (credits)
- ⚠️ **Test data setup** - Credits should be set up per test, not per suite

**Fix Required:**
1. Move credit setup to `beforeEach` instead of `beforeAll`
2. Or add credits before each test that needs them
3. Or use test transactions that rollback

---

## 3. Database Connection Issues

### ⚠️ **Issue: ECONNRESET During Cleanup**

**Error:**
```
Error: Client network socket disconnected before secure TLS connection was established
```

**Root Cause:**
- Database connection pool exhausted or closed
- Cleanup runs after pool is closed
- Network timeout or connection reset

**Best Practice Violation:**
- ⚠️ **Resource cleanup** - Cleanup should happen before pool closes
- ⚠️ **Error handling** - Cleanup should handle connection errors gracefully

**Fix Required:**
1. Ensure cleanup runs before pool closes
2. Add error handling in cleanup functions
3. Use connection retry logic

---

## 4. Test Best Practices Analysis

### ✅ **What We're Doing Right**

1. **Test Organization**
   - ✅ Clear test structure (smoke, integration, unit)
   - ✅ Test utilities for common operations
   - ✅ Proper test descriptions

2. **Test Data Management**
   - ✅ Unique email generation
   - ✅ Test user creation helpers
   - ✅ Cleanup utilities

3. **Assertions**
   - ✅ Clear expectations
   - ✅ Proper status code checks
   - ✅ Response body validation

### ❌ **What Needs Improvement**

1. **Test Isolation**
   - ❌ Tests share state (credits consumed)
   - ❌ Cleanup timing issues
   - ❌ Database connection issues

2. **API Contract Compliance**
   - ❌ Events API tests don't match actual API
   - ❌ Wrong request format (body vs header)
   - ❌ Wrong expected response format

3. **Error Handling**
   - ❌ Tests don't handle connection errors
   - ❌ Cleanup doesn't handle failures gracefully

4. **Test Data Setup**
   - ❌ Credits set up once, consumed by multiple tests
   - ❌ No per-test isolation

---

## 5. Specific Recommendations

### 🔴 **High Priority Fixes**

1. **Fix Events API Tests**
   ```typescript
   // ✅ CORRECT
   import { computeN8nSignature } from "../../lib/auth";
   
   it("should accept valid event", async () => {
     const body = { event_type: "test_event" };
     const signature = computeN8nSignature(body);
     
     const response = await request(app)
       .post("/events")
       .set("x-n8n-signature", signature)
       .send(body);
     
     expect(response.status).toBe(204); // Not 200!
   });
   ```

2. **Fix Schema Mismatch**
   - Run migration to add `reliability_score` column
   - Or update code to handle missing column gracefully

3. **Fix Test Isolation**
   ```typescript
   // ✅ Move to beforeEach
   beforeEach(async () => {
     await addCreditsToUser(client.id, 500);
   });
   ```

### 🟡 **Medium Priority Fixes**

4. **Fix Payout User Check**
   - Investigate transaction isolation
   - Add retry logic or ensure user exists in same transaction

5. **Improve Cleanup Error Handling**
   ```typescript
   afterAll(async () => {
     try {
       await cleanupTestData();
     } catch (error) {
       // Log but don't fail test
       console.warn("Cleanup failed:", error);
     }
   });
   ```

### 🟢 **Low Priority Improvements**

6. **Add Test Helpers for Events API**
   ```typescript
   export function createN8nRequest(body: unknown) {
     const signature = computeN8nSignature(body);
     return request(app)
       .post("/events")
       .set("x-n8n-signature", signature)
       .send(body);
   }
   ```

7. **Add Test Transactions**
   - Use database transactions that rollback after each test
   - Ensures complete test isolation

---

## 6. Best Practices Checklist

### Test Design
- [x] Clear test descriptions
- [x] Test utilities for common operations
- [ ] Tests match actual API contract
- [ ] Tests are isolated (no shared state)
- [ ] Tests clean up after themselves

### Test Data
- [x] Unique test data generation
- [x] Test user creation helpers
- [ ] Per-test data setup (not per-suite)
- [ ] Test data cleanup

### Error Handling
- [ ] Tests handle connection errors
- [ ] Cleanup handles failures gracefully
- [ ] Clear error messages

### API Testing
- [ ] Tests use correct request format
- [ ] Tests expect correct response format
- [ ] Tests use helper functions for complex operations

---

## 7. Action Items

### Immediate (Fix Test Failures)
1. [ ] Update Events API tests to use `x-n8n-signature` header
2. [ ] Fix expected response format (204 instead of 200)
3. [ ] Run migration to add `reliability_score` column
4. [ ] Move credit setup to `beforeEach` for test isolation

### Short Term (Improve Test Quality)
5. [ ] Fix payout user check transaction isolation
6. [ ] Add error handling to cleanup functions
7. [ ] Add test helpers for Events API requests
8. [ ] Add retry logic for database operations

### Long Term (Best Practices)
9. [ ] Implement test transactions for complete isolation
10. [ ] Add test coverage reporting
11. [ ] Document test patterns and conventions
12. [ ] Add integration test for full job lifecycle

---

## Conclusion

The test suite has **good structure and organization**, but has **critical issues** with:
1. **API contract compliance** - Events tests don't match actual API
2. **Test isolation** - Tests share state causing failures
3. **Schema drift** - Code references columns that don't exist

**Priority:** Fix the Events API tests and schema mismatch first, as these are blocking other tests.

**Overall Test Quality:** B- (Good structure, but needs fixes for isolation and API compliance)

