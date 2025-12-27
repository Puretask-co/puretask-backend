# 📚 PureTask Backend API Reference

**Base URL**: `https://api.puretask.com` (production) or `http://localhost:4000` (development)

**Authentication**: Bearer token in `Authorization` header
```
Authorization: Bearer <jwt_token>
```

---

## 📑 Table of Contents

1. [Health & System](#health--system)
2. [Authentication](#authentication)
3. [Jobs](#jobs)
4. [Credits](#credits)
5. [Stripe & Payments](#stripe--payments)
6. [Cleaner Endpoints](#cleaner-endpoints)
7. [Scheduling (Reschedule & Cancel)](#scheduling)
8. [Matching](#matching)
9. [Scoring & Reliability](#scoring--reliability)
10. [Photos](#photos)
11. [Messages](#messages)
12. [Notifications](#notifications)
13. [Admin](#admin)
14. [Analytics](#analytics)
15. [Premium Features](#premium-features)
16. [V2 Features](#v2-features)

---

## Health & System

### GET /health
Check API and database health.

**Response:**
```json
{
  "ok": true,
  "db": "up",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Authentication

### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "client",  // "client" or "cleaner"
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "client"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "...", "role": "client" },
  "token": "jwt_token_here"
}
```

### POST /auth/refresh
Refresh JWT token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "token": "new_jwt_token"
}
```

### GET /auth/me
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "client",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Jobs

### POST /jobs
Create a new job (client only).

**Request Body:**
```json
{
  "scheduled_start_at": "2024-01-20T10:00:00Z",
  "scheduled_end_at": "2024-01-20T13:00:00Z",
  "address": "123 Main St, Sacramento, CA 95814",
  "latitude": 38.5816,
  "longitude": -121.4944,
  "credit_amount": 150,
  "cleaning_type": "standard",
  "client_notes": "Please focus on the kitchen"
}
```

**Response:**
```json
{
  "job": {
    "id": "uuid",
    "status": "requested",
    "client_id": "uuid",
    "cleaner_id": null,
    ...
  }
}
```

### GET /jobs
List jobs for current user.

**Query Parameters:**
- `status` - Filter by status
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "jobs": [...],
  "total": 25
}
```

### GET /jobs/:jobId
Get job details.

### PATCH /jobs/:jobId
Update job (client or admin).

**Request Body:**
```json
{
  "client_notes": "Updated instructions",
  "scheduled_start_at": "2024-01-20T11:00:00Z"
}
```

### DELETE /jobs/:jobId
Cancel/delete job.

### GET /jobs/:jobId/events
Get job event history.

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "job_created",
      "actor_type": "client",
      "payload": {},
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /jobs/:jobId/transition
Transition job to next status.

**Request Body:**
```json
{
  "event_type": "job_accepted",
  "payload": {}
}
```

**Valid Event Types:**
- `job_created`
- `job_accepted`
- `cleaner_on_my_way`
- `job_started`
- `job_completed`
- `client_approved`
- `client_disputed`
- `dispute_resolved_refund`
- `dispute_resolved_no_refund`
- `job_cancelled`

### POST /jobs/:jobId/pay
Process payment for job.

### GET /jobs/:jobId/pricing
Get pricing breakdown for job.

---

## Credits

### GET /credits/balance
Get current credit balance.

**Response:**
```json
{
  "balance": 500,
  "held": 150,
  "available": 350
}
```

### GET /credits/history
Get credit transaction history.

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "amount": 100,
      "type": "purchase",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /credits/purchase
Purchase credits via Stripe.

**Request Body:**
```json
{
  "amount": 100,
  "payment_method_id": "pm_xxx"
}
```

---

## Stripe & Payments

### POST /stripe/create-payment-intent
Create a Stripe payment intent.

**Request Body:**
```json
{
  "amount_cents": 5000,
  "purpose": "wallet_topup"
}
```

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "payment_intent_id": "pi_xxx"
}
```

### POST /stripe/webhook
Stripe webhook endpoint (internal use).

---

## Cleaner Endpoints

### GET /cleaner/availability
Get cleaner's weekly availability.

**Response:**
```json
{
  "availability": [
    {
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    }
  ]
}
```

### PUT /cleaner/availability
Update weekly availability.

### GET /cleaner/time-off
List time-off periods.

### POST /cleaner/time-off
Add time-off period.

**Request Body:**
```json
{
  "start_date": "2024-01-25",
  "end_date": "2024-01-27",
  "reason": "Vacation"
}
```

### GET /cleaner/service-areas
Get service areas.

### POST /cleaner/service-areas
Add service area.

### GET /cleaner/preferences
Get cleaner preferences.

### PUT /cleaner/preferences
Update preferences.

### GET /cleaner/schedule/:date
Get schedule for specific date.

### GET /cleaner/reliability
Get own reliability score and breakdown.

**Response:**
```json
{
  "score": 85,
  "tier": "Pro",
  "breakdown": {
    "attendance_score": 95,
    "on_time_score": 90,
    "photo_compliance_score": 80,
    "rating_score": 88
  }
}
```

---

## Scheduling

### POST /reschedule/job/:jobId
Request a reschedule.

**Request Body:**
```json
{
  "new_start_time": "2024-01-21T10:00:00Z",
  "reason_code": "schedule_conflict"
}
```

**Response:**
```json
{
  "reschedule_id": "uuid",
  "status": "pending",
  "bucket": "24_48",
  "is_reasonable": true
}
```

### POST /reschedule/:id/accept
Accept a reschedule request.

### POST /reschedule/:id/decline
Decline a reschedule request.

**Request Body:**
```json
{
  "decline_reason": "Cannot accommodate new time"
}
```

### GET /reschedule/:id
Get reschedule details.

### GET /reschedule/job/:jobId
List reschedules for a job.

---

### POST /cancellation/jobs/:jobId
Cancel a job (client).

**Request Body:**
```json
{
  "reason_code": "schedule_conflict"
}
```

**Response:**
```json
{
  "success": true,
  "fee_percent": 50,
  "refund_credits": 75,
  "grace_used": false
}
```

### POST /cancellation/jobs/:jobId/cleaner
Cancel a job (cleaner).

### POST /cancellation/no-shows
Mark a no-show (admin/support).

**Request Body:**
```json
{
  "job_id": "uuid",
  "no_show_by": "cleaner"
}
```

### GET /cancellation/jobs/:jobId/preview
Preview cancellation fees before confirming.

---

## Matching

### GET /matching/jobs/:jobId/candidates
Get ranked cleaner candidates for a job.

**Response:**
```json
{
  "candidates": [
    {
      "cleaner_id": "uuid",
      "name": "Jane Smith",
      "score": 0.92,
      "tier": "Pro",
      "distance_km": 5.2,
      "rating": 4.8,
      "factors": {
        "reliability": 30,
        "distance": 25,
        "history": 20,
        "tier": 10,
        "flexibility": 7
      }
    }
  ]
}
```

### POST /matching/jobs/:jobId/auto-assign
Auto-assign best available cleaner.

**Response:**
```json
{
  "assigned": true,
  "cleaner_id": "uuid",
  "cleaner_name": "Jane Smith",
  "match_score": 0.92
}
```

### GET /matching/jobs/:jobId/history
Get assignment history for job.

### GET /matching/explain/:jobId/:cleanerId
Get detailed match explanation.

---

## Scoring & Reliability

### GET /scoring/reliability/:cleanerId
Get cleaner reliability details (admin).

### POST /scoring/reliability/:cleanerId/recompute
Recompute reliability score (admin).

### POST /scoring/reliability/recompute-all
Recompute all cleaner scores (admin).

### GET /scoring/risk/:clientId
Get client risk score (admin).

### POST /scoring/risk/:clientId/recompute
Recompute client risk score (admin).

### POST /scoring/risk/recompute-all
Recompute all client risk scores (admin).

### POST /scoring/flexibility/evaluate-cleaners
Evaluate cleaner flexibility stats (admin).

### POST /scoring/flexibility/recompute-clients
Recompute client flexibility profiles (admin).

### POST /scoring/inconvenience/detect-patterns
Run inconvenience pattern detection (admin).

### POST /scoring/nightly-recompute
Run all nightly scoring jobs (admin).

---

## Photos

### POST /photos/jobs/:jobId/upload
Upload job photo.

**Request:** Multipart form data
- `photo`: File
- `type`: "before" or "after"

**Response:**
```json
{
  "photo": {
    "id": "uuid",
    "url": "https://storage.puretask.com/...",
    "type": "before"
  }
}
```

### GET /photos/jobs/:jobId
List photos for job.

### DELETE /photos/:photoId
Delete a photo.

---

## Messages

### GET /messages/jobs/:jobId
Get messages for a job.

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "I'll be there in 10 minutes",
      "sender_type": "cleaner",
      "created_at": "2024-01-20T09:50:00Z"
    }
  ]
}
```

### POST /messages/jobs/:jobId
Send a message.

**Request Body:**
```json
{
  "content": "Running 5 minutes late"
}
```

### PUT /messages/:messageId/read
Mark message as read.

---

## Notifications

### GET /notifications
List notifications.

### PUT /notifications/:id/read
Mark notification as read.

### PUT /notifications/read-all
Mark all notifications as read.

### GET /notifications/preferences
Get notification preferences.

### PUT /notifications/preferences
Update notification preferences.

**Request Body:**
```json
{
  "email_notifications": true,
  "sms_notifications": true,
  "push_notifications": true,
  "marketing_emails": false
}
```

---

## Admin

### GET /admin/kpis
Get KPI dashboard.

### GET /admin/kpis/history
Get historical KPIs.

### GET /admin/jobs
List all jobs with filters.

**Query Parameters:**
- `status`
- `client_id`
- `cleaner_id`
- `from_date`
- `to_date`
- `limit`
- `offset`

### GET /admin/disputes
List all disputes.

### GET /admin/payouts
List all payouts.

### GET /admin/job-events
List all job events.

### GET /admin/users
List all users.

### GET /admin/users/:userId
Get user details.

### PATCH /admin/users/:userId
Update user (suspend, role change, etc.).

### DELETE /admin/users/:userId
Delete user.

### GET /admin/system/health
System health check.

### GET /admin/system/stuck-jobs
Find stuck jobs.

### GET /admin/system/stuck-payouts
Find stuck payouts.

### GET /admin/system/ledger-issues
Check for ledger inconsistencies.

### GET /admin/fraud-alerts
List fraud alerts.

### POST /admin/fraud-alerts/:alertId/resolve
Resolve fraud alert.

---

## Analytics

### GET /analytics/dashboard
Get analytics dashboard data (admin).

### GET /analytics/revenue/trend
Revenue trend over time.

### GET /analytics/revenue/by-period
Revenue breakdown by period.

### GET /analytics/jobs/trend
Jobs trend over time.

### GET /analytics/jobs/status
Jobs by status breakdown.

### GET /analytics/users/signups
User signup trends.

### GET /analytics/top/clients
Top spending clients.

### GET /analytics/top/cleaners
Top performing cleaners.

### GET /analytics/top/rated-cleaners
Highest rated cleaners.

### GET /analytics/credits/health
Credit system health check.

### GET /analytics/report
Generate custom report.

---

## Premium Features

### GET /premium/boosts/options
Get available boost options.

### GET /premium/boosts/active
Get cleaner's active boosts.

### POST /premium/boosts/purchase
Purchase a boost.

### GET /premium/subscriptions
List client subscriptions.

### POST /premium/subscriptions
Create subscription.

### DELETE /premium/subscriptions/:id
Cancel subscription.

### GET /premium/referrals/code
Get referral code.

### GET /premium/referrals/stats
Get referral statistics.

### GET /premium/referrals/leaderboard
Get referral leaderboard.

---

## V2 Features

### Properties (Multi-location)

- `POST /v2/properties` - Create property
- `GET /v2/properties` - List properties
- `GET /v2/properties/:id` - Get property
- `PATCH /v2/properties/:id` - Update property
- `DELETE /v2/properties/:id` - Delete property
- `GET /v2/properties/:id/suggestions` - Get cleaning suggestions

### Teams (Cleaner Teams)

- `POST /v2/teams` - Create team
- `GET /v2/teams/my` - Get my teams
- `GET /v2/teams/memberships` - Get my memberships
- `POST /v2/teams/:id/members` - Invite member
- `POST /v2/teams/:id/accept` - Accept invitation
- `POST /v2/teams/:id/decline` - Decline invitation
- `DELETE /v2/teams/:id/members/:memberId` - Remove member
- `POST /v2/teams/:id/leave` - Leave team
- `GET /v2/teams/:id/stats` - Get team stats

### Calendar Integration

- `GET /v2/calendar/google/connect` - Start Google OAuth
- `GET /v2/calendar/google/callback` - OAuth callback
- `GET /v2/calendar/connection` - Get connection status
- `DELETE /v2/calendar/connection` - Disconnect calendar
- `GET /v2/calendar/ics-url` - Get ICS feed URL

### AI Features

- `POST /v2/ai/checklist` - Generate AI cleaning checklist
- `POST /v2/ai/dispute-suggestion` - Get AI dispute resolution suggestion

### Cleaner Dashboard

- `GET /v2/cleaner/goals` - Get monthly goals
- `GET /v2/cleaner/route-suggestions` - Get route optimization
- `GET /v2/cleaner/reliability-breakdown` - Get detailed reliability breakdown

### Job Rebooking

- `GET /v2/jobs/:id/rebook-data` - Get data for rebooking a job

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `INSUFFICIENT_CREDITS` | 400 | Not enough credits |
| `INVALID_TRANSITION` | 400 | Invalid job state transition |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint Pattern | Limit |
|------------------|-------|
| `/auth/*` | 10 req/min |
| `/jobs/*` | 60 req/min |
| `/admin/*` | 120 req/min |
| All others | 60 req/min |

Rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Webhooks (Outgoing)

PureTask can forward events to your n8n instance:

**Event Types:**
- `job.created`
- `job.accepted`
- `job.started`
- `job.completed`
- `job.cancelled`
- `payment.succeeded`
- `payment.failed`
- `dispute.opened`
- `dispute.resolved`
- `payout.completed`

**Webhook Payload:**
```json
{
  "event": "job.completed",
  "timestamp": "2024-01-20T15:30:00Z",
  "data": {
    "job_id": "uuid",
    "client_id": "uuid",
    "cleaner_id": "uuid"
  }
}
```

**Signature Header:**
```
x-n8n-signature: <hmac-sha256-hex>
```

