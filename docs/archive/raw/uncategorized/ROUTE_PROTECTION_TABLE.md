# Route Protection Table

**Last Updated**: 2025-01-15  
**Status**: In Progress - Migration to Canonical Auth

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

### ✅ Already Using Canonical Auth
- `/jobs` - uses `jwtAuthMiddleware`
- `/credits` - uses `jwtAuthMiddleware` + `requireRole`
- `/cleaner` - uses `jwtAuthMiddleware` + `requireRole`
- `/client` - uses `jwtAuthMiddleware` + `requireRole`
- `/admin/*` sub-routes - use `jwtAuthMiddleware`
- `/cleaner-ai-*` - use `jwtAuthMiddleware`
- `/message-history` - uses `jwtAuthMiddleware`
- `/gamification` - uses `jwtAuthMiddleware`
- `/photos` - uses `jwtAuthMiddleware`
- `/messages` - uses `jwtAuthMiddleware`
- `/pricing` - uses `jwtAuthMiddleware`

### 🔄 Needs Migration (Using Legacy authMiddleware)
- `/ai` - **MIGRATE TO**: `requireAuth`
- `/admin` (main router) - **MIGRATE TO**: `requireAuth` + `requireAdmin`
- `/stripe` (non-webhook routes) - **MIGRATE TO**: `requireAuth` + `requireClient`
- `/v2` - **MIGRATE TO**: `requireAuth`
- `/tracking` - **MIGRATE TO**: `requireAuth`
- `/reschedule` - **MIGRATE TO**: `requireAuth`
- `/scoring` - **MIGRATE TO**: `requireAuth`
- `/premium` - **MIGRATE TO**: `requireAuth`
- `/manager` - **MIGRATE TO**: `requireAuth` + `requireAdmin`
- `/matching` - **MIGRATE TO**: `requireAuth`
- `/assignment` - **MIGRATE TO**: `requireAuth`
- `/cancellation` - **MIGRATE TO**: `requireAuth`
- `/analytics` - **MIGRATE TO**: `requireAuth` + `requireAdmin`
- `/alerts` - **MIGRATE TO**: `requireAuth`
- `/search` - **MIGRATE TO**: `requireAuth` (wrong import currently)

### ✅ Webhooks (Correctly Isolated)
- `/stripe/webhook` - Uses Stripe signature verification (no JWT)
- `/n8n/events` - Uses n8n HMAC verification (no JWT)

### ✅ Public Routes (No Auth)
- `/health/*` - Public health checks
- `/auth/login` - Public login
- `/auth/register` - Public registration
- `/holidays/*` - Public holiday data

## Enforcement Rules

1. **All mutating routes MUST use `requireAuth`**
2. **All role-sensitive routes MUST use `requireRole`**
3. **Webhooks MUST use signature verification, NOT JWT**
4. **No route may use legacy `authMiddleware`**
5. **Dev and prod behavior MUST be identical**

## Next Steps

1. ✅ Create canonical auth middleware (`authCanonical.ts`)
2. 🔄 Migrate all routes to canonical auth
3. 🔄 Remove legacy auth from `jwtAuth.ts` (remove dev fallback)
4. 🔄 Deprecate `src/middleware/auth.ts` (legacy)
5. 🔄 Add ESLint rule to prevent legacy auth imports
6. 🔄 Update route protection table as migration progresses
