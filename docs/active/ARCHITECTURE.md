# PureTask Backend — Architecture

**Purpose:** High-level structure and key flows for maintainability (Section 9).  
**See also:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md), [CONTRIBUTING.md](./CONTRIBUTING.md), runbooks in [sections/](./sections/).

---

## 1. Stack

- **Runtime:** Node.js 20+, TypeScript
- **API:** Express
- **DB:** PostgreSQL (Neon); access via `src/db/client.ts` (pool, query, withTransaction)
- **Auth:** JWT; canonical middleware in `src/middleware/authCanonical.ts` (requireAuth, requireRole, requireAdmin, requireSuperAdmin)
- **Payments:** Stripe (Connect, Payment Intents, webhooks)
- **Workers:** ts-node scripts; scheduler in `src/workers/scheduler.ts`; durable jobs in `src/workers/durableJobWorker.ts`

---

## 2. Layering (target)

| Layer | Role | Location |
|-------|------|----------|
| **Routes** | Thin: validate input, call service, return response | `src/routes/` |
| **Services** | Business logic, orchestration | `src/services/` |
| **Repositories / DB** | Queries, transactions | `src/db/`, services that use pool |
| **Middleware** | Auth, validation, context, security | `src/middleware/`, `src/lib/` |
| **Workers** | Background jobs, crons | `src/workers/` |

**Rule:** Routes do not talk to the DB directly; they call services. Validation uses Zod and `validateBody` / `validateQuery` / `validateParams` from `src/lib/validation.ts`.

---

## 3. Key flows

- **Auth:** Request → authMiddlewareAttachUser (optional JWT) → route → requireAuth/requireRole → service.
- **Webhooks:** Stripe webhook → raw body → signature check → `webhook_events` insert (idempotent) → handleStripeEvent → 200.
- **Payments:** Payment intents and ledger updates via `paymentService` / `payoutsService`; state machine in [PAYMENT_STATE_MACHINE.md](./sections/PAYMENT_STATE_MACHINE.md).
- **Background work:** Cron or scheduler invokes workers; Section 6 durable jobs: enqueue via `durableJobService.enqueue`, process via `durableJobWorker` (claim → handler → complete/fail).

---

## 4. Security

- **CORS:** Allowlist in `src/index.ts` (no wildcard with credentials).
- **Headers:** Helmet + custom security middleware.
- **Rate limiting:** Per-route / global via `src/lib/security.ts` and optional Redis.
- **Secrets:** Env only; validated at startup in `src/config/env.ts`. See [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md).

---

## 5. Docs and runbooks

- **Checklist:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phases:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Runbooks:** [sections/SECTION_*.md](./sections/)
- **DB:** [DB/migrations/README.md](../DB/migrations/README.md), [DB/docs/INDEX_MAP.md](../DB/docs/INDEX_MAP.md)

---

**Last updated:** 2026-01-31
