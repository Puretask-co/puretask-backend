# Contributing to PureTask Backend

Thank you for contributing to PureTask Backend! This guide will help you understand our development process and standards.

**What it is:** A guide for new contributors and maintainers (setup, code standards, how to submit changes).  
**What it does:** Describes how to set up the repo, what patterns we use, and how to open a PR.  
**How we use it:** Follow Development Setup when cloning; follow Code Standards when writing code; follow the PR steps when submitting changes.

**What this doc is for:** New contributors and maintainers. It covers: (1) how to set up the repo (clone, env, migrate, run), (2) code standards (TypeScript, formatting, route pattern, error handling), and (3) how to submit changes (branch, PR, review). Each section explains **what to do** and **why we do it that way**.

**Why it matters:** Consistent setup and patterns reduce bugs and review time. Follow this so your PRs align with the rest of the codebase.

---

## New here? Key terms (plain English)

**What it is:** A glossary of backend/DevOps terms used in this doc.  
**What it does:** Lets new readers understand Sentry, Migration, CI/CD, etc.  
**How we use it:** Refer to this table when you see an unfamiliar term below.

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

## Development Setup

**What it is:** Steps to clone, install, configure env, and run the app locally.  
**What it does:** Gets a new contributor from zero to a running dev environment.  
**How we use it:** Follow in order when cloning the repo; use .env.example for required vars.

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

**What it is:** Rules for TypeScript, formatting, project structure, and route handlers.  
**What it does:** Keeps the codebase consistent so lint and CI pass and reviews are predictable.  
**How we use it:** Apply when writing or reviewing code; many rules are enforced by ESLint and CI.

**What this section is for:** Rules for TypeScript, formatting, project structure, and route handlers. Lint and CI enforce many of these; the rest are review expectations.

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

### Integration Clients
- **Stripe**: Use `stripe` from `src/integrations/stripe.ts`
- **SendGrid**: Use `getSendGridClient()` from `src/integrations/sendgrid.ts`
- **Twilio**: Use `twilioClient` from `src/integrations/twilio.ts`
- **n8n**: Use exports from `src/integrations/n8n.ts`

## Pull Request Process

### Before Submitting
1. **Run linting**: `npm run lint`
2. **Run formatting**: `npm run format`
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

**What it is:** Conventions for commit message format (feat, fix, refactor, docs).  
**What it does:** Keeps git history readable and consistent.  
**How we use it:** Use the prefix and format when committing; follow examples.

Use clear, descriptive commit messages:
- `feat: add idempotency support for job creation`
- `fix: resolve token invalidation on password change`
- `refactor: consolidate Stripe client to integrations/`
- `docs: add CONTRIBUTING.md`

## Security

- **Never commit secrets**: Use `.env` files (gitignored)
- **Pre-commit hooks**: Secret scanning runs automatically
- **Review sensitive changes**: Get approval for security-related PRs

## Questions?

**What it is:** Where to look for answers (ARCHITECTURE, API_DOCUMENTATION) and how to ask for help.  
**What it does:** Points contributors to the right docs and encourages opening issues.  
**How we use it:** Check linked docs first; open an issue for questions or suggestions.

- Check `docs/active/ARCHITECTURE.md` for system design
- Check `docs/active/API_DOCUMENTATION.md` for API details
- Open an issue for questions or suggestions
