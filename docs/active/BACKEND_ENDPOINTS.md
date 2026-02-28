# Backend API Endpoints Expected by the Frontend

This document lists all REST API endpoints the PureTask frontend expects the backend to implement. Paths are relative to the API base URL (`NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE_URL`).

For Trust-Fintech integration details (auth, response contracts, roles, errors, CORS), see [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md).

**What UI to build from the backend:** See [BACKEND_UI_SPEC.md](./BACKEND_UI_SPEC.md) for screens, data to show, actions, and states (empty, 401, 403, 404, 501) derived from the API.

**Implemented:** `GET /bookings/me` and `GET /cleaners/:cleanerId/reviews` return real data. See Bookings & Jobs and Cleaners below. Referral, job photos, cleaner schedule range, check-in optional fields, and admin resolve-dispute path are documented in their sections.

---

## Config (optional, public, no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config/job-status` | **Optional.** Canonical job statuses, events, transitions, event permissions. Response: `{ data: { statuses, events, transitions, eventPermissions } }`. Use so frontend/n8n stay in sync with backend. If the endpoint is missing or fails, the frontend should fall back to static constants (e.g. `src/constants/jobStatus.ts`). Frontend can implement `getJobStatusConfig()` (service) and `useJobStatusConfig()` (hook, e.g. 5 min stale) exposing `getLabel`, `canTransition`, `isTerminal`, `isFromServer`. |

**Frontend integration:** See [FRONTEND_JOB_STATUS_CONFIG.md](./FRONTEND_JOB_STATUS_CONFIG.md) for the full contract (service, hook, fallback) and Product/alignment notes.

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login (email, password) |
| POST | `/auth/register` | Register new user |
| GET | `/auth/me` | Current user profile |
| POST | `/auth/logout` | Logout |

---

## Users & Profile

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/users/me` | Update current user |
| POST | `/users/me/avatar` | Upload avatar (multipart) |
| DELETE | `/users/me/avatar` | Remove avatar |
| POST | `/users/me/change-password` | Change password |
| POST | `/users/me/delete` | Delete account |

---

## Credits (main app – axios)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/credits/balance` | Get balance |
| GET | `/credits/ledger` | Get ledger entries (params: from, to, type, status, page) |

---

## Credits (Trust API – fetch)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/credits/balance` | Credits balance |
| GET | `/api/credits/ledger` | Ledger (query: from, to, type, status, search, limit) |
| POST | `/credits/checkout` | Buy credits (body: packageId, successUrl, cancelUrl) |

---

## Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/client/invoices` | List invoices (frontend uses this) |
| GET | `/client/invoices/:id` | Get invoice by ID |

---

## Billing (Trust API)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/invoices` | List invoices |
| GET | `/api/billing/invoices/:id` | Get invoice by ID |
| POST | `/client/invoices/:id/pay` | Pay invoice (body: payment_method: credits \| card) |

---

## Bookings & Jobs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bookings` | Create booking |
| GET | `/bookings/:bookingId` | Get booking |
| GET | `/bookings/me` | My bookings → `{ bookings: [...] }` (id, status, scheduled_start_at, scheduled_end_at, address, cleaner_id, cleaner?: { name, avatar_url }, etc.). Client only. |
| POST | `/bookings/:id/cancel` | Cancel booking |
| POST | `/bookings/:id/complete` | Mark completed |
| POST | `/bookings/:id/review` | Submit review |
| POST | `/bookings/estimate` | Price estimate |

| Method | Path | Description |
|--------|------|-------------|
| POST | `/jobs` | Create job |
| GET | `/jobs/:jobId` | Get job |
| GET | `/jobs/me` | My jobs |
| GET | `/jobs/client/:clientId` | Client's jobs |
| GET | `/jobs/cleaner/:cleanerId` | Cleaner's jobs |
| PATCH | `/jobs/:id/status` | Update status |
| POST | `/jobs/:id/cancel` | Cancel |
| POST | `/jobs/:id/start` | Start job |
| POST | `/jobs/:id/complete` | Complete job |
| POST | `/jobs/:id/rate` | Rate job |
| POST | `/jobs/:id/transition` | State transition (e.g. accept) |
| POST | `/jobs/:jobId/photos` | Add before/after photo (body: `type`: "before"\|"after", `photoUrl`: string). Cleaner only; use after presigned upload. |
| POST | `/jobs/:jobId/photos/commit` | Record S3/R2 upload in DB (body: `key`, `kind`: "before"\|"after"\|"client_dispute", `contentType`, `bytes`, optional `publicUrl`). Emits timeline events when MIN_BEFORE_PHOTOS / MIN_AFTER_PHOTOS met. Cleaner for before/after; client for client_dispute. |
| GET | `/jobs/:jobId/timeline` | Job events in chronological order (ASC) for stepper / client receipt. |

---

## Uploads (S3/R2 signed URLs)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/uploads/sign` | Get signed PUT URL for job photo (body: `jobId`, `kind`: "before"\|"after"\|"client_dispute", `contentType`, `fileName`, `bytes`). Returns `putUrl`, `key`, `publicUrl`. Requires STORAGE_* env. |

---

## Tracking (check-in / check-out / approve / dispute)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tracking/:jobId` | Job tracking state |
| POST | `/tracking/:jobId/check-in` | Check in (body: `location`: { latitude, longitude, accuracy? }, `beforePhotos`: string[], optional `accuracyM`, `source`: "device"\|"manual_override"). Cleaner only. |
| POST | `/tracking/:jobId/check-out` | Check out (after photos, notes). Cleaner only. |
| POST | `/tracking/:jobId/approve` | Client approves completed job, releases escrow; optional rating/tip. |
| POST | `/tracking/:jobId/dispute` | Client disputes completed job (body: reason, description, etc.). |

---

## Live Appointment (main app)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/client/jobs/:bookingId/live-status` | Live appointment state (frontend uses this) |

---

## Live Appointment (Trust API)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/appointments/:bookingId/live` | Live appointment state |
| POST | `/api/appointments/:bookingId/events` | Post event (en_route, arrived, check_in, check_out, note) |

---

## Cleaners

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaners/search` | Search cleaners (params) |
| GET | `/cleaners/:id` | Get cleaner profile |
| GET | `/cleaners/:id/availability` | Available slots |
| GET | `/cleaners/:id/reviews` | Reviews → `{ reviews: [...], page, per_page, total }` (params: page, per_page). Each review: id, job_id, reviewer_id, rating, comment, created_at, response?, response_at?, reviewer_name?). |
| GET | `/cleaners/featured` | Featured cleaners |
| GET | `/cleaners/top-rated` | Top-rated cleaners |
| GET | `/cleaners/:id/reliability` | Reliability score |

---

## Cleaner Profile & Availability

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaner/profile` | Cleaner profile |
| PATCH | `/cleaner/profile` | Update profile |
| GET | `/cleaner/service-areas` | Service areas |
| GET | `/cleaner/availability` | Weekly availability |
| PUT | `/cleaner/availability` | Update availability |
| GET | `/cleaner/schedule` | Schedule range (query: `from`, `to` YYYY-MM-DD) → `{ schedule: [...], from, to }`. Assigned jobs in range. |
| GET | `/cleaner/schedule/:date` | Schedule for a single date → `{ date, schedule: { availability, timeOff, scheduledJobs } }`. |
| GET | `/cleaner/time-off` | Time-off list |
| POST | `/cleaner/time-off` | Add time-off |
| DELETE | `/cleaner/time-off/:id` | Delete time-off |
| GET | `/cleaner/preferences` | Scheduling preferences |
| PUT | `/cleaner/preferences` | Update preferences |
| GET | `/cleaner/availability/suggestions` | Smart suggestions |
| POST | `/cleaner/availability/template` | Save template |

---

## Cleaner Holidays

| Method | Path | Description |
|--------|------|-------------|
| GET | `/holidays` | Holiday by date or list (params: date, from, to) |
| GET | `/cleaner/holiday-settings` | Holiday settings |
| PUT | `/cleaner/holiday-settings` | Update settings |
| GET | `/cleaner/holiday-overrides` | Overrides (params: from, to) |
| PUT | `/cleaner/holiday-overrides/:date` | Upsert override |

---

## Cleaner Earnings & Payouts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaner/earnings` | Earnings summary |
| GET | `/cleaner/earnings/breakdown` | Breakdown (params: period) |
| GET | `/cleaner/earnings/tax-report` | Tax report (params: year) |
| GET | `/cleaner/earnings/export` | Export (params) |
| GET | `/cleaner/payouts` | Payout list |
| POST | `/payouts/request` | Request payout |

---

## Cleaner Enhanced (dashboard, calendar, etc.)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaner/dashboard/analytics` | Analytics (params: period) |
| POST | `/cleaner/goals` | Create goal |
| GET | `/cleaner/goals` | List goals |
| GET | `/cleaner/calendar/conflicts` | Conflicts (params: start_date, end_date) |
| POST | `/cleaner/calendar/optimize` | Optimize schedule |
| GET | `/cleaner/jobs/:id/matching-score` | Matching score |
| POST | `/cleaner/auto-accept-rules` | Auto-accept rules |
| POST | `/cleaner/jobs/:id/track-time` | Track time |
| POST | `/cleaner/jobs/:id/expenses` | Add expense |
| GET | `/cleaner/jobs/:id/directions` | Directions |
| GET | `/cleaner/profile/completeness` | Profile completeness |
| GET | `/cleaner/profile/preview` | Profile preview |
| GET | `/cleaner/profile/insights` | Profile insights |
| POST | `/cleaner/profile/video` | Upload video |
| GET | `/cleaner/certifications/recommendations` | Certification recommendations |
| GET | `/cleaner/leaderboard/personal` | Leaderboard (params: timeframe, category) |

---

## Client

| Method | Path | Description |
|--------|------|-------------|
| GET | `/client/favorites` | Favorites |
| POST | `/client/favorites` | Add favorite (cleaner_id) |
| DELETE | `/client/favorites/:id` | Remove favorite |
| GET | `/client/bookings/draft` | Draft booking |
| POST | `/client/bookings/draft` | Save draft |
| GET | `/client/dashboard/insights` | Dashboard insights |
| GET | `/client/dashboard/recommendations` | Recommendations |
| POST | `/client/search/saved` | Save search |
| GET | `/client/search/saved` | Saved searches |
| GET | `/client/favorites/recommendations` | Favorites recommendations |
| GET | `/client/favorites/insights` | Favorites insights |
| POST | `/client/recurring-bookings/:id/skip` | Skip recurring |
| GET | `/client/recurring-bookings/:id/suggestions` | Suggestions |
| PUT | `/client/profile/preferences` | Profile preferences |
| GET | `/client/profile/preferences` | Get preferences |
| POST | `/client/profile/photo` | Update photo |
| POST | `/client/reviews/:id/photos` | Add review photos |
| GET | `/client/reviews/insights` | Review insights |
| GET | `/client/jobs/:id/live-status` | Live status |
| POST | `/client/jobs/:id/add-to-calendar` | Add to calendar |
| GET | `/client/jobs/:id/share-link` | Share link |
| POST | `/client/credits/auto-refill` | Auto-refill config |
| GET | `/client/reviews/given` | Reviews given |
| POST | `/client/reviews` | Create review |
| PATCH | `/client/reviews/:id` | Update review |
| DELETE | `/client/reviews/:id` | Delete review |
| GET | `/client/payment-methods` | Payment methods |
| PATCH | `/client/payment-methods/:id/default` | Set default |
| DELETE | `/client/payment-methods/:id` | Remove payment method |
| GET | `/client/addresses` | Addresses |
| PATCH | `/client/addresses/:id/default` | Set default address |
| DELETE | `/client/addresses/:id` | Delete address |

---

## Referral

| Method | Path | Description |
|--------|------|-------------|
| POST | `/referral/send` | Send referral invite (body: `email`). Sender from auth; backend gets/creates referral code and sends email if SendGrid configured. |
| GET | `/referral/me` | Current user's referral code and stats → `{ code, totalReferrals, pendingReferrals, qualifiedReferrals, totalEarned }`. |

---

## Payments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payments/create-intent` | Create payment intent |
| POST | `/payments/confirm` | Confirm payment |
| GET | `/payments/methods` | List payment methods |
| POST | `/payments/methods` | Add payment method |
| DELETE | `/payments/methods/:id` | Remove payment method |
| PATCH | `/payments/methods/default` | Set default (payment_method_id) |
| GET | `/payments/history` | Payment history (params) |

---

## Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/messages/job/:jobId` | Send job message |
| POST | `/messages` | Send message |
| GET | `/messages/conversations` | List conversations |
| GET | `/messages/job/:jobId` | Job messages |
| GET | `/messages/with/:userId` | Messages with user |
| POST | `/messages/job/:jobId` | Send (body, receiverId) |
| PATCH | `/messages/:id/read` | Mark read |
| POST | `/messages/read-all/:userId` | Mark all read |
| DELETE | `/messages/:id` | Delete message |
| GET | `/messages/unread-count` | Unread count |

---

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List (params) |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/:id/read` | Mark read |
| POST | `/notifications/read-all` | Mark all read |
| DELETE | `/notifications/:id` | Delete notification |
| GET | `/notifications/preferences` | Preferences |
| PUT | `/notifications/preferences` | Update preferences |

---

## Admin – Analytics & Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics/overview` | Stats overview |
| GET | `/admin/analytics/daily` | Daily stats (params: days) |
| GET | `/admin/analytics/revenue` | Revenue (params: period) |
| GET | `/admin/analytics/insights` | Analytics insights |
| POST | `/admin/analytics/custom-report` | Custom report |
| GET | `/admin/dashboard/realtime` | Realtime metrics |
| GET | `/admin/dashboard/alerts` | Alerts (params: severity) |
| GET | `/admin/system/health` | System health |

---

## Admin – Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List users (params: role, status, search, page, per_page) |
| GET | `/admin/users/:id` | Get user |
| PATCH | `/admin/users/:id/status` | Update status |
| PATCH | `/admin/users/:id/role` | Update role |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/users/:id/risk-profile` | Risk profile |
| POST | `/admin/users/:id/risk-action` | Risk action |

---

## Admin – Bookings & Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/bookings` | List bookings |
| GET | `/admin/bookings/:id` | Booking details |
| PATCH | `/admin/bookings/:id/status` | Update status |
| POST | `/admin/bookings/:id/cancel` | Cancel |
| GET | `/admin/jobs` | List jobs (params: status) |
| POST | `/admin/jobs/bulk-action` | Bulk action |
| GET | `/admin/jobs/insights` | Job insights |
| POST | `/admin/jobs/:jobId/resolve-dispute` | Resolve dispute by job (body: `resolution`: "resolved_refund"\|"resolved_no_refund", `admin_notes`?: string). Same as `/admin/disputes/job/:jobId/resolve`. |

---

## Admin – Finance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/transactions` | List transactions |
| POST | `/admin/transactions/:id/refund` | Refund |
| GET | `/admin/reports/financial` | Financial report |
| GET | `/admin/finance/forecast` | Forecast (params: months) |
| GET | `/admin/finance/reports` | Reports (params: start_date, end_date) |

---

## Admin – Verifications & Issues

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/verifications/pending` | Pending verifications |
| POST | `/admin/verifications/:id/approve` | Approve |
| POST | `/admin/verifications/:id/reject` | Reject |
| GET | `/admin/id-verifications` | ID verifications (params) |
| GET | `/admin/id-verifications/:id/document-url` | Document URL |
| PATCH | `/admin/id-verifications/:id/status` | Update status |
| GET | `/admin/issues` | Reported issues |
| POST | `/admin/issues/:id/resolve` | Resolve issue |

---

## Admin – Disputes & Risk

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/disputes/with-insights` | Disputes with insights |
| GET | `/admin/disputes/insights` | Dispute insights |
| POST | `/admin/disputes/:id/analyze` | Analyze dispute |
| GET | `/admin/risk/scoring` | Risk scoring |
| POST | `/admin/risk/mitigate` | Mitigate risk |

---

## Admin – Gamification

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/flags` | Gamification feature flags (gamification_enabled, rewards_enabled, cash_rewards_enabled, seasonal_enabled, governor_enabled; optional per-region overrides) |
| PATCH | `/admin/gamification/flags` | Update gamification flags (body: key-value or JSON patch) |
| GET | `/admin/gamification/goals` | Goals library (params: level, type, enabled) |
| GET | `/admin/gamification/goals/:id` | Goal by ID |
| POST | `/admin/gamification/goals` | Create goal |
| PATCH | `/admin/gamification/goals/:id` | Update goal (versioning optional) |
| GET | `/admin/gamification/rewards` | Rewards list |
| GET | `/admin/gamification/rewards/:id` | Reward by ID (for edit page) |
| POST | `/admin/gamification/rewards` | Create reward |
| PATCH | `/admin/gamification/rewards/:id` | Update reward |
| GET | `/admin/gamification/choices` | Choice reward groups |
| GET | `/admin/gamification/governor` | Governor state (supply/demand, multipliers, caps per region) |
| PATCH | `/admin/gamification/governor` | Apply overrides / recommended |
| GET | `/admin/gamification/abuse` | Abuse/fraud signals (params: type, page) |
| POST | `/admin/gamification/abuse/:cleanerId/pause-rewards` | Pause rewards for cleaner |
| GET | `/admin/support/cleaner/:cleanerId/gamification` | Support view: goal progress, why paused, reward history |
| POST | `/admin/support/cleaner/:cleanerId/gamification/recompute` | Recompute level and goal progress |
| POST | `/admin/support/cleaner/:cleanerId/gamification/grant-reward` | Grant reward manually (body: reward_id, reason?, duration_days?) |
| POST | `/admin/support/cleaner/:cleanerId/gamification/remove-reward` | Remove active reward (body: reward_id, reason?) |

---

## Cleaner – Gamification (cleaner-facing)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaner/progress` | Progress hub (level, core/stretch/maintenance %, next actions, active rewards) |
| GET | `/cleaner/goals` | List goals (already in Cleaner Enhanced) |
| GET | `/cleaners/:id` | When used for public profile, may include `level`, `badges` (array of { id, name, icon? }) for client trust signals |

**Note:** POST `/cleaner/rewards/choice/:choiceGroupId/select` (body: `{ reward_id }`) is in the gamification spec; frontend may call it for choice reward selection.

---

## Admin – Settings & Communication

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/settings` | System settings |
| PATCH | `/admin/settings` | Update setting |
| GET | `/admin/settings/feature-flags` | Feature flags |
| GET | `/admin/settings/audit-log` | Audit log (params: limit) |
| GET | `/admin/communication/templates` | Templates |
| POST | `/admin/communication/send` | Send message |
| GET | `/admin/communication/analytics` | Communication analytics |

---

## Admin – Reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/reports/build` | Build report |
| POST | `/admin/reports/schedule` | Schedule report |

---

## Cleaner AI (legacy)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cleaner/ai/settings` | AI settings |
| GET | `/cleaner/ai/templates` | Templates |
| GET | `/cleaner/ai/quick-responses` | Quick responses |

---

## OAuth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/oauth/google/start` | Start Google OAuth (redirect) |

---

## Notes

- **Base URL**: Configure via `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE_URL`.
- **Auth**: Most endpoints expect `Authorization: Bearer <token>`.
- **Trust API** uses paths prefixed with `/api/` (credits, billing, appointments); the main app uses paths without that prefix.
- **Path conventions**: Some services may expect different shapes; this list reflects current frontend usage.
- **Gamification**: Full request/response shapes and data model: [GAMIFICATION_BACKEND_SPEC.md](./GAMIFICATION_BACKEND_SPEC.md).
- **Recently implemented (backend)**: `GET /bookings/me` (real client bookings), `GET /cleaners/:id/reviews` (paginated reviews), `POST /admin/jobs/:jobId/resolve-dispute`, `POST /referral/send`, `GET /referral/me`, `POST /jobs/:jobId/photos`, `GET /cleaner/schedule?from=&to=`, and check-in body optional `accuracyM`, `source`. Trust live checklist returns `id`, `completed`, `completedAtISO` (labels on frontend). See DECISIONS.md for data ownership (labels/copy).

---

## Endpoints still returning stubs or placeholder data

These routes exist for frontend compatibility but return empty/hardcoded data or no-op success. Replace with real implementations when the feature is needed.

**Implemented with real data:**

- **GET /cleaners/:id/availability** — Uses `getWeeklyAvailability(cleanerId)`; returns `slots` from `cleaner_availability`.
- **GET /cleaners/top-rated** and **GET /cleaners/featured** — Query cleaners with rating/review count from `reviews`; featured reuses top-rated (no featured flag on cleaners).
- **GET /admin/risk/review** — `getRiskReviewQueue()` queries `risk_flags` where `active = true`, returns users + flags and a simple risk score from severity.
- **GET /notifications** and **GET /notifications/unread-count** — Feed from `notification_log` for current user; unread_count is total count (no `read_at` column yet; PATCH read / POST read-all remain no-op until schema added).

| Method | Path | Status | Notes |
|--------|------|--------|--------|
| GET | `/cleaners/featured` | **Real data** | Same as top-rated (no featured flag). |
| GET | `/cleaners/top-rated` | **Real data** | From `reviews` + cleaner_profiles; ordered by rating. |
| GET | `/cleaners/:id/availability` | **Real data** | From `getWeeklyAvailability` / `cleaner_availability`. |
| GET | `/notifications` | **Real data** | From `notification_log` for user; no read state yet. |
| GET | `/notifications/unread-count` | **Real data** | Total count from `notification_log`. |
| PATCH | `/notifications/:id/read` | No-op | Add `read_at` column to persist. |
| POST | `/notifications/read-all` | No-op | Same. |
| GET | `/client/payment-methods` | Stub | Needs Stripe `paymentMethods.list`. |
| POST | `/users/me/avatar` | 501 | Upload or redirect. |
| POST | `/client/profile/photo` | Body only | Add file upload. |
| GET | `/admin/risk/review` | **Real data** | `getRiskReviewQueue()` queries `risk_flags`. |

**Other notes:**

- **Search** (`/search/global`, `/search/autocomplete`): Return empty when query &lt; 2 chars; otherwise use DB. Not stubs.
- **Holidays**: Returns real data from `listHolidays()`; empty only on error (fallback).
- **Gamification** (e.g. next-best-actions, badges): When `gamification_enabled` is false, returns empty by design.

---

## Next steps & wiring status (Job Details + integration)

**Designed, implemented, and wired (backend):**

- **GET /jobs/:jobId/details** — Returns `{ data: { job, cleaner, photos, checkins, ledgerEntries, paymentIntent, payout } }`. Typed with `JobDetailsResponse`. Uses `requireAuth` + `requireOwnership("job", "jobId")`. All helpers (cleaner composite, photos, checkins, ledger, payment intent, payout, level, badges) use real DB.
- **GET /tracking/:jobId** — Returns `{ tracking: state }` (jobId, status, currentLocation, timeline, eta, photos, cleaner, times). Same auth/ownership. Used for live presence polling.
- **GET /cleaners/:id** — Returns `{ cleaner: CleanerProfileResponse }` with reliability_score, tier, avg_rating, jobs_completed, level, badges. Real data.
- **GET /bookings/me** — Real client bookings (dashboardStubs). **GET /cleaners/featured**, **/cleaners/top-rated**, **/cleaners/:id/availability**, **GET /notifications**, **GET /admin/risk/review** — real data as noted above.

**API mounting:** Backend serves the same API at **/** and **/api/v1** (e.g. `/jobs/:jobId/details` and `/api/v1/jobs/:jobId/details`). Frontend should use one base consistently (e.g. `NEXT_PUBLIC_API_URL` = `https://api.example.com` or `https://api.example.com/api/v1`).

**Communicating as intended:**

- Details and tracking are separate (static vs live) as per the design. Frontend should call details once, then poll tracking every 5–10s.
- Auth: backend expects JWT (Bearer or cookie depending on middleware). Ensure frontend sends credentials (cookies) or `Authorization: Bearer <token>` so `requireAuth` and `requireOwnership` succeed.

**Remaining / next steps:**

1. **Frontend Job Details page** — Implement the Frontend Integration Guide (see DATA_MODEL_REFERENCE.md): types, `getJobDetails`/`getJobTracking`, hooks, page, and components (TimelineRail, ReliabilityRing, LedgerFlow, ProofGallery, PresenceMiniMap). Then point the app at a real job ID and verify the UI.
2. **Path alignment** — Confirm frontend base URL matches backend (root vs `/api/v1`). If the app proxies to the backend under `/api`, use `/api/jobs/...` and `/api/tracking/...` in the client.
3. **Optional stubs to replace later** — `GET /client/payment-methods` (Stripe paymentMethods.list), `PATCH /notifications/:id/read` and `POST /notifications/read-all` (need `read_at` column). Not blocking for Job Details.
4. **E2E or manual test** — Log in as client, open a job, hit GET /jobs/:jobId/details and GET /tracking/:jobId; confirm response shape and that ownership allows access.
