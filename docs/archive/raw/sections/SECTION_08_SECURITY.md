# Section 8 — Security Hardening (Beyond Auth) (Full Runbook)

**Objective:** Harden against injection, SSRF, auth/token abuse, webhook forgery/replay, CORS misconfig, rate-limit bypass, PII leakage, privilege escalation, insecure admin tooling, unsafe file uploads.

**Exit condition:** Strong baseline security posture: least privilege, strict validation, safe outbound calls, audited changes, minimal data exposure by default.

---

## 8.1 Trust Boundaries

| Zone | Examples |
|------|----------|
| **Untrusted** | Public internet clients (web/mobile) |
| **Semi-trusted** | Authenticated users (still untrusted input) |
| **Trusted-but-verify** | Third-party webhooks (Stripe/Twilio/SendGrid) |
| **Internal** | Workers, cron, internal tools |
| **Admin** | Highest-risk surface |

**Rule:** All data crossing a boundary must be validated and logged safely.

---

## 8.2 Input Validation & Sanitization

- Zod (or equivalent) on params/query/body; strict schemas (no .passthrough() unless justified).  
- **Injection prevention:** Whitelist sortable fields; whitelist filter keys; never interpolate raw SQL; sanitize LIKE patterns to avoid runaway %...% scans.

---

## 8.3 JWT Token Security

- Short-lived access tokens (e.g. 15m–1h); optional refresh strategy.  
- Invalidate on: password change, role change, suspicious activity.  
- **Claims:** sub (user id), role, iat, exp; optional token_version, jti.

---

## 8.4 Authorization & Ownership

- **Ownership checks:** Client can only see their jobs; cleaner only assigned jobs; admin sees all but actions audited.  
- **Admin:** requireRole('admin'); additional audit logging; optional IP allowlist later.

---

## 8.5 CORS & Security Headers

- **CORS:** Allow only known frontend domains; no wildcard * if credentials; specific methods/headers.  
- **Headers:** X-Content-Type-Options: nosniff; X-Frame-Options or CSP frame-ancestors; HSTS (if HTTPS); referrer-policy; remove powered-by.

---

## 8.6 Rate Limiting & Brute Force

- Route-class limits: login/auth very strict; password reset strict + cooldown; search moderate; admin strict; webhooks moderate.  
- **Abuse detection:** IP-based throttles; user-based for authenticated; suspicious patterns (repeated failed logins, high-frequency booking attempts, repeated disputes).

---

## 8.7 Webhook Security

- Raw body signature verification; reject invalid with 400; log verification failures (without leaking payload).  
- Replay protection: unique event IDs; reject duplicates safely (idempotent); optionally reject stale timestamps.  
- /api/webhooks/* mounted before JSON parsing; no JWT on webhook routes; provider-specific rate limits.

---

## 8.8 SSRF & Outbound Request Safety

- **Outbound allowlist:** Outbound HTTP must be allowlisted by domain; block private IPs (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, metadata IPs).  
- **Timeouts and size:** Short timeouts (3–10s); max response size; no redirects unless controlled.

---

## 8.9 File Upload Security (Photos)

- **Preferred:** Client uploads to storage via signed URL; backend validates metadata and links record; backend does not proxy large uploads.  
- **Validation:** MIME allowlist (jpg/png/heic); max size (e.g. 10MB); optional virus scan later; strip EXIF location (privacy).  
- **Storage:** Files private by default; access via signed URLs (short TTL); strict object naming per job.

---

## 8.10 Logging & PII Protection

- **Never log:** Authorization header, cookies, tokens, provider keys, passwords.  
- **PII minimization:** Define PII fields (email, phone, address, payment identifiers); logs store hashed identifiers where possible; never log full addresses; avoid logging message bodies.  
- **Structured redaction:** Centralized logger that auto-redacts common fields; consistent format; requestId/correlationId.

---

## 8.11 Admin Audit Logging

- **Mandatory:** who (admin id), when, what (action type), target entity, before/after (where safe), reason, request id.  
- **Actions:** payout adjustments, dispute rulings, refunds/credits changes, role changes, account disablements.  
- **Rule:** No action can execute without a reason string.

---

## 8.12 Dependency & Supply Chain

- Lockfile required; dependabot or equivalent; monitor high severity advisories.  
- Remove unused packages.

---

## 8.13 Security Testing

- **Automated:** Auth ownership tests; forbidden access tests; webhook signature tests; rate limit tests.  
- **Manual:** Attempt access to other user’s jobs; admin routes as non-admin; webhook without signature; large file upload.

---

## 8.14 Done Checklist

- [ ] Validation enforced everywhere  
- [ ] Ownership checks for all resource reads/writes  
- [ ] Strict CORS allowlist and proper headers  
- [ ] Route-class rate limiting implemented  
- [ ] Webhooks signature validated and replay protected  
- [ ] SSRF protections for outbound HTTP  
- [ ] Secure upload flow for photos (or plan locked)  
- [ ] Logging redaction and PII minimization in place  
- [ ] Admin audit log implemented  
- [ ] Dependency monitoring enabled  
- [ ] Security test suite includes key abuse cases  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 8 checklist.
