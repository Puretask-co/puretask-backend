# Section 2 — Auth Consistency & Route Protection (Full Runbook)

**Objective:** Every route protected by a single, correct, production-safe auth model with explicit authorization.

**Exit condition:** No mutating or sensitive route can accidentally bypass auth, rely on legacy auth, or behave differently in dev vs prod.

---

## 2.1 Problem Definition

- **Multiple auth mechanisms:** Legacy header-based (dev-only) and JWT (production).  
- **Risk:** Routes that import legacy auth will 401 or fail in production.  
- **Fix:** JWT-only; legacy removed from all route usage.

---

## 2.2 Canonical Auth Model

- **Authentication:** Verifies identity; attaches `req.user`.  
- **Authorization:** Verifies permissions/role (e.g. requireRole).  
- **Context enrichment:** Optional tenant/org/cleaner/client context.

**Canonical middleware:** `src/middleware/authCanonical.ts` — `requireAuth`, `requireRole(role | roles[])`, `requireAdmin`, `requireClient`, `requireCleaner`, `optionalAuth` (read-only routes only).  
**Backwards compat:** `src/middleware/jwtAuth.ts` — `jwtAuthMiddleware`, `optionalJwtAuth`; new routes should use authCanonical.  
**Deprecated:** `src/middleware/auth.ts` (route middleware); no route may import it. CI blocks it.

---

## 2.3 Route Classification

Every route must fall into exactly one category:

| Category | Auth | Examples |
|----------|------|----------|
| **A) Public** | None | Health, auth/login, Stripe webhooks, public metadata |
| **B) Authenticated** | Any logged-in user | Profile reads, account settings |
| **C) Role-restricted** | requireAuth + requireRole | Cleaner-only, client-only, admin-only |
| **D) Internal / System** | Signature / provider auth | Webhooks, cron, n8n events |

---

## 2.4 Route Protection Table (Deliverable)

**Canonical table:** [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md) — build and maintain there.

Example shape:

| Route | Method | Category | Auth Required | Role(s) | Notes |
|-------|--------|----------|--------------|---------|------|
| /jobs/:id/complete | POST | Role | yes | cleaner | mutating |
| /admin/users | GET | Role | yes | admin | sensitive |
| /stripe/webhook | POST | Internal | signature | — | no JWT |
| /health | GET | Public | no | — | — |

**Rule:** If a route is not in the canonical table, it does not exist.

---

## 2.5 Enforcement Rules

- **Mutating route rule:** Any route that creates/updates/deletes or triggers side effects MUST require auth.  
- **Role clarity:** If role matters, it must be explicit in the route definition (requireRole).  
- **No soft auth in prod:** No `if (process.env.NODE_ENV !== 'production')` bypasses; prod behavior == dev behavior.

---

## 2.6 Webhook Auth (Special Case)

- Webhook routes must **NOT** require JWT.  
- They must require: verified signature + explicit provider allowlist.  
- Mount under `/webhooks/*` (or equivalent); mount **before** JWT middleware; own security logic.

---

## 2.7 req.user Contract

Standard shape (all authenticated routes):

```ts
req.user = {
  id: string;
  role: 'client' | 'cleaner' | 'admin' | 'system';
  orgId?: string;
  permissions?: string[];
}
```

No route invents its own user shape.

---

## 2.8 Auth Failure Behavior

| Scenario | Status | Meaning |
|----------|--------|---------|
| No token | 401 | unauthenticated |
| Invalid token | 401 | unauthenticated |
| Wrong role | 403 | forbidden |
| Expired token | 401 | re-auth required |

No silent failures; no mixed semantics.

---

## 2.9 Tooling

- **Static:** ESLint or code search — fail build if legacy auth is imported.  
- **Central export:** Only allowed auth imports from `src/middleware/auth` (or equivalent).  
- **Optional:** Runtime assertion if route is hit without expected auth context.

---

## 2.10 Done Checklist

- [ ] Legacy auth removed from all routes  
- [ ] Every route in Route Protection Table  
- [ ] All mutating routes use requireAuth  
- [ ] All role-sensitive routes use requireRole  
- [ ] Webhooks isolated and secured correctly  
- [ ] req.user shape consistent everywhere  
- [ ] Dev and prod behavior identical  
- [ ] Build fails if legacy auth reintroduced  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 2 checklist. [ROUTE_PROTECTION_TABLE.md](../ROUTE_PROTECTION_TABLE.md) if it exists.
