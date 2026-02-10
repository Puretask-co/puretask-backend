# PureTask Backend API Documentation

## Base URL
```
Development: http://localhost:4000
Production: https://api.puretask.com
```

## Authentication

### JWT Token (Recommended)
Include in header:
```
Authorization: Bearer <token>
```

### Legacy Headers (Development Only)
```
x-user-id: <user-uuid>
x-user-role: client | cleaner | admin
```

---

## Auth Routes

### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "MinimumPassword8",
  "fullName": "John Doe",
  "role": "client",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "client",
    "status": "active",
    "walletCreditsBalance": 0,
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "accessToken": "jwt-token",
  "expiresIn": 604800
}
```

### POST /auth/login
Login and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "user": { ... },
  "accessToken": "jwt-token",
  "expiresIn": 604800
}
```

### GET /auth/me
Get current authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "client",
    "walletCreditsBalance": 100,
    "tier": "standard",
    "avgRating": 4.8,
    "jobsCompleted": 5
  }
}
```

### PATCH /auth/me
Update user profile.

**Request:**
```json
{
  "fullName": "Jane Doe",
  "phone": "+1987654321"
}
```

### POST /auth/change-password
Change password.

**Request:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password-8-chars"
}
```

### POST /auth/forgot-password
Request password reset.

**Request:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
Reset password with token.

**Request:**
```json
{
  "token": "reset-token",
  "newPassword": "new-password-8-chars"
}
```

---

## Jobs Routes

### POST /jobs
Create a new job (client only).

**Request:**
```json
{
  "scheduled_start_at": "2025-01-15T09:00:00Z",
  "scheduled_end_at": "2025-01-15T12:00:00Z",
  "estimated_hours": 3,
  "cleaning_type": "basic",
  "base_rate_cph": 25,
  "addon_rate_cph": 0,
  "total_rate_cph": 25
}
```

### GET /jobs
List jobs for current user.

### GET /jobs/:jobId
Get job details.

### PATCH /jobs/:jobId
Update job (client, limited fields).

### DELETE /jobs/:jobId
Cancel job.

### POST /jobs/:jobId/transition
Transition job state.

**Request:**
```json
{
  "event_type": "job_accepted",
  "payload": {}
}
```

**Valid event types:**
- `job_requested`
- `job_accepted`
- `cleaner_en_route`
- `job_started`
- `job_completed`
- `client_approved`
- `client_disputed`
- `dispute_resolved`
- `job_cancelled`

---

## Credits Routes

### GET /credits/packages
Get available credit packages.

**Response:**
```json
{
  "packages": [
    { "id": "credits_50", "credits": 50, "priceUsd": 50, "popular": false },
    { "id": "credits_100", "credits": 100, "priceUsd": 95, "popular": true },
    { "id": "credits_200", "credits": 200, "priceUsd": 180, "popular": false },
    { "id": "credits_500", "credits": 500, "priceUsd": 425, "popular": false }
  ]
}
```

### GET /credits/balance
Get current credit balance.

### POST /credits/checkout
Create Stripe checkout session.

**Request:**
```json
{
  "packageId": "credits_100",
  "successUrl": "https://app.puretask.com/credits/success",
  "cancelUrl": "https://app.puretask.com/credits"
}
```

**Response:**
```json
{
  "sessionId": "cs_xxx",
  "url": "https://checkout.stripe.com/..."
}
```

### GET /credits/history
Get credit transaction history.

---

## Cleaner Routes

### GET /cleaner/profile
Get cleaner profile and stats.

### PATCH /cleaner/profile
Update cleaner profile.

**Request:**
```json
{
  "baseRateCph": 30,
  "deepAddonCph": 10,
  "moveoutAddonCph": 15,
  "bio": "Professional cleaner with 5 years experience"
}
```

### POST /cleaner/stripe/connect
Start Stripe Connect onboarding.

**Response:**
```json
{
  "accountId": "acct_xxx",
  "onboardingUrl": "https://connect.stripe.com/..."
}
```

### GET /cleaner/stripe/status
Get Stripe Connect status.

**Response:**
```json
{
  "hasAccount": true,
  "accountId": "acct_xxx",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "onboardingComplete": true
}
```

### GET /cleaner/stripe/dashboard
Get Stripe Express dashboard link.

### GET /cleaner/availability
Get availability schedule.

### PUT /cleaner/availability
Update availability schedule.

**Request:**
```json
{
  "monday": [{ "start": "09:00", "end": "17:00" }],
  "tuesday": [{ "start": "09:00", "end": "17:00" }],
  "wednesday": [],
  "thursday": [{ "start": "10:00", "end": "14:00" }, { "start": "16:00", "end": "20:00" }]
}
```

### GET /cleaner/payouts
Get payout history.

---

## Photos Routes

### GET /photos/job/:jobId
Get photos for a job.

**Query params:** `type=before|after` (optional)

### POST /photos/job/:jobId
Add photo to job.

**Request:**
```json
{
  "photoUrl": "https://storage.puretask.com/photos/xxx.jpg",
  "type": "before"
}
```

### POST /photos/job/:jobId/upload-url
Get presigned upload URL.

**Request:**
```json
{
  "type": "before",
  "contentType": "image/jpeg"
}
```

### DELETE /photos/:photoId
Delete a photo.

---

## Messages Routes

### GET /messages/unread
Get total unread count.

### GET /messages/unread/by-job
Get unread count by job.

### GET /messages/conversations
Get recent conversations.

### GET /messages/job/:jobId
Get messages for a job.

### POST /messages/job/:jobId
Send a message.

**Request:**
```json
{
  "body": "Hello! I'm on my way.",
  "receiverId": "user-uuid"
}
```

### POST /messages/job/:jobId/read
Mark messages as read.

---

## Admin Routes

### GET /admin/jobs
List all jobs with filters.

**Query params:**
- `status` - Filter by status
- `date_from` / `date_to` - Date range
- `limit` / `offset` - Pagination

### GET /admin/jobs/:jobId/events
Get job event history.

### POST /admin/jobs/:jobId/override
Override job state (admin only).

### GET /admin/kpis
Get platform KPIs.

### GET /admin/disputes
List open disputes.

### POST /admin/disputes/:jobId/resolve
Resolve a dispute.

---

## Stripe Routes

### POST /stripe/create-payment-intent
Create payment intent for a job.

### POST /stripe/webhook
Stripe webhook endpoint (signature verified).

---

## Events Routes

### POST /events
Ingest external events (n8n, etc).

**Headers:** `x-n8n-secret: <secret>`

**Request:**
```json
{
  "job_id": "uuid",
  "event_type": "check_in",
  "meta": { "note": "Arrived on site" }
}
```

---

## Health Routes

### GET /health
Basic health check.

**Response:**
```json
{ "ok": true }
```

### GET /health/db
Database connectivity check.

---

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "request-id-for-debugging"
  }
}
```

**Common error codes:**
- `UNAUTHENTICATED` (401) - Missing or invalid auth
- `FORBIDDEN` (403) - Not allowed for this role
- `NOT_FOUND` (404) - Resource not found
- `VALIDATION_ERROR` (400) - Invalid request body
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_SERVER_ERROR` (500) - Server error

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| `/auth/*` | 10 requests / 15 min (per IP) |
| `/jobs/*` | 100 requests / min |
| `/credits/*` | 100 requests / min |
| `/cleaner/*` | 100 requests / min |
| `/photos/*` | 100 requests / min |
| `/messages/*` | 100 requests / min |

Rate limit headers:
- `X-RateLimit-Limit` - Max requests
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

