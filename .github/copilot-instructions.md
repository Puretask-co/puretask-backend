<!-- Copilot / AI agent instructions for quick onboarding into the PureTask backend -->
# PureTask Backend — Copilot Instructions

Purpose: give an AI coding agent the exact, discoverable knowledge to be immediately productive in this repository.

- **Entry point**: `src/index.ts` — app wiring, middleware, routes and server lifecycle. Inspect this first.
- **Main domains**: HTTP routes (`src/routes/*`), domain services (`src/services/*`), state machines (`src/state/*`), workers (`src/workers/*`), and DB migrations (`DB/migrations/*`).

- **Key patterns and gotchas**:
  - Request validation is done with `zod` inside route handlers — prefer using existing validators.
  - `requestContextMiddleware` adds `req.requestId` and enriches logs — keep this for observability.
  - Auth is currently simulated: code reads `x-user-role` and `x-user-id` headers (see `src/lib/auth`).
  - Stripe webhook route uses raw body parsing: `/stripe/webhook` must receive raw JSON for signature verification (see `src/index.ts`).
  - Feature lines (V2/V3/V4) are annotated in `src/index.ts` — feature gating is file-level for now.

- **Architecture (quick big picture)**:
  - Express API serves JSON endpoints; controllers call `src/services/*` which encapsulate business logic and side effects.
  - Persistent state: Postgres (Neon). Migrations live in `DB/migrations` and are applied by custom scripts (`scripts/run-migration.js`).
  - Background processing: many single-purpose worker scripts in `src/workers` that can be run via `npm run worker:<name>`.
  - Events: job lifecycle events are appended to `job_events` and emitted to `n8n` or other webhooks (see `src/services/jobEvents` and env vars).

- **Developer workflows / commands (copy-paste)**
  - Install: `npm install`
  - Dev: `npm run dev` (uses `ts-node-dev` and starts server on `PORT`)
  - Build: `npm run build` → `dist/`
  - Start (prod): `npm run start`
  - Run tests: `npm run test` (unit), `npm run test:integration`, `npm run test:smoke`, `npm run test:coverage`
  - Run a worker locally: `npm run worker:queue-processor` (or any `worker:*` script listed in `package.json`).
  - Migrations: `npm run migrate:run` (wraps `node scripts/run-migration.js`).
  - Docker: `docker build -t puretask-backend .` then `docker run -p 4000:4000 --env-file .env puretask-backend` or use `docker-compose up`.

- **Test environment notes** (critical)
  - `vitest.config.ts` forces sequential test execution (`singleFork`) due to Neon connection limits — do NOT enable heavy parallelization.
  - Tests set `RUNNING_TESTS=true` and import the Express app without starting the HTTP server.

- **Env & secrets** (important keys)
  - Required: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET` (see `ENV_EXAMPLE.md`).
  - Optional integrations: SendGrid, Twilio, OneSignal. If unset, respective functionality is skipped.

- **Where to look for domain logic / examples**
  - Job lifecycle flow: README references `src/state/jobStateMachine.ts` and `src/services/jobsService.ts`.
  - Routes list: `src/routes/*` (see `docs/ROUTES_CATALOG.md`). Use these to map HTTP surface to services.
  - Services catalog: `src/services/*` (see `docs/SERVICES_CATALOG.md`) — each service encapsulates DB access and side effects.

- **Integration points**
  - PostgreSQL (Neon) via `pg` and `@neondatabase/serverless`.
  - Stripe for payments/webhooks.
  - n8n for automation webhooks (`/n8n/events`).
  - Redis optional for queues/caching (docker-compose provides a redis service).

- **Code style & safety**
  - TypeScript + `tsc` type checks (`npm run typecheck`).
  - ESLint available (`npm run lint`).
  - Follow existing service patterns: keep business logic in `src/services`, keep route handlers thin.

- **When making PRs or edits**
  - Run `npm run typecheck` and `npm run test` locally.
  - If touching DB schema, add a migration under `DB/migrations` and update migration scripts.
  - Keep worker scripts idempotent — many run on schedules in production.

If any section here is unclear or you'd like the agent to include more examples (sample request/response shapes, exact zod schemas, specific service function signatures), tell me which files or endpoints to extract and I'll iterate. 
