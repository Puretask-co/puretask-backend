# Phase 7 — API Design & Client Safety — Status

**Purpose:** Track Phase 7 (Section 7) progress.  
**Runbook:** [SECTION_07_API.md](../sections/SECTION_07_API.md).

---

## Current state

| Item | Status | Notes |
|------|--------|------|
| **Route structure** | Partial | Routes at /health, /auth, /jobs, /admin, /stripe, etc.; not yet under /api/v1. |
| **DTOs** | Partial | Types in places; raw DB rows still returned in some routes. Map DB → API shape per runbook. |
| **Validation** | Partial | Zod in lib/validation and some routes; not every handler validates before use. |
| **Error format** | ✅ | ErrorCode enum; error.code, error.message, error.details; sendError in errors.ts. |
| **Response helpers** | ✅ | sendSuccess, sendCreated, sendNoContent in src/lib/response.ts; requestId on response. |
| **Idempotency-Key** | Partial | Payment/payout use idempotency; header-based Idempotency-Key on risky POSTs to be enforced. |
| **API versioning** | ⏳ | No /api/v1 prefix yet. |
| **Pagination** | Partial | sendPaginatedSuccess exists; standard cursor/limit/sort across all list endpoints to be applied. |
| **OpenAPI** | ✅ | Swagger at /api-docs (src/config/swagger). |
| **Contract tests** | Partial | Some integration tests; contract tests per route schema to expand. |

---

## Links

- [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 7
- [SECTION_07_API.md](../sections/SECTION_07_API.md)
- [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md)

**Last updated:** 2026-01-31
