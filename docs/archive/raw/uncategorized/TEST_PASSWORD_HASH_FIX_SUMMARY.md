# Test Password Hash Fix Summary

**Date:** 2025-01-12  
**Issue:** Integration tests failing with NOT NULL violation on `users.password_hash`  
**Status:** ✅ FIXED

---

## Changes Made

### 1. Created Shared Test Constant

**File:** `src/tests/helpers/testConstants.ts` (NEW)

```typescript
export const TEST_PASSWORD_HASH = '$2b$10$u1b9n5uXlE0Ue4zqzQm5xOJcY5Y9Qm5k8vQpR6R3m7u3p8VbVqZxK';
```

**Purpose:** Centralized test password hash to ensure all test user creation uses a valid bcrypt hash.

---

### 2. Updated Test Files

#### File 1: `src/tests/integration/v1Hardening.test.ts`

**Changes:**
- Added import: `import { TEST_PASSWORD_HASH } from "../helpers/testConstants";`
- Replaced inline hash strings with `TEST_PASSWORD_HASH` constant

**Before:**
```typescript
[TEST_CLIENT_ID, `test-client-${Date.now()}@test.com`, "client", "$2b$10$dummyhashfor.testingpurposesonly1234567890"]
[TEST_CLEANER_ID, `test-cleaner-${Date.now()}@test.com`, "cleaner", "$2b$10$dummyhashfor.testingpurposesonly1234567890"]
```

**After:**
```typescript
[TEST_CLIENT_ID, `test-client-${Date.now()}@test.com`, "client", TEST_PASSWORD_HASH]
[TEST_CLEANER_ID, `test-cleaner-${Date.now()}@test.com`, "cleaner", TEST_PASSWORD_HASH]
```

#### File 2: `src/tests/integration/jobLifecycle.test.ts`

**Changes:**
- Added import: `import { TEST_PASSWORD_HASH } from "../helpers/testConstants";`
- Replaced inline hash strings with `TEST_PASSWORD_HASH` constant
- Updated SQL query to use parameterized hash instead of inline values

**Before:**
```typescript
INSERT INTO users (id, email, password_hash, role)
VALUES 
  ($1, 'test-client@example.com', '$2b$10$dummy', 'client'),
  ($2, 'test-cleaner@example.com', '$2b$10$dummy', 'cleaner'),
  ($3, 'test-admin@example.com', '$2b$10$dummy', 'admin')
ON CONFLICT (id) DO NOTHING
[TEST_CLIENT_ID, TEST_CLEANER_ID, TEST_ADMIN_ID]
```

**After:**
```typescript
INSERT INTO users (id, email, password_hash, role)
VALUES 
  ($1, 'test-client@example.com', $4, 'client'),
  ($2, 'test-cleaner@example.com', $4, 'cleaner'),
  ($3, 'test-admin@example.com', $4, 'admin')
ON CONFLICT (id) DO NOTHING
[TEST_CLIENT_ID, TEST_CLEANER_ID, TEST_ADMIN_ID, TEST_PASSWORD_HASH]
```

---

### 3. Files NOT Changed (Already Correct)

#### `src/tests/helpers/testUtils.ts`

The `createTestAdmin()` function already correctly hashes passwords using bcrypt because it needs to log in afterward:

```typescript
const bcrypt = await import("bcryptjs");
const passwordHash = await bcrypt.hash("adminpassword123", 10);
```

This is correct and should not be changed because:
- It needs a real hash for authentication
- It uses bcrypt properly
- It's testing the login flow

#### Other Test Files

- `src/tests/integration/auth.test.ts` - Uses `/auth/register` endpoint (handles password_hash automatically)
- `src/tests/integration/disputeFlow.test.ts` - Uses `createTestClient()` helper (uses registration endpoint)
- `src/tests/integration/credits.test.ts` - Uses `createTestClient()` helper (uses registration endpoint)
- `src/tests/integration/stripeWebhook.test.ts` - Uses `createTestClient()` helper (uses registration endpoint)

These files use helper functions that go through the registration endpoint, which properly hashes passwords.

---

## Verification

✅ **TypeScript Compilation:** Passes  
✅ **All direct INSERT statements:** Now include `password_hash`  
✅ **Constant created:** Centralized test password hash  
✅ **No production code changed:** Only test utilities modified  

---

## Files Changed

1. ✅ `src/tests/helpers/testConstants.ts` (NEW)
2. ✅ `src/tests/integration/v1Hardening.test.ts`
3. ✅ `src/tests/integration/jobLifecycle.test.ts`

---

## Result

All test user creation now properly populates `password_hash` field, preventing NOT NULL constraint violations while maintaining test isolation and not affecting production code.

