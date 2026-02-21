# Backend API Endpoints Expected by the Frontend

This document lists all REST API endpoints the PureTask frontend expects the backend to implement. Paths are relative to the API base URL (`NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE_URL`).

For Trust-Fintech integration details (auth, response contracts, roles, errors, CORS), see [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md) (in the frontend repo if present).

**Backend coverage (this repo):**

- Routes are mounted at **root** (`/`) and **`/api/v1`** — so the frontend can use either `NEXT_PUBLIC_API_URL` = `http://localhost:4000` or `http://localhost:4000/api/v1`.
- **Stub implementations:** `GET /bookings/me` and `GET /cleaners/:id/reviews` return empty arrays in `src/routes/dashboardStubs.ts`; replace with real implementations when ready.
- **Trust API** paths (`/api/credits/*`, `/api/billing/*`, `/api/appointments/*`) are served by `src/routes/trustAdapter.ts` mounted at `/api`.
- **Added for frontend alignment (2026-02):**
  - **Auth:** `POST /auth/logout` — returns success; frontend discards token (`src/routes/auth.ts`).
  - **Credits:** `GET /credits/ledger` — alias for ledger entries (params: page, limit); same data as history (`src/routes/credits.ts`).
  - **Jobs:** `GET /jobs/me` — alias for “my jobs” (same as `GET /jobs`) (`src/routes/jobs.ts`).
  - **Users:** `GET /users/me`, `PATCH /users/me`, `POST /users/me/change-password`, `POST /users/me/avatar` (501), `DELETE /users/me/avatar`, `POST /users/me/delete` (`src/routes/users.ts`).
  - **Cleaners:** `GET /cleaners/search`, `GET /cleaners/featured` (stub), `GET /cleaners/top-rated` (stub), `GET /cleaners/:id`, `GET /cleaners/:id/availability` (stub), `GET /cleaners/:id/reviews` (stub) (`src/routes/dashboardStubs.ts` — `cleanersRouter`).
- **Reliability:** `GET /cleaners/:cleanerId/reliability` is at **root** (no `/api/v1`) via `trustRootRouter` in `src/routes/trustAdapter.ts`; frontend should call same base URL.

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
| GET | `/bookings/me` | My bookings → `{ bookings: [] }` (stub; params: status, page) |
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
| GET | `/cleaners/:id/reviews` | Reviews → `{ reviews: [], page, per_page, total }` (stub; params: page, per_page) |
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
| GET | `/cleaner/schedule` | Schedule (params: from, to) |
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
| POST | `/admin/jobs/:id/resolve-dispute` | Resolve dispute |

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

- **Base URL**: Configure via `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_BASE_URL`. Backend serves at root and `/api/v1` (see `src/index.ts`).
- **Auth**: Most endpoints expect `Authorization: Bearer <token>`.
- **Trust API** uses paths prefixed with `/api/` (credits, billing, appointments); the main app uses paths without that prefix.
- **Path conventions**: Some services may expect different shapes; this list reflects current frontend usage.

**Gap / stub summary:** Many admin, client, cleaner-enhanced, and reporting endpoints are implemented in `src/routes/` (admin, adminEnhanced, client, clientEnhanced, cleaner, cleanerEnhanced, etc.). Endpoints not yet implemented or still stubbed can return 501 or empty data; see this doc and code for the canonical list. Run the API and test critical paths (auth, jobs, credits, client, cleaner) to confirm.

**Last updated:** 2026-02-19
