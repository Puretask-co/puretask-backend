# Section 8 — Security Hardening Assessment

## Current Security Posture

### ✅ **What You Already Have (Strong Foundation)**

#### 8.1 Security Headers & CORS ✅
- **Helmet.js** configured with HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Custom security headers** middleware (`src/middleware/security.ts`)
- **CORS allowlist** with specific origins (no wildcards)
- **Referrer-Policy** and **Permissions-Policy** headers
- **X-Powered-By** header removed

#### 8.2 Input Validation & Sanitization ✅
- **Zod validation** on all routes (`validateBody`, `validateQuery`, `validateParams`)
- **Sanitization library** (`src/lib/sanitization.ts`) with:
  - HTML sanitization
  - SQL injection pattern removal
  - Email/URL/phone normalization
  - Recursive object sanitization
- **Body sanitization middleware** applied globally

#### 8.3 Rate Limiting ✅
- **Route-class rate limits** (`src/lib/security.ts`)
- **Endpoint-specific limits** for auth, payments, admin
- **IP-based throttling** with proper proxy handling
- **Rate limit headers** (X-RateLimit-*)

#### 8.4 Webhook Security ✅
- **Stripe signature verification** (raw body handling)
- **n8n HMAC verification** with timing-safe comparison
- **Idempotency checks** via `stripe_events_processed` table
- **Webhook isolation** (mounted before JSON parsing)

#### 8.5 File Upload Security ✅
- **Presigned URL flow** (client uploads directly to storage)
- **MIME type validation** (JPEG, PNG, WebP)
- **Content type checking** before generating upload URL
- **Ownership validation** (cleaner must be assigned to job)
- **Status-based validation** (before/after photos at correct times)

#### 8.6 Authentication ✅
- **JWT-based auth** with canonical middleware
- **Token expiration** (configurable via `JWT_EXPIRES_IN`, default 30d)
- **JTI (JWT ID)** included in tokens
- **Role-based access control** enforced

#### 8.7 Authorization & Ownership Checks ✅
- **Ownership checks** in key routes (e.g., `GET /jobs/:id` checks `client_id`/`cleaner_id`)
- **Role boundaries** enforced (`requireAdmin`, `requireClient`, `requireCleaner`)
- **Admin routes** isolated under `/admin/*`

#### 8.8 Environment Validation ✅
- **Startup validation** (`src/config/env.ts`)
- **Required env vars** fail fast
- **Production guards** (JWT secret length, test mode detection)

#### 8.9 Audit Logging (Partial) ⚠️
- **Admin audit log table** exists (`admin_audit_log`)
- **Some admin actions** logged (clients, cleaners, bookings)
- **Security events table** exists (`security_events`)

---

### ⚠️ **Gaps & Improvements Needed**

#### 8.1 JWT Token Security (Needs Hardening)
**Current:**
- Tokens expire in 30 days (too long)
- No token invalidation on password change
- No token versioning for bulk revocation

**Needed:**
- [ ] Short-lived access tokens (15m–1h) + refresh tokens
- [ ] Token invalidation on sensitive events (password change, role change)
- [ ] Token version field in JWT claims for bulk revocation

#### 8.2 Ownership Checks (Incomplete Coverage)
**Current:**
- Some routes check ownership (e.g., `GET /jobs/:id`)
- Not all resource reads enforce ownership

**Needed:**
- [ ] Audit all `GET` endpoints for missing ownership checks
- [ ] Enforce ownership on all mutating operations
- [ ] Add helper function: `ensureOwnership(resource, userId, role)`

#### 8.3 SQL Injection Prevention (Dynamic Queries)
**Current:**
- Parameterized queries used everywhere
- BUT: Some dynamic `ORDER BY` fields exist (e.g., `src/routes/admin/clients.ts`)

**Needed:**
- [ ] Whitelist all sortable fields
- [ ] Prevent dynamic SQL construction for ORDER BY
- [ ] Sanitize LIKE patterns to prevent runaway scans

#### 8.4 SSRF Protection (Missing)
**Current:**
- No outbound HTTP requests found in codebase
- BUT: If you add URL fetching (images, verification links), SSRF risk appears

**Needed:**
- [ ] Create `src/lib/ssrf.ts` with:
  - Domain allowlist
  - Private IP range blocking (127.0.0.1, 10.0.0.0/8, etc.)
  - Timeout limits (3–10s)
  - Response size limits
- [ ] Use this for any future URL fetching

#### 8.5 PII Redaction in Logs (Missing)
**Current:**
- Structured logging with request context
- BUT: No automatic redaction of secrets/PII

**Needed:**
- [ ] Add log redaction middleware:
  - Redact `Authorization` header
  - Redact `password`, `token`, `secret` fields
  - Hash email addresses in logs
  - Never log full addresses
- [ ] Update logger to auto-redact common PII fields

#### 8.6 Comprehensive Audit Logging (Incomplete)
**Current:**
- Admin audit log exists but not all actions logged
- No user audit log for sensitive actions

**Needed:**
- [ ] Log ALL admin actions:
  - Payout adjustments
  - Dispute rulings
  - Refunds/credits changes
  - Role changes
  - Account disablements
- [ ] Add user audit log for:
  - Password changes
  - Payment method updates
  - Profile changes (especially payout/bank info)

#### 8.7 Rate Limiting Enhancements (Needs Abuse Detection)
**Current:**
- Route-class limits exist
- BUT: No abuse pattern detection

**Needed:**
- [ ] Add suspicious pattern flags:
  - Repeated failed logins (same IP/user)
  - High-frequency booking attempts
  - Repeated disputes filed
- [ ] IP-based cooldowns for password reset
- [ ] User-based throttles for authenticated endpoints

#### 8.8 File Upload Hardening (Needs More Validation)
**Current:**
- MIME type validation
- BUT: Missing some checks

**Needed:**
- [ ] Max file size enforcement (10MB)
- [ ] EXIF data stripping (privacy)
- [ ] Virus scanning (optional, plan for later)
- [ ] Signed URL TTL limits

#### 8.9 Dependency Security (Needs Monitoring)
**Current:**
- `package-lock.json` exists
- BUT: No automated dependency scanning

**Needed:**
- [ ] Enable Dependabot (GitHub)
- [ ] Add `npm audit` to CI
- [ ] Remove unused packages

#### 8.10 Security Testing (Missing)
**Current:**
- Unit/integration tests exist
- BUT: No security-specific tests

**Needed:**
- [ ] Add security test suite:
  - Auth ownership tests
  - Forbidden access tests
  - Webhook signature tests
  - Rate limit tests
  - SQL injection attempt tests

---

## Priority Recommendations

### **CRITICAL (Do Now)**
1. **PII Redaction in Logs** — Prevent data leakage
2. **Ownership Check Audit** — Ensure all resource reads enforce ownership
3. **JWT Token Hardening** — Short-lived tokens + invalidation on password change

### **IMPORTANT (Should Have Soon)**
4. **Comprehensive Audit Logging** — Log all admin actions + user sensitive actions
5. **SSRF Protection** — Create utility for future URL fetching
6. **SQL Injection Hardening** — Whitelist ORDER BY fields

### **NICE-TO-HAVE (Can Wait)**
7. **Abuse Detection** — Pattern-based rate limiting
8. **File Upload Hardening** — EXIF stripping, size limits
9. **Security Test Suite** — Automated security tests
10. **Dependency Monitoring** — Dependabot + npm audit in CI

---

## Implementation Checklist

### Phase 1: Critical Fixes (1–2 days)
- [ ] Add PII redaction to logger
- [ ] Audit all routes for missing ownership checks
- [ ] Implement JWT token invalidation on password change
- [ ] Shorten JWT expiration (15m access + refresh token)

### Phase 2: Important Hardening (2–3 days)
- [ ] Complete admin audit logging (all actions)
- [ ] Add user audit log for sensitive actions
- [ ] Create SSRF protection utility
- [ ] Whitelist ORDER BY fields

### Phase 3: Enhancements (1–2 days)
- [ ] Add abuse detection to rate limiting
- [ ] Enhance file upload validation
- [ ] Add security test suite
- [ ] Enable Dependabot

---

## Summary

**Current Status:** Strong foundation (80% complete)

**Strengths:**
- Excellent security headers and CORS
- Comprehensive input validation
- Webhook security properly implemented
- File uploads use secure presigned URL flow

**Gaps:**
- PII redaction in logs (critical)
- JWT token lifecycle management (important)
- Complete audit logging coverage (important)
- SSRF protection (preventive)

**Recommendation:** Focus on **Critical** items first (PII redaction, ownership checks, JWT hardening), then move to **Important** items. The codebase already has a solid security foundation.
