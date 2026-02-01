# PureTask Backend Architecture

**What it is:** The high-level summary of our backend architecture (layers, rules, structure).  
**What it does:** Describes how the codebase is organized (routes → services → DB/integrations) and what is allowed or forbidden.  
**How we use it:** Read this first; use Architecture Principles and Layering Rules when adding or changing code.

---

## Overview

PureTask Backend is a Node.js/TypeScript API built with Express, PostgreSQL, and various third-party integrations. This document outlines the architectural patterns, layering rules, and design decisions.

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between routes, services, and data access
2. **Single Responsibility**: Each module has one clear purpose
3. **Dependency Injection**: Services receive dependencies, not global state
4. **Fail Fast**: Validate early, fail clearly
5. **Observability**: Structured logging, request IDs, error tracking

## Project Structure

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

### Routes Layer (`src/routes/`)
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
**Purpose**: Express middleware

**Key Middleware:**
- `authCanonical.ts` - JWT authentication (`requireAuth`, `requireRole`)
- `requestContext.ts` - Request ID generation
- `validation.ts` - Input validation (re-exported from lib)

## Data Flow

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

### Authentication
- **JWT-based**: Tokens in `Authorization: Bearer <token>` header
- **Middleware**: `requireAuth` from `src/middleware/authCanonical.ts`
- **Token Lifecycle**: Versioned tokens, invalidation on password/role change

### Authorization
- **Role-based**: `requireAdmin`, `requireClient`, `requireCleaner`
- **Ownership checks**: Use `ensureOwnership()` from `src/lib/ownership.ts`
- **Admin bypass**: Admins can access all resources

## Error Handling

### Error Flow
1. Route handler throws error (or service throws)
2. `asyncHandler()` catches it
3. `sendError()` formats response
4. Error includes `requestId` for tracing

### Error Format
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

### Pattern
- Services use `query()` or `withTransaction()` from `src/db/client.ts`
- Always use parameterized queries: `query('SELECT * FROM users WHERE id = $1', [userId])`
- Never use template literals in SQL (banned by ESLint)

### Transactions
```typescript
await withTransaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  // Auto-commits on success, rolls back on error
});
```

## Background Jobs

### Job Queue
- Database-backed queue (`job_queue` table)
- Idempotency keys prevent duplicates
- Dead-letter queue for failed jobs
- Lock recovery for stuck jobs

### Workers
- Located in `src/workers/`
- Run via `npm run worker:<name>`
- Use `runWorkerWithLock()` to prevent concurrent runs

## External Integrations

### Stripe
- Client: `stripe` from `src/integrations/stripe.ts`
- Webhook secret: `getStripeWebhookSecret()`
- Used for: Payments, payouts, refunds

### SendGrid
- Client: `getSendGridClient()` from `src/integrations/sendgrid.ts`
- From email: `getSendGridFromEmail()`
- Used for: Email notifications

### Twilio
- Client: `twilioClient` from `src/integrations/twilio.ts`
- From number: `getTwilioFromNumber()`
- Used for: SMS notifications

### n8n
- Client: Exports from `src/integrations/n8n.ts`
- Used for: Automation workflows

## State Machines

### Job Lifecycle
- Defined in `src/state/jobStateMachine.ts`
- Enforces valid state transitions
- Prevents invalid operations

## Testing Strategy

### Test Pyramid
- **Unit tests**: Pure functions, utilities, state machines
- **Integration tests**: Services + database, workflows
- **Smoke tests**: Critical endpoints, happy paths

### Test Framework
- **Jest**: Standardized (Vitest removed)
- **Location**: `src/tests/`
- **Run**: `npm test`

## Security

### Authentication
- JWT tokens with expiration
- Token versioning for bulk invalidation
- Role-based access control

### Input Validation
- Zod schemas for all inputs
- Sanitization for user-generated content
- SQL injection prevention (parameterized queries)

### Secrets
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
- Errors include `requestId`
- Stack traces in logs (not responses)
- Error codes for client handling

## Deployment

### Environment
- Railway.app for hosting
- Neon PostgreSQL for database
- Environment variables in Railway dashboard

### Build Process
1. `npm ci` - Clean install
2. `npm run build` - TypeScript compilation
3. `npm start` - Run server

### Migrations
- Located in `DB/migrations/`
- Applied manually or via CI
- Tracked in `migrations` table

## Future Considerations

### Potential Additions
- **Repository Layer**: Abstract database access further
- **Controller Layer**: Extract HTTP → domain mapping
- **Event Bus**: Decouple services via events
- **Caching Layer**: Redis for frequently accessed data

### Current Limitations
- No repository layer (services call DB directly)
- No controller layer (routes call services directly)
- Some large route files (could be split)

## Questions?

- See `docs/active/API_DOCUMENTATION.md` for API details
- See `docs/active/CONTRIBUTING.md` for development guidelines
- See `docs/active/SECURITY_GUARDRAILS.md` for security practices
