# Phase 2 — Auth Consistency & Route Protection — Status

**Purpose:** Track Phase 2 (Section 2) progress.  
**Runbook:** [SECTION_02_AUTH.md](../sections/SECTION_02_AUTH.md). **Artifact:** [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md).

---

## Current state

| Area | Status | Notes |
|------|--------|-------|
| **Canonical auth** | ✅ | `src/middleware/authCanonical.ts`: `requireAuth`, `requireRole`, `requireAdmin`, `requireClient`, `requireCleaner`, `requireSuperAdmin`. |
| **req.user contract** | ✅ | `AuthedRequest.user`: `{ id, role, email? }`; `AuthedRole` = UserRole \| "super_admin". See authCanonical. |
| **Route Protection Table** | ✅ | [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md) — inventory; all routes migrated. |
| **Webhook isolation** | ✅ | `/stripe/webhook` gets raw body in `src/index.ts`; Stripe/n8n use signature only (no JWT). |
| **Legacy auth** | Deprecated | `src/middleware/auth.ts` (route middleware) deprecated; CI blocks imports from routes. |
| **Routes using authCanonical** | ✅ Complete | All route files use `requireAuth` / `requireRole` / `requireAdmin` / `requireSuperAdmin` from authCanonical. |
| **Routes still using jwtAuth** | None | Migration complete. `jwtAuth.ts` and `adminAuth.ts` remain only for middleware unit tests. |

---

## Phase 2 — COMPLETE

1. ✅ **Migrate all routes** — All route files use authCanonical.
2. ✅ **ROUTE_PROTECTION_TABLE** — Complete; matches code.
3. ✅ **Auth smoke tests:** Unit: `authCanonical.test.ts`. Integration: `protected-route-auth.test.ts` (no token → 401; invalid token → 401; valid token → 200).
4. ✅ **CI:** Legacy auth import check in `.github/workflows/security-scan.yml`.

---

## Links

- [HARDENING_EXECUTION_PLAN.md](../HARDENING_EXECUTION_PLAN.md) — Phase 7 (Phase 2)
- [SECTION_02_AUTH.md](../sections/SECTION_02_AUTH.md) — Runbook
- [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md) — Route inventory

**Last updated:** 2026-01-31
