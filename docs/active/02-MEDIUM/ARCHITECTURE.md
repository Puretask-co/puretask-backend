# PureTask Backend Architecture

## Overview

**What it is:** The high-level summary of our backend architecture (layers, rules, structure).  
**What it does:** Describes how the codebase is organized (routes → services → DB/integrations) and what is allowed or forbidden.  
**How we use it:** Read this first; use Architecture Principles and Layering Rules when adding or changing code.

PureTask Backend is a Node.js/TypeScript API built with Express, PostgreSQL, and various third-party integrations. This document outlines the architectural patterns, layering rules, and design decisions.

**What this doc is for:** Use it when you need to (1) understand how the codebase is structured (routes → services → DB/integrations), (2) follow layering rules (no DB in routes, no direct Stripe in routes), or (3) onboard new developers. Each section explains **what the layer does**, **what is allowed**, and **what is forbidden**.

**Why it matters:** Consistent structure and rules reduce bugs and review time. New contributors can trace a request from route to service to DB and know where to add code.

**In plain English:** The codebase is split into layers: routes handle HTTP (thin), services do the real work (business logic), and we talk to the database and Stripe/SendGrid from services, not from routes. This doc explains those layers and the rules (e.g. "no database calls in routes") so everyone puts new code in the right place.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between routes, services, and data access
2. **Single Responsibility**: Each module has one clear purpose
3. **Dependency Injection**: Services receive dependencies, not global state
4. **Fail Fast**: Validate early, fail clearly
5. **Observability**: Structured logging, request IDs, error tracking

## Project Structure

**What it is:** The directory layout of the backend (routes, services, lib, middleware, integrations, workers, etc.).  
**What it does:** Shows where to find and where to add code.  
**How we use it:** Put HTTP handling in routes, business logic in services, shared utilities in lib; follow the tree below.

```
src/
├── routes/          # HTTP route handlers (thin)
├── services/        # Business logic and orchestration
├── lib/             # Shared utilities (auth, validation, logging, etc.)
├── middleware/      # Express middleware (auth, validation, errors)
├── integrations/    # External service clients (Stripe, SendGrid, Twilio, n8n)
├── workers/         # Background job workers
├── config/          # Configuration (env validation)
├── types/           # TypeScript type definitions
└── state/           # State machines (job lifecycle)
```

## Layering Rules

**What it is:** Rules for each layer (routes, services, integrations, lib, middleware) — what is allowed and forbidden.  
**What it does:** Keeps HTTP in routes, business logic in services, and DB/integrations out of routes.  
**How we use it:** When adding code, put it in the correct layer; follow the rules below so reviews and debugging stay simple.

### Routes Layer (`src/routes/`)
**What it is:** The HTTP entry point: validate input, call services, return responses.  
**What it does:** Keeps routes thin so business logic and DB live in services.  
**How we use it:** Use requireAuth, validateBody/Query/Params, asyncHandler, sendSuccess/sendError; no DB or Stripe/SendGrid calls in routes.

**Purpose**: HTTP request/response handling

**Rules:**
- ✅ Validate input (use `validateBody()`, `validateQuery()`, `validateParams()`)
- ✅ Call services
- ✅ Return responses (use `sendSuccess()`, `sendCreated()`, `sendError()`)
- ✅ Use `asyncHandler()` wrapper for error handling
- ❌ No business logic
- ❌ No direct database access
- ❌ No inline try/catch (let `asyncHandler` handle it)

**Example:**
```typescript
router.post(
  "/jobs",
  requireAuth,
  validateBody(createJobSchema),
  asyncHandler(async (req, res) => {
    const job = await createJob(req.body);
    sendCreated(res, { job });
  })
);
```

### Services Layer (`src/services/`)
**What it is:** Where business logic and orchestration live; calls DB and integrations.  
**What it does:** Contains the real work so routes stay thin.  
**How we use it:** Put all business logic here; use query() and withTransaction(); call Stripe/SendGrid from services, not routes.

**Purpose**: Business logic and orchestration

**Rules:**
- ✅ Contain business logic
- ✅ Orchestrate multiple operations
- ✅ Access database via `query()` from `src/db/client.ts`
- ✅ Use transactions for multi-step operations
- ✅ Call integrations (Stripe, SendGrid, etc.)
- ❌ No HTTP-specific code
- ❌ No Express types (`Request`, `Response`)

**Example:**
```typescript
export async function createJob(input: CreateJobInput): Promise<Job> {
  // Business logic
  // Database access
  // Integration calls
  return job;
}
```

### Integrations Layer (`src/integrations/`)
**What it is:** External service clients (Stripe, SendGrid, Twilio, n8n) initialized once.  
**What it does:** Centralizes API clients so we don't duplicate or misconfigure them.  
**How we use it:** Import from integrations in services; never in routes; use circuit breakers and retries (see ERROR_RECOVERY_CIRCUIT_BREAKERS).

**Purpose**: External service clients

**Rules:**
- ✅ Initialize clients once (singletons)
- ✅ Export typed interfaces
- ✅ Handle client initialization errors
- ✅ Log initialization status

**Current Integrations:**
- `stripe.ts` - Stripe payment client
- `sendgrid.ts` - SendGrid email client
- `twilio.ts` - Twilio SMS client
- `n8n.ts` - n8n automation client

### Lib Layer (`src/lib/`)
**What it is:** Shared utilities (auth, errors, logger, validation, response, queue, security).  
**What it does:** Provides reusable code so routes and services don't duplicate logic.  
**How we use it:** Import from lib in routes and services; add new shared helpers here.

**Purpose**: Shared utilities

**Key Modules:**
- `auth.ts` - JWT token management
- `errors.ts` - Error handling, `asyncHandler`, `sendError`
- `logger.ts` - Structured logging
- `validation.ts` - Zod validation middleware
- `response.ts` - Response helpers (`sendSuccess`, `sendCreated`)
- `queue.ts` - Job queue abstraction
- `security.ts` - Rate limiting, sanitization

### Middleware Layer (`src/middleware/`)
**What it is:** Express middleware (auth, request context, validation).  
**What it does:** Runs before route handlers (auth, request ID, validation).  
**How we use it:** Use requireAuth from authCanonical only; add new middleware here when needed.

**Purpose**: Express middleware

**Key Middleware:**
- `authCanonical.ts` - JWT authentication (`requireAuth`, `requireRole`)
- `requestContext.ts` - Request ID generation
- `validation.ts` - Input validation (re-exported from lib)

## Data Flow

**What it is:** The path a request takes: HTTP → middleware → route → service → DB → response.  
**What it does:** Shows how layers connect so we know where to add or debug code.  
**How we use it:** Trace a request through the diagram below when debugging or onboarding.

```
HTTP Request
  ↓
Middleware (auth, validation, request context)
  ↓
Route Handler (thin, uses asyncHandler)
  ↓
Service (business logic)
  ↓
Database (via query() or withTransaction())
  ↓
Response (via sendSuccess/sendError)
```

## Authentication & Authorization

**What it is:** How we identify users (JWT) and enforce access (requireAuth, requireRole).  
**What it does:** Ensures only authenticated/authorized users reach protected routes.  
**How we use it:** Use requireAuth on protected routes; use requireRole when role matters; keep JWT_SECRET in env.

### Authentication
**What it is:** JWT-based identity (token in Authorization header).  
**What it does:** Tells us who is making the request.  
**How we use it:** Middleware validates token and attaches user to request; use requireAuth from authCanonical.
- **JWT-based**: Tokens in `Authorization: Bearer <token>` header
- **Middleware**: `requireAuth` from `src/middleware/authCanonical.ts`
- **Token Lifecycle**: Versioned tokens, invalidation on password/role change

### Authorization
**What it is:** Role-based access (e.g. client vs cleaner vs admin).  
**What it does:** Restricts actions by role.  
**How we use it:** Use requireRole when a route is role-specific; check req.user.role in services if needed.
- **Role-based**: `requireAdmin`, `requireClient`, `requireCleaner`
- **Ownership checks**: Use `ensureOwnership()` from `src/lib/ownership.ts`
- **Admin bypass**: Admins can access all resources

## Error Handling

**What it is:** How we handle errors (asyncHandler, sendError, AppError).  
**What it does:** Ensures consistent error format and no leaked stack traces in production.  
**How we use it:** Wrap route handlers in asyncHandler; throw AppError or use sendError; log full details server-side.

### Error Flow
**What it is:** The path an error takes from service to client response.  
**What it does:** Ensures errors are caught and returned in a standard shape.  
**How we use it:** Errors bubble to asyncHandler or error middleware; sendError formats the response.
1. Route handler throws error (or service throws)
2. `asyncHandler()` catches it
3. `sendError()` formats response
4. Error includes `requestId` for tracing

### Error Format
**What it is:** The JSON shape we return for errors (code, message, optional details).  
**What it does:** Gives clients a stable structure for handling errors.  
**How we use it:** Use sendError(res, code, message); never expose stack traces in production responses.
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... },
    "requestId": "req_abc123"
  }
}
```

## Database Access

**What it is:** How we talk to the DB (query(), withTransaction()) and where it's allowed.  
**What it does:** Keeps DB access in services only; uses parameterized queries for safety.  
**How we use it:** Use query() from src/db/client.ts in services; use withTransaction() for multi-step ops; never in routes.

### Pattern
**What it is:** The rule that only services call the DB via query() or withTransaction().  
**What it does:** Prevents routes from touching the DB directly.  
**How we use it:** All DB calls go through src/db/client.ts; use parameterized queries only.
- Services use `query()` or `withTransaction()` from `src/db/client.ts`
- Always use parameterized queries: `query('SELECT * FROM users WHERE id = $1', [userId])`
- Never use template literals in SQL (banned by ESLint)

### Transactions
**What it is:** Multi-step DB ops wrapped in a transaction so they commit or roll back together.  
**What it does:** Keeps data consistent when we do several writes.  
**How we use it:** Use withTransaction() from db client when a service does multiple writes that must succeed or fail together.
```typescript
await withTransaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  // Auto-commits on success, rolls back on error
});
```

## Background Jobs

**What it is:** Async work (job queue, workers) that runs outside the request cycle.  
**What it does:** Handles long-running or scheduled tasks without blocking HTTP.  
**How we use it:** Enqueue jobs from services; workers process the queue; use idempotency keys and lock recovery (see WORKER_HARDENING).

### Job Queue
**What it is:** The queue we use to enqueue jobs (e.g. calendar sync, notifications).  
**What it does:** Decouples "trigger" from "do the work" so requests stay fast.  
**How we use it:** Use enqueue() from lib/queue with idempotency keys; workers consume the queue.
- Database-backed queue (`job_queue` table)
- Idempotency keys prevent duplicates
- Dead-letter queue for failed jobs
- Lock recovery for stuck jobs

### Workers
**What it is:** Processes that consume the job queue and run the actual work.  
**What it does:** Executes background tasks (sync, notifications, payouts) without blocking the API.  
**How we use it:** Workers run in src/workers/; use scheduler for cron; ensure idempotency and lock recovery.
- Located in `src/workers/`
- Run via `npm run worker:<name>`
- Use `runWorkerWithLock()` to prevent concurrent runs

## External Integrations

**What it is:** Third-party services we call (Stripe, SendGrid, Twilio, n8n).  
**What it does:** Handles payments, email, SMS, and workflow automation.  
**How we use it:** Call from services only; use circuit breakers and retries (see ERROR_RECOVERY_CIRCUIT_BREAKERS); keep keys in env.

### Stripe
**What it is:** Our payment provider; we use the Stripe SDK wrapped with circuit breaker.  
**What it does:** Processes payments and webhooks.  
**How we use it:** All Stripe calls go through stripeWrapper or payment service; never in routes.
- Client: `stripe` from `src/integrations/stripe.ts`
- Webhook secret: `getStripeWebhookSecret()`
- Used for: Payments, payouts, refunds

### SendGrid
- Client: `getSendGridClient()` from `src/integrations/sendgrid.ts`
- From email: `getSendGridFromEmail()`
- Used for: Email notifications

### Twilio
**What it is:** Our SMS provider; we use Twilio API wrapped with circuit breaker.  
**What it does:** Sends SMS.  
**How we use it:** All SMS goes through notification service/Twilio provider; never in routes.
- Client: `twilioClient` from `src/integrations/twilio.ts`
- From number: `getTwilioFromNumber()`
- Used for: SMS notifications

### n8n
**What it is:** Our workflow/automation service; we send events to n8n webhook.  
**What it does:** Triggers n8n workflows (e.g. notifications, integrations).  
**How we use it:** All n8n calls go through n8nClient; never in routes; see N8N_EVENT_ROUTER.
- Client: Exports from `src/integrations/n8n.ts`
- Used for: Automation workflows

## State Machines

**What it is:** State machines we use (e.g. job lifecycle) to model multi-step flows.  
**What it does:** Ensures valid transitions and consistent state.  
**How we use it:** Job state lives in src/state/ or equivalent; transitions are validated before update.

### Job Lifecycle
**What it is:** The states a job can be in and allowed transitions.  
**What it does:** Prevents invalid state changes (e.g. completed → pending).  
**How we use it:** Use transition() or equivalent when updating job status; validate transition before DB update.
- Defined in `src/state/jobStateMachine.ts`
- Enforces valid state transitions
- Prevents invalid operations

## Testing Strategy

### Test Pyramid
- **Unit tests**: Pure functions, utilities, state machines
- **Integration tests**: Services + database, workflows
- **Smoke tests**: Critical endpoints, happy paths

### Test Framework
**What it is:** Jest (or similar) for running tests.  
**What it does:** Runs unit and integration tests in CI.  
**How we use it:** Run `npm test`; use Jest config in package.json; add tests in src/tests/.
- **Jest**: Standardized (Vitest removed)
- **Location**: `src/tests/`
- **Run**: `npm test`

## Security

**What it is:** How we handle auth, validation, and secrets in the codebase.  
**What it does:** Reduces risk of unauthorized access, injection, and secret leaks.  
**How we use it:** Use requireAuth; validate input; keep secrets in env; see SECURITY_GUARDRAILS and SECURITY_AUDIT_SUMMARY.

### Authentication
**What it is:** JWT-based auth; only requireAuth from authCanonical.  
**What it does:** Ensures only authenticated users reach protected routes.  
**How we use it:** Apply requireAuth to protected routes; never use legacy auth middleware.
- JWT tokens with expiration
- Token versioning for bulk invalidation
- Role-based access control

### Input Validation
- Zod schemas for all inputs
- Sanitization for user-generated content
- SQL injection prevention (parameterized queries)

### Secrets
**What it is:** API keys, DB URL, JWT secret — stored in env, never in code.  
**What it does:** Prevents secret leaks via repo or logs.  
**How we use it:** Store in Railway/env; use .env.example as template; see SECURITY_GUARDRAILS.
- Environment variables only (no hardcoded secrets)
- Pre-commit hooks scan for secrets
- CI scans for secrets

## Observability

### Logging
- Structured JSON logs
- Request ID in all logs
- PII redaction (passwords, tokens, emails)
- Log levels: `info`, `warn`, `error`, `debug`

### Error Tracking
**What it is:** Sentry (or similar) for capturing errors and stack traces.  
**What it does:** Surfaces production errors so we can fix them.  
**How we use it:** Sentry is initialized in instrument.ts; errors are captured automatically; see MONITORING_SETUP.
- Errors include `requestId`
- Stack traces in logs (not responses)
- Error codes for client handling

## Deployment

### Environment
- Railway.app for hosting
- Neon PostgreSQL for database
- Environment variables in Railway dashboard

### Build Process
**What it is:** Compiling TypeScript and producing a runnable artifact.  
**What it does:** Produces dist/ (or equivalent) for production.  
**How we use it:** Run `npm run build`; start with `node -r ./dist/instrument.js ./dist/index.js` (or npm start).
1. `npm ci` - Clean install
2. `npm run build` - TypeScript compilation
3. `npm start` - Run server

### Migrations
- Located in `DB/migrations/`
- Applied manually or via CI
- Tracked in `migrations` table

## Future Considerations

**What it is:** Possible future work (new features, tech choices).  
**What it does:** Captures ideas so we don't forget them.  
**How we use it:** Prioritize when capacity allows; use ADRs for major decisions.

### Potential Additions
**What it is:** Features or tech we might add later.  
**What it does:** Documents options for future planning.  
**How we use it:** Reference when planning roadmap or ADRs.
- **Repository Layer**: Abstract database access further
- **Controller Layer**: Extract HTTP → domain mapping
- **Event Bus**: Decouple services via events
- **Caching Layer**: Redis for frequently accessed data

### Current Limitations
- No repository layer (services call DB directly)
- No controller layer (routes call services directly)
- Some large route files (could be split)

## Questions?

**What it is:** Open questions or decisions the team should resolve.  
**What it does:** Surfaces unknowns so we can decide or document.  
**How we use it:** Use when planning or in ADRs; update when resolved.

- See `docs/active/API_DOCUMENTATION.md` for API details
- See `docs/active/CONTRIBUTING.md` for development guidelines
- See `docs/active/SECURITY_GUARDRAILS.md` for security practices
