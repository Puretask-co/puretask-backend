# Section 7 — API Design, Contracts & Client Safety (Full Runbook)

**Objective:** API is consistent (same patterns everywhere), validated (bad input never reaches business logic), versionable (safe evolution), documented (contracts discoverable), safe for mobile/web and automation (n8n/agents).

**Exit condition:** Any client integration can be built against contracts with confidence; breaking changes are prevented or managed cleanly.

---

## 7.1 Canonical API Structure

- **Base path:** /api (or /api/v1).  
- **Resource-based:** /api/jobs, /api/bookings, /api/users, /api/payments, /api/disputes.  
- **Separate:** /api/admin/*, /api/webhooks/* (no JWT; signature-based).  

**Rule:** Public API ≠ admin API ≠ webhook API; they never share routes or assumptions.

---

## 7.2 HTTP Method Semantics

| Method | Use |
|--------|-----|
| GET | Read only (no side effects) |
| POST | Create or action |
| PATCH | Partial update |
| PUT | Full replace (rare) |
| DELETE | Soft delete preferred |

**Rule:** If a route changes state, it must be POST/PATCH/DELETE.

---

## 7.3 Contract-First (DTOs)

- Each endpoint has: **Request DTO** (body/query/params), **Response DTO**, **Error DTO**.  
- Never return raw DB rows; always map DB → API response shape.

---

## 7.4 Request Validation

- Every endpoint validates params, query, body **before** service logic.  
- **Rule:** No route handler touches req.body without validation.  
- Validation failure → 400 with structured error list (which fields, what failed, expected format).

---

## 7.5 Canonical Error Format

All errors return the same shape:

- **error.code** (machine-friendly): VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR  
- **error.message** (human-friendly)  
- **error.details** (optional)  
- **requestId** (always)  

**Rule:** No raw stack traces; no random “message only” responses.

---

## 7.6 Status Code Discipline

| Code | Use |
|------|-----|
| 200/201 | success |
| 400 | validation |
| 401 | unauthenticated |
| 403 | unauthorized |
| 404 | not found |
| 409 | conflict (idempotency, duplicates) |
| 422 | domain rule violated (optional) |
| 429 | rate limited |
| 500 | internal |

---

## 7.7 Idempotency & Client Safety

- Risky actions (book job, release escrow, request payout, create payment intent) support **Idempotency-Key** header (client-provided) or deterministic server key.  
- Same idempotency key seen again → return prior result.  
- **Optimistic concurrency:** For updates, use updated_at or version; client sends it back; server rejects if stale (409 conflict).

---

## 7.8 API Versioning

- **Recommended:** /api/v1 in URL (simple, obvious).  
- **Backwards compatibility:** Do not remove fields without version bump; adding fields is safe; don’t change meaning silently; deprecations have a timeline (e.g. 30–90 days).

---

## 7.9 Pagination, Filtering, Sorting

- **Pagination:** limit + **cursor** (preferred over offset); return items + nextCursor.  
- **Filtering/sorting:** status=..., sort=created_at:desc, from=.../to=....  
- Never invent custom query params per route; use one standard.

---

## 7.10 Rate Limits & Abuse Protection

- Different limits by route class: auth stricter; search medium; admin strict; webhooks signature-only but still limited.  
- Rate limit response: 429, retry-after header, error code RATE_LIMITED.

---

## 7.11 OpenAPI & Endpoint Catalog

- **OpenAPI spec:** Generated from DTO schemas or maintained in openapi.yaml; includes auth methods, request/response schemas, error schemas, examples.  
- **Endpoint catalog (human-readable):** Purpose, auth requirements, role access, key side effects, idempotency behavior.

---

## 7.12 Integration Safety (n8n / AI agents)

- Event schemas versioned; changes additive where possible; include event.version.  
- Outbound webhooks: signed, retryable, logged (delivery_log), idempotent consumer guidance.

---

## 7.13 Testing & Compatibility Gates

- **Contract tests:** Validate schema outputs, error formats, pagination stable.  
- **Backward compatibility:** When changing response, ensure previous fields still exist in v1; deprecations tracked.

---

## 7.14 Done Checklist

- [ ] Canonical route structure established  
- [ ] DTOs exist for all endpoints  
- [ ] Validation enforced for params/query/body everywhere  
- [ ] Single consistent error format  
- [ ] Status code discipline applied  
- [ ] Idempotency supported for risky operations  
- [ ] Versioning strategy chosen and documented  
- [ ] Pagination/filter/sort conventions standardized  
- [ ] OpenAPI documentation exists and matches reality  
- [ ] Contract tests implemented  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 7 checklist.
