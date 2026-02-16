# Route Protection Table

**Last Updated**: 2026-01-31  
**Status**: Complete — All routes use canonical auth (authCanonical)

This table documents ALL routes and their authentication/authorization requirements.

## Legend

- **Category**: Public | Authenticated | Role-Restricted | Internal/System
- **Auth**: requireAuth | optionalAuth | none | signature
- **Role**: client | cleaner | admin | system | any

## Route Inventory

| Route | Method | Category | Auth Required | Role(s) | Mutating | Notes |
|-------|--------|----------|---------------|---------|----------|-------|
| `/health` | GET | Public | none | - | No | Health check |
| `/health/ready` | GET | Public | none | - | No | Readiness check |
| `/health/live` | GET | Public | none | - | No | Liveness check |
| `/auth/login` | POST | Public | none | - | No | Login endpoint |
| `/auth/register` | POST | Public | none | - | Yes | User registration |
| `/auth/logout` | POST | Authenticated | requireAuth | any | No | Logout |
| `/auth/refresh` | POST | Authenticated | requireAuth | any | No | Token refresh |
| `/stripe/webhook` | POST | Internal | signature | system | Yes | Stripe signature verification |
| `/n8n/events` | POST | Internal | signature | system | Yes | n8n HMAC verification |
| `/jobs` | GET | Authenticated | requireAuth | any | No | List jobs |
| `/jobs` | POST | Role-Restricted | requireAuth | client, admin | Yes | Create job |
| `/jobs/:id` | GET | Authenticated | requireAuth | any | No | Get job details |
| `/jobs/:id` | PATCH | Role-Restricted | requireAuth | client, cleaner, admin | Yes | Update job |
| `/jobs/:id/complete` | POST | Role-Restricted | requireAuth | cleaner, admin | Yes | Complete job |
| `/jobs/:id/cancel` | POST | Role-Restricted | requireAuth | client, cleaner, admin | Yes | Cancel job |
| `/cleaner/profile` | GET | Role-Restricted | requireAuth | cleaner, admin | No | Get cleaner profile |
| `/cleaner/profile` | PATCH | Role-Restricted | requireAuth | cleaner, admin | Yes | Update cleaner profile |
| `/client/profile` | GET | Role-Restricted | requireAuth | client, admin | No | Get client profile |
| `/client/profile` | PATCH | Role-Restricted | requireAuth | client, admin | Yes | Update client profile |
| `/admin/*` | * | Role-Restricted | requireAuth | admin | Varies | All admin routes |
| `/stripe/create-payment-intent` | POST | Role-Restricted | requireAuth | client, admin | Yes | Create payment intent |
| `/stripe/payment-intent/:jobId` | GET | Role-Restricted | requireAuth | client, admin | No | Get payment intent |
| `/credits/*` | * | Role-Restricted | requireAuth | client, admin | Varies | Credit management |
| `/messages/*` | * | Authenticated | requireAuth | any | Varies | Messaging |
| `/analytics/*` | * | Role-Restricted | requireAuth | admin | No | Analytics |
| `/search/*` | * | Authenticated | requireAuth | any | No | Search |
| `/tracking/*` | * | Authenticated | requireAuth | any | No | Job tracking |
| `/v2/*` | * | Authenticated | requireAuth | any | Varies | V2 features |
| `/ai/*` | * | Authenticated | requireAuth | any | Varies | AI assistant |
| `/premium/*` | * | Authenticated | requireAuth | any | Varies | Premium features |
| `/manager/*` | * | Role-Restricted | requireAuth | admin | Varies | Manager dashboard |
| `/assignment/*` | * | Authenticated | requireAuth | any | Varies | Job assignment |
| `/cancellation/*` | * | Authenticated | requireAuth | any | Yes | Cancellation |
| `/reschedule/*` | * | Authenticated | requireAuth | any | Yes | Rescheduling |
| `/scoring/*` | * | Authenticated | requireAuth | any | Varies | Scoring |
| `/matching/*` | * | Authenticated | requireAuth | any | Varies | Matching |
| `/pricing/*` | * | Authenticated | requireAuth | any | No | Pricing |
| `/photos/*` | * | Authenticated | requireAuth | any | Varies | Photo management |
| `/payments/*` | * | Role-Restricted | requireAuth | client, admin | Varies | Payment operations |
| `/notifications/*` | * | Authenticated | requireAuth | any | No | Notifications |
| `/alerts/*` | * | Authenticated | requireAuth | any | Varies | Alerts |
| `/status/*` | * | Authenticated | requireAuth | any | No | Status |
| `/holidays/*` | * | Public | optionalAuth | - | No | Holiday data |
| `/cleaner/onboarding/*` | * | Role-Restricted | requireAuth | cleaner, admin | Varies | Onboarding |
| `/cleaner/ai/*` | * | Role-Restricted | requireAuth | cleaner, admin | Varies | AI settings |
| `/cleaner/portal/*` | * | Role-Restricted | requireAuth | cleaner, admin | Varies | Cleaner portal |
| `/client/invoices/*` | * | Role-Restricted | requireAuth | client, admin | No | Invoice management |

## Migration Status

### ✅ All Routes Using Canonical Auth (authCanonical)
All route files now use `requireAuth`, `requireRole`, `requireAdmin`, `requireClient`, `requireCleaner`, or `requireSuperAdmin` from `src/middleware/authCanonical.ts`. No routes import `jwtAuthMiddleware` or `adminAuth`; `jwtAuth.ts` and `adminAuth.ts` remain only for middleware unit tests.

### ✅ Webhooks (Correctly Isolated)
- `/stripe/webhook` - Uses Stripe signature verification (no JWT)
- `/n8n/events` - Uses n8n HMAC verification (no JWT)

### ✅ Public Routes (No Auth)
- `/health/*` - Public health checks
- `/auth/login` - Public login
- `/auth/register` - Public registration
- `/holidays/*` - Public holiday data

## Ownership Verification (Resource-Level)

Beyond auth/role, routes that access resources by ID must ensure the user owns or is authorized for that resource. Ownership is enforced in **services**, not routes.

**Pattern:** Service fetches resource, compares `resource.client_id` or `resource.cleaner_id` (or equivalent) with `req.user.id`, throws 403 if mismatch. Example: `jobTrackingService.approveJob` checks `job.client_id === clientId`.

**High-priority routes to verify:** Jobs (`/jobs/:id`, PATCH/complete/cancel), messages (`/messages/job/:jobId`), photos (`/photos/job/:jobId`), tracking, payments, cancellation, reschedule, matching, v2 properties/teams. Admin routes are exempt (admin can access any resource).

**Audit status:** Pending systematic verification. Key services (jobTrackingService, jobsService) enforce ownership; others should be traced when adding features.

## Admin RBAC (Planned)

**Current state:** All admin routes use `requireAdmin` — single role, full access.

**Planned roles (future):**
- `admin` — Full access (current)
- `support_agent` — Read-only + resolve disputes, view risk; no credits, payouts, or config
- `support_lead` — support_agent + approve refunds, escalate disputes
- `ops_finance` — Payouts, credits, finance; no user suspension or config

**Implementation:** Add `requireAdminRole(roles: string[])` that checks `req.user.role` against allowed set. Extend `users.role` enum or add `users.admin_role` column. Document in ARCHITECTURE when implemented.

## Next Steps

1. ✅ Create canonical auth middleware (`authCanonical.ts`)
2. ✅ Migrate all routes to canonical auth
3. Optional: Remove or further deprecate `jwtAuth.ts` (kept for unit tests)
4. ✅ Deprecate `src/middleware/auth.ts` (legacy); CI blocks imports from routes
5. ✅ CI checks for legacy auth imports (`.github/workflows/security-scan.yml`)
6. ✅ Auth unit tests: `src/middleware/__tests__/authCanonical.test.ts` (requireAuth 401/next; requireRole 403/next)
