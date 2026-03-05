# Section 7: API Design & Contracts - Needs Assessment

## Current Status: ~60% Complete

You have solid foundations but need a few critical improvements for production.

---

## 🔴 CRITICAL (Do These Now)

### 1. Request ID in Error Responses
**Status**: ✅ Tracking it, ❌ Not returning it

**Why**: Clients need `requestId` to report issues and you can trace logs.

**Current**: Errors return `{ error: { code, message } }`  
**Needed**: `{ error: { code, message, requestId } }`

**Impact**: High - Makes debugging 10x easier

---

### 2. Idempotency-Key Header Support
**Status**: ❌ Not implemented for API endpoints

**Why**: Prevents double charges, double payouts, duplicate bookings if client retries.

**Needed For**:
- `POST /jobs` (create booking)
- `POST /jobs/:id/approve` (release escrow)
- `POST /payments/charge` (charge credits)
- `POST /payouts/trigger` (admin payout)

**Impact**: Critical - Prevents financial errors

---

### 3. Standardize Pagination
**Status**: ⚠️ Inconsistent (some use limit/offset, some don't)

**Current**: Mixed patterns across routes  
**Needed**: Consistent `limit`/`offset` OR cursor-based

**Standard Format**:
```json
{
  "items": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

**Impact**: Medium - Makes client integration easier

---

## 🟡 IMPORTANT (Should Have Soon)

### 4. Consistent Response Wrapper
**Status**: ⚠️ Mixed (some return raw data, some wrap)

**Current**: 
- Success: `res.json({ user: ... })` or `res.json({ data: ... })`
- Error: `{ error: { code, message } }`

**Needed**: Always wrap:
- Success: `{ data: ... }`
- Error: `{ error: { code, message, requestId } }`

**Impact**: Medium - Makes client code more predictable

---

### 5. API Documentation
**Status**: ❌ No machine-readable docs

**Needed**: 
- Simple markdown endpoint catalog (can start here)
- OpenAPI spec (add later when you have external clients)

**Impact**: Medium - Helps onboarding and prevents mistakes

---

## 🟢 NICE-TO-HAVE (Can Wait)

### 6. `/api` Base Path
**Status**: Routes mounted directly (`/jobs`, `/admin`)

**Current**: Works fine  
**Needed**: Only if you want `/api/v1/jobs` structure

**Impact**: Low - Not critical if routes work

---

### 7. Full Versioning Strategy
**Status**: ✅ You have `/v2` routes

**Current**: Good enough  
**Needed**: Only if you need strict versioning policy

**Impact**: Low - You can version incrementally

---

### 8. Contract Tests
**Status**: ❌ No schema validation tests

**Needed**: Tests that validate response schemas match contracts

**Impact**: Low - Can add incrementally

---

## Recommendation

**Do Now (30 min)**:
1. Add `requestId` to error responses
2. Add `Idempotency-Key` header support for risky endpoints
3. Standardize pagination format

**Do Soon (2 hours)**:
4. Consistent response wrapper
5. Basic API documentation (markdown)

**Skip For Now**:
- OpenAPI spec (add when you have external clients)
- `/api` base path (not critical)
- Full versioning strategy (you have `/v2`, that's enough)
- Contract tests (add incrementally)

---

## Priority Order

1. **Idempotency-Key** (prevents financial errors)
2. **Request ID in errors** (makes debugging possible)
3. **Standardize pagination** (makes clients easier)
4. **Response wrapper** (polish)
5. **Documentation** (polish)

Everything else can wait until you have external clients or need stricter contracts.
