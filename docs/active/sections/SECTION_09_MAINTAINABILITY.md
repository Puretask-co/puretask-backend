# Section 9 — Maintainability & Velocity (Full Runbook)

**Objective:** Codebase is easier to understand, harder to break, faster to change, safer to operate, friendly to multiple contributors.

**Exit condition:** New dev can onboard quickly; changes are isolated; tests catch regressions; shipping features doesn’t cause slow collapse into chaos.

---

## 9.1 Target Project Structure

```
src/routes/          (thin)
src/controllers/     (HTTP → domain mapping)
src/services/        (business rules)
src/repositories/    (DB access)
src/domain/          (types, state machines, invariants)
src/lib/             (shared utilities)
src/middleware/      (auth, validation, errors)
src/workers/         (background jobs)
src/integrations/    (stripe, sendgrid, twilio, onesignal, n8n)
src/config/          (env validation, runtime config)
```

**Rule:** Routes don’t talk directly to DB; routes → controllers/services → repositories.

---

## 9.2 Route Thinness

- A route handler does only: validate input, call controller/service, return response.  
- No business logic; no DB queries in route handlers.

---

## 9.3 Code Consistency

- **Response helpers:** ok(res, data), created(res, data), error(res, code, message, details).  
- **Logging:** requestId/correlationId always present; structured logs; no console.log.  
- **Validation wrapper:** validateBody(schema), validateQuery(schema), validateParams(schema).

---

## 9.4 Refactor Priorities

| Priority | Focus |
|----------|--------|
| **A** | Central error handler; standard validation wrappers; standard auth wrappers; consolidate integration clients |
| **B** | Break up oversized route files; remove duplicate routers/imports; normalize naming |
| **C** | Extract state machines into domain/; create repositories; add job queue abstraction consistency |

**Rule:** Refactor in small, reviewable PRs; no big bang; system always deployable; each PR includes tests or smoke verification.

---

## 9.5 Testing Strategy

- **One** test framework (Jest or Vitest).  
- **Unit:** Pure functions, state machines, idempotency logic, edge case parsing/validation.  
- **Integration:** DB + repository tests; key workflows (booking, payment event processing, job completion, escrow release, payout creation).  
- **Contract:** Endpoint request validation, response shape, error codes, auth/role enforcement.  

**Rule:** Prioritize tests that protect money and state transitions.

---

## 9.6 Deterministic Test Environment

- Ephemeral Postgres in CI (container).  
- Migrations applied from scratch.  
- Seeded test data.  
- No tests rely on developer local state.

---

## 9.7 Lint, Format, Type Discipline

- **TypeScript:** Strict mode; eliminate any creep; shared domain types.  
- **ESLint + Prettier:** Uniform formatting; import sorting; no unused vars; no floating promises; no explicit console.log.  
- **Dangerous patterns banned:** Legacy auth import (Section 2); direct DB access from routes; raw SQL string interpolation.

---

## 9.8 Required Docs

- README.md (how to run)  
- ARCHITECTURE.md (layering rules)  
- CONTRIBUTING.md (PR rules, lint/test)  
- RUNBOOK.md (how to diagnose issues)  
- API.md or OpenAPI link (Section 7)  

Docs must be brief, practical, and updated with code changes.

---

## 9.9 PR & Release Discipline

- **PR template:** What changed; why; test evidence; rollback notes (if risky); migration notes (if DB).  
- **Release checklist:** CI green; migrations safe; smoke tests pass; critical endpoints checked.

---

## 9.10 Observability for Developers

- requestId in every response; structured logs link errors to requestId; track durations per endpoint; log slow queries (without PII).  
- Dashboards: error rate by route; p95 latency; queue backlog; webhook failure rate.

---

## 9.11 Done Checklist

- [ ] Project structure standardized (routes/controllers/services/repos)  
- [ ] Routes thin and consistent  
- [ ] Validation, auth, errors use shared wrappers  
- [ ] Single test framework chosen  
- [ ] Test pyramid implemented with focus on money/state  
- [ ] Strict TS + lint + formatting enforced  
- [ ] Dangerous patterns banned via lint/CI  
- [ ] Developer docs exist and are useful  
- [ ] PR and release discipline in place  
- [ ] Observability supports fast debugging  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 9 checklist.
