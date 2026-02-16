# Contributing to PureTask Backend

Thank you for contributing to PureTask Backend! This guide will help you understand our development process and standards.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd puretask-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## Code Standards

### TypeScript
- **Strict mode**: Always enabled
- **No `any` types**: Use proper types or `unknown` with type guards
- **Type safety**: All functions must be typed

### Formatting
- **Prettier**: Run `npm run format` before committing
- **ESLint**: Run `npm run lint` to check for issues
- **Auto-fix**: Run `npm run lint:fix` to auto-fix issues

### Project Structure
- **Routes**: Thin handlers that validate → call services → return response
- **Services**: Business logic and orchestration
- **Lib**: Shared utilities
- **Middleware**: Auth, validation, error handling
- **Integrations**: External service clients (Stripe, SendGrid, Twilio, n8n)

### Route Handler Pattern
All route handlers should follow this pattern:

```typescript
import { asyncHandler, sendSuccess, sendError } from "../lib/errors";
import { validateBody } from "../lib/validation";

const schema = z.object({ ... });

router.post(
  "/endpoint",
  requireAuth, // or requireAdmin, requireRole, etc.
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const result = await serviceFunction(req.body);
    sendSuccess(res, { data: result });
  })
);
```

**Rules:**
- Use `asyncHandler()` wrapper (handles errors automatically)
- Use `validateBody()`/`validateQuery()` for validation
- Use `sendSuccess()`/`sendCreated()`/`sendError()` for responses
- No inline try/catch (let `asyncHandler` handle it)
- No direct DB access (use services)

### Error Handling
- Use `sendError()` from `src/lib/errors.ts`
- Errors automatically include `requestId`
- Use `AppError` class for custom errors
- Never expose internal errors to clients

### Logging
- Use `logger` from `src/lib/logger.ts`
- Never use `console.log` (banned by ESLint)
- Include `requestId` in logs (automatic via context)
- Log at appropriate levels: `info`, `warn`, `error`, `debug`

### Testing
- **Framework**: Jest (standardized)
- **Test structure**: `src/tests/unit/`, `src/tests/integration/`, `src/tests/smoke/`
- **Run tests**: `npm test`
- **Coverage**: Aim for 50%+ coverage on critical paths

### Database Access
- **Never** import `query` or `withTransaction` directly in routes
- **Always** use services for database access
- Services can use `query()` from `src/db/client.ts`
- Use parameterized queries (never template literals in SQL)

### Pagination
- **Offset pagination:** Use `LIMIT`/`OFFSET` with `page`/`limit` for low-cardinality lists.
- **Cursor pagination (preferred for high-cardinality):** Use `cursor` (e.g. `created_at` + `id`) and `limit`. Return `nextCursor` in response; omit when no more pages. Candidates: `/jobs` (list), `/admin/clients`, `/admin/cleaners`, `/admin/bookings`, `/messages/job/:jobId`.

### How to add a new route

1. Create or extend a router in `src/routes/` (e.g. `client.ts`, `jobs.ts`).
2. Use `requireAuth` (and `requireRole` if role-restricted).
3. Use `validateBody` / `validateQuery` / `validateParams` for input.
4. Use `asyncHandler` and call a service; return via `sendSuccess` / `sendError`.
5. Mount router in `src/index.ts` under `/api/v1/...`.
6. Add route to Route Protection Table (`docs/active/ROUTE_PROTECTION_TABLE.md`).

### How to add a new service

1. Create `src/services/yourService.ts`.
2. Import `query` or `withTransaction` from `src/db/client`.
3. Export pure business logic functions; no Express types.
4. Use parameterized queries (`$1`, `$2`, …); never SQL template literals.
5. Call from routes; do not call routes from services.

### How to add a new worker

1. Create worker in `src/workers/` (e.g. `v1-core/`, `v2-operations/`).
2. Export a `runX()` async function.
3. Register in `src/workers/workerHandlers.ts` (add to `registerWorkerHandlers`).
4. Add schedule to `WORKER_SCHEDULES` in `src/workers/scheduler.ts` (cron expression, description).
5. When `CRONS_ENQUEUE_ONLY=true`, scheduler enqueues; durable job worker runs handlers. Ensure handler is registered.

### Integration Clients
- **Stripe**: Use `stripe` from `src/integrations/stripe.ts`
- **SendGrid**: Use `getSendGridClient()` from `src/integrations/sendgrid.ts`
- **Twilio**: Use `twilioClient` from `src/integrations/twilio.ts`
- **n8n**: Use exports from `src/integrations/n8n.ts`

## Pull Request Process

### Before Submitting
1. **Run linting**: `npm run lint`
2. **Run formatting**: `npm run format` (or `npm run format:check` to verify)
3. **Run tests**: `npm test`
4. **Type check**: `npm run typecheck`

### PR Requirements
- [ ] All tests pass
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting is correct (`npm run format:check`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] No direct DB access in routes
- [ ] No `console.log` statements
- [ ] Error handling uses `asyncHandler()` and `sendError()`
- [ ] Documentation updated (if needed)

### PR Description Template
```markdown
## What Changed
- Brief description of changes

## Why
- Reason for the change

## Testing
- How to test the changes
- Test evidence (screenshots, logs, etc.)

## Migration Notes
- Database migrations (if any)
- Environment variable changes (if any)
- Breaking changes (if any)

## Rollback Plan
- How to rollback if needed
```

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add idempotency support for job creation`
- `fix: resolve token invalidation on password change`
- `refactor: consolidate Stripe client to integrations/`
- `docs: add CONTRIBUTING.md`

## Git Hooks (Phase 3 Guardrails)

Pre-commit hooks are in **`.githooks/`** so they can be versioned.

**Enable once per clone:**
```bash
git config core.hooksPath .githooks
```

**What the pre-commit hook does:**
- Blocks committing `.env`, `.env.production`, `.env.staging`, `.env.local`
- Runs `npm run lint` (commit fails if lint fails)
- Restricts new `.md` files to allowed doc paths (e.g. `docs/active/`, `docs/archive/`)

CI also runs secret scanning (Gitleaks), forbidden-file checks, and legacy-auth import checks. See `.github/workflows/security-scan.yml`.

## Branch Protection (recommended)

In **GitHub repo → Settings → Branches**, add a branch protection rule for `main` (and optionally `develop`):
- Require a pull request before merging
- Require status checks to pass (e.g. Lint & Type Check, Backend Tests, Security & Secret Scanning)
- Do not allow force-push to the protected branch

This ensures no secrets or broken code are merged without review.

## Security

- **Never commit secrets**: Use `.env` files (gitignored); secrets only in Railway or your vault
- **Pre-commit hooks**: Block .env commits and run lint; CI runs full secret scan
- **Review sensitive changes**: Get approval for security-related PRs

## Questions?

- Check `docs/active/ARCHITECTURE.md` for system design
- Check `docs/active/API_DOCUMENTATION.md` for API details
- Open an issue for questions or suggestions
