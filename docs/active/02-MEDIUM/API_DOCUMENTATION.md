# API Documentation Guide

## Overview

**What it is:** The high-level summary of how we document the API (Swagger UI and OpenAPI).  
**What it does:** Describes where to find and how to use API docs.  
**How we use it:** Read this first; use Accessing Documentation and the sections below to open Swagger or OpenAPI and add/update docs.

PureTask Backend API documentation is available via Swagger UI and OpenAPI specification.

**In plain English:** We describe our API in two ways: (1) a web page where you can try every endpoint and see request/response shapes (Swagger UI at `/api-docs`), and (2) a machine-readable file (OpenAPI at `/api-docs/json`) that other tools (Postman, code generators) can use. This doc explains how to open and use both.

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

## Accessing Documentation

### Swagger UI
**URL**: `http://localhost:4000/api-docs` (development)
**URL**: `https://api.puretask.com/api-docs` (production)

**Features**:
- Interactive API explorer
- Test endpoints directly
- View request/response schemas
- Authentication support

### OpenAPI Specification
**What it is:** Machine-readable API spec (JSON) for Postman, codegen, and other tools.  
**What it does:** Lets tools import our API without manual entry.  
**How we use it:** Import the URL below into Postman; use for SDK generation or API testing tools.

**URL**: `http://localhost:4000/api-docs/json`

**Usage**:
- Import into Postman
- Generate client SDKs
- API testing tools
- Documentation generators

## API Structure

**What it is:** Base URL and auth requirements for all endpoints.  
**What it does:** Tells clients where to send requests and how to authenticate.  
**How we use it:** Use Base URL for all requests; send Bearer token for protected endpoints.

### Base URL
**What it is:** The root URL for the API (dev vs production).  
**What it does:** Tells clients which host to call.  
**How we use it:** Use development URL locally; production URL in production.

- **Development**: `http://localhost:4000`
- **Production**: `https://api.puretask.com`

### Authentication
**What it is:** JWT Bearer token for protected endpoints.  
**What it does:** Identifies the user so the API can authorize requests.  
**How we use it:** POST /auth/login to get token; send `Authorization: Bearer <token>` on protected requests.

Most endpoints require JWT authentication:

```bash
# Get token
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token
curl -X GET http://localhost:4000/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Endpoint Categories

**What it is:** Grouped list of endpoints by area (auth, jobs, user, health, status).  
**What it does:** Shows what endpoints exist and what they do.  
**How we use it:** Find the category for your task; use API_EXACT_ENDPOINTS or Swagger for full req/res shapes.

### Authentication (`/auth`)
**What it is:** Endpoints for register, login, me, password.  
**What it does:** Handles user identity and session.  
**How we use it:** Use /auth/login to get token; /auth/me for current user.

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user
- `PUT /auth/password` - Update password

### Jobs (`/jobs`)
**What it is:** Endpoints for listing, creating, updating, and paying for jobs.  
**What it does:** Handles job lifecycle and payments.  
**How we use it:** Use /jobs for CRUD; /jobs/:id/pay for payment.

- `GET /jobs` - List jobs
- `POST /jobs` - Create job
- `GET /jobs/:id` - Get job details
- `PUT /jobs/:id` - Update job
- `DELETE /jobs/:id` - Delete job
- `POST /jobs/:id/pay` - Pay for job

### User Data (`/user`) - GDPR
**What it is:** Endpoints for data export, deletion, and consent (GDPR).  
**What it does:** Supports user data rights.  
**How we use it:** Use /user/data/export and DELETE /user/data for GDPR requests; see GDPR_COMPLIANCE.

- `GET /user/data/export` - Export user data
- `DELETE /user/data` - Delete user data
- `POST /user/consent` - Record consent
- `GET /user/consent/:type` - Get consent status

### Health (`/health`)
**What it is:** Endpoints for health and readiness checks.  
**What it does:** Lets load balancers and UptimeRobot check if the app is up.  
**How we use it:** Use /health for liveness; /health/ready for readiness (DB, etc.).

- `GET /health` - Health check
- `GET /health/ready` - Readiness check

### Status (`/status`)
**What it is:** Endpoint for operational status.  
**What it does:** Returns app status for dashboards or monitoring.  
**How we use it:** Call GET /status for status info.

- `GET /status` - Operational status

## Response Formats

**What it is:** The JSON shapes we return (success, error, rate limit).  
**What it does:** Tells clients what to expect so they can parse responses.  
**How we use it:** Use sendSuccess/sendError in code; clients check success and error shape.

### Success Response
**What it is:** Standard success shape (success: true, data, message).  
**What it does:** Consistent shape for successful responses.  
**How we use it:** Return this shape for 200/201; clients check success and use data.

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
**What it is:** Standard error shape (code, message, requestId, timestamp).  
**What it does:** Consistent shape for error responses.  
**How we use it:** Use sendError in code; clients check error.code and error.message.

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "requestId": "req-123",
    "timestamp": "2024-01-29T00:00:00.000Z"
  }
}
```

### Rate Limit Response
**What it is:** Response when rate limit is exceeded (429, retryAfter).  
**What it does:** Tells clients to slow down and when to retry.  
**How we use it:** Return 429 with retryAfter; clients back off and retry after delay.

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down.",
    "retryAfter": 900
  }
}
```

**Status**: `429 Too Many Requests`

## Rate Limits

**What it is:** How we limit requests (headers and limits per endpoint).  
**What it does:** Prevents abuse and keeps the API stable.  
**How we use it:** Apply rate limit middleware; see RATE_LIMITING for config.

### Headers
**What it is:** Response headers that show limit, remaining, and reset time.  
**What it does:** Lets clients know how many requests are left.  
**How we use it:** Clients can read X-RateLimit-* headers to throttle or show UX.

All responses include rate limit headers:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1706544000
```

### Limits
**What it is:** The actual limits (general API, auth endpoints).  
**What it does:** Defines how many requests per window are allowed.  
**How we use it:** Configure in rate limit middleware; see RATE_LIMITING.

- **General API**: 300 requests per 15 minutes per IP
- **Auth Endpoints**: 200 requests per 15 minutes per IP
- **Endpoint-Specific**: Varies by endpoint

## Error Codes

**What it is:** The error codes we return (auth, validation, rate limit, business).  
**What it does:** Lets clients handle errors by code.  
**How we use it:** Use consistent codes in sendError; document new codes here.

### Authentication
**What it is:** Error codes for auth failures (invalid credentials, token expired).  
**What it does:** Tells clients why auth failed.  
**How we use it:** Return these when login or token validation fails.
- `UNAUTHENTICATED` - Missing or invalid token
- `INVALID_TOKEN` - Token expired or invalid
- `INVALID_CREDENTIALS` - Wrong email/password

### Authorization
**What it is:** Error codes for permission failures.  
**What it does:** Tells clients why access was denied.  
**How we use it:** Return when user lacks role or permission.

- `FORBIDDEN` - Insufficient permissions
- `ROLE_REQUIRED` - Wrong user role

### Validation
**What it is:** Error codes for invalid input.  
**What it does:** Tells clients what was wrong with the request.  
**How we use it:** Return when body/query/params fail validation.

- `VALIDATION_ERROR` - Invalid input data
- `MISSING_REQUIRED_FIELD` - Required field missing

### Rate Limiting
**What it is:** Error code when rate limit is exceeded.  
**What it does:** Tells clients to slow down.  
**How we use it:** Return with 429 when limit is hit.

- `RATE_LIMIT_EXCEEDED` - Too many requests

### Business Logic
**What it is:** Error codes for business rule violations.  
**What it does:** Tells clients why the operation failed (e.g. job not found).  
**How we use it:** Return when business rules prevent the operation.

- `JOB_NOT_FOUND` - Job doesn't exist
- `JOB_NOT_CANCELLABLE` - Job can't be cancelled
- `INSUFFICIENT_CREDITS` - Not enough credits

## Adding Documentation

**What it is:** How to add or update API docs (Swagger comments and schema definitions).  
**What it does:** Keeps docs in sync with code.  
**How we use it:** Add @swagger comments to routes; add schema definitions to swagger config.

### Swagger Comments
**What it is:** JSDoc-style @swagger blocks in route handlers.  
**What it does:** Generates OpenAPI spec from code.  
**How we use it:** Add block above each route; run Swagger to regenerate spec.

Add to route handlers:

```typescript
/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: List jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 */
router.get("/", async (req, res) => {
  // ...
});
```

### Schema Definitions
**What it is:** Reusable schema definitions in Swagger config.  
**What it does:** Keeps request/response shapes DRY.  
**How we use it:** Define schemas in swagger config; reference with $ref in routes.

Add to `src/config/swagger.ts`:

```typescript
schemas: {
  Job: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: { type: 'string' },
      // ...
    },
  },
}
```

## Testing API

**What it is:** How to test the API (Swagger UI, cURL, Postman).  
**What it does:** Gives options for manual and automated testing.  
**How we use it:** Use Swagger for quick tries; cURL for scripts; Postman for collections.

### Using Swagger UI
**What it is:** Testing endpoints in the browser via /api-docs.  
**What it does:** Lets you try requests without writing code.  
**How we use it:** Open /api-docs; Authorize with token; try endpoints.
1. Open `/api-docs`
2. Click "Authorize"
3. Enter JWT token
4. Test endpoints interactively

### Using cURL
**What it is:** Testing with curl from the command line.  
**What it does:** Good for scripts and quick checks.  
**How we use it:** Use curl with -H "Authorization: Bearer <token>" for protected endpoints.
```bash
# Get token
TOKEN=$(curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token')

# Use token
curl -X GET http://localhost:4000/jobs \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman
**What it is:** Testing with Postman (import from OpenAPI).  
**What it does:** Good for collections and team sharing.  
**How we use it:** Import from /api-docs/json; use environment for BASE_URL and token.
1. Import OpenAPI spec (`/api-docs/json`)
2. Set up environment variables
3. Configure authentication
4. Test endpoints

## Versioning

**What it is:** How we version the API (current and future strategy).  
**What it does:** Tells clients what to expect when we change the API.  
**How we use it:** Document current version; plan versioning strategy for breaking changes.

### Current Version
**What it is:** The current API version (e.g. v1).  
**What it does:** Sets baseline for compatibility.  
**How we use it:** Document in OpenAPI info; use in URL or headers if we version.
- **API Version**: v1
- **OpenAPI Version**: 3.0.0

### Future Versions
**What it is:** How we plan to handle breaking changes (e.g. URL versioning).  
**What it does:** Reduces surprise when we change the API.  
**How we use it:** Document strategy (e.g. /v2 prefix); use changelog for changes.
- Use URL versioning: `/v2/jobs`
- Maintain backward compatibility
- Document breaking changes

## Best Practices

**What it is:** Do's and don'ts for API docs and usage.  
**What it does:** Keeps docs and usage consistent.  
**How we use it:** Follow when adding docs or building clients.

1. **Always Use HTTPS** in production
2. **Include Rate Limit Headers** in responses
3. **Use Consistent Error Format**
4. **Document All Endpoints**
5. **Version APIs** when making breaking changes

## Next Steps

**What it is:** Follow-up work (versioning, examples, more coverage).  
**What it does:** Captures ideas so we don't forget them.  
**How we use it:** Prioritize when capacity allows.

1. **Complete API Documentation**
   - Document all endpoints
   - Add request/response examples
   - Document error codes

2. **Generate Client SDKs**
   - Use OpenAPI generator
   - Support multiple languages
   - Publish to package registries

3. **API Versioning**
   - Plan versioning strategy
   - Document migration guides
   - Maintain backward compatibility
