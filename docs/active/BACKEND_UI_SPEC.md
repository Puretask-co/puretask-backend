# Backend → Frontend UI Spec

This document tells the **frontend what kind of UI to build** based on what the backend provides. For each area: suggested screens, what data to show, what actions to offer, and what states to handle (empty, errors, 501).

**Exact request/response shapes:** See [TRUST_FRONTEND_BACKEND_SPEC.md](./TRUST_FRONTEND_BACKEND_SPEC.md) (Trust hooks) and [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) (full list).

---

## How to use this

- **Screens** — Suggested pages or sections the API implies.
- **Data** — Which endpoint to call and which fields to display (tables, cards, labels).
- **Actions** — Buttons/forms that trigger a method + path (+ body).
- **States** — What to show when loading, when the list is empty, and when the backend returns 401 / 403 / 404 / 501.

---

## 1. Auth

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Login | Sign in | — | POST `/auth/login` (email, password) → store token, redirect |
| Register | Sign up | — | POST `/auth/register` (email, password, role?) → then login |
| Profile / Me | Current user | GET `/auth/me` → `user` (id, email, role, name), `profile` | PATCH profile, change password, logout (client drops token) |

**States:** 401 on protected routes → redirect to login. Show validation errors from 400 response.

---

## 2. Credits (Trust — client)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Credits dashboard | Balance + history | GET `/api/credits/balance` → balance, currency, lastUpdatedISO | — |
| | | GET `/api/credits/ledger` ?from, to, type, status, search, limit → entries[] | — |
| Buy credits | Checkout | — | POST `/api/credits/checkout` or POST `/credits/checkout` (packageId, successUrl, cancelUrl) → redirect to response.checkoutUrl |

**UI hints:**
- **Balance:** One prominent card (balance, currency, lastUpdatedISO).
- **Ledger:** Table or list: id, createdAtISO, type, amount, description, status, relatedBookingId, invoiceId. Support filters (from, to, type, search).
- **Empty ledger:** Show "No transactions yet" and a CTA to buy credits.
- **Buy credits:** Package selector → success/cancel URLs point back to credits page with ?success=1 or ?cancel=1; after redirect, refetch balance and ledger.

**States:** 403 if not client. 401 → login.

---

## 3. Billing / Invoices (Trust — client)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Invoices list | All invoices | GET `/api/billing/invoices` → invoices[] (id, createdAtISO, status, subtotal, tax, total, currency, bookingId, receiptUrl, lineItems[], paymentMethodSummary) | — |
| Invoice detail | Single invoice | GET `/api/billing/invoices/:id` → same shape with full lineItems | POST `/api/client/invoices/:id/pay` (payment_method: credits \| card) → { ok: true } |

**UI hints:**
- **List:** Table or cards: date, status, total, bookingId; link to detail.
- **Detail:** Subtotal, tax, total, line items (label, amount), payment method summary; **Pay** button.
- **Pay:** Modal or inline: choose "Credits" or "Card" → POST pay → on success refetch invoice (and credits balance if credits).

**States:** 404 if invoice not found or not owned. 403 if not client. 401 → login.

---

## 4. Live Appointment (Trust — client or cleaner)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Live appointment view | Real-time booking state | GET `/api/appointments/:bookingId/live` → bookingId, state, etaISO?, reliability?, gps[], photos[], checklist[], events[] | (Cleaner only) POST `/api/appointments/:bookingId/events` (type, note?, gps?, source?) |

**UI hints:**
- **State:** One of scheduled \| en_route \| arrived \| checked_in \| completed — show as status badge or stepper.
- **ETA:** Show etaISO when present (e.g. "Arriving by 14:35").
- **Map:** Plot gps[] (lat, lng, atISO, source); optional accuracyM.
- **Photos:** Grid of photos (kind: before \| after, url, createdAtISO, uploadedBy).
- **Checklist:** List of checklist items (id, label, completed, completedAtISO?) — e.g. Kitchen, Bathrooms, Floors.
- **Events:** Timeline of events (id, atISO, type, summary, metadata).
- **Real-time:** Subscribe to Socket.IO room `booking:${bookingId}`; on `appointment_event` refetch live or invalidate query (see [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md)).
- **Cleaner actions:** Buttons for "En route", "Arrived", "Add note"; optional "Check in" / "Check out" — if backend returns **501** for check_in/check_out, show message and link to main tracking flow (POST `/tracking/:jobId/check-in` and `/tracking/:jobId/check-out` with photos).

**States:** 404 if appointment not found or not participant. 403 for post-event if not cleaner. 501 for check_in/check_out → direct user to full check-in/check-out with photos.

---

## 5. Reliability (client viewing cleaner)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Cleaner profile section | Trust signal | GET `/cleaners/:cleanerId/reliability` or GET `/api/cleaners/:cleanerId/reliability` → reliability: { score, tier, breakdown, explainers, lastUpdatedISO } | — |

**UI hints:**
- **Score:** 0–100 (e.g. ring or number).
- **Tier:** Excellent \| Good \| Watch \| Risk — badge or label.
- **Breakdown:** onTimePct, completionPct, cancellationPct, communicationPct, qualityPct (e.g. small bars or list).
- **Explainers:** List of strings (e.g. "Score: 92%", "Completed jobs (90d): 45").

**States:** 404 if cleaner not found. 401 → login.

---

## 6. Bookings / Jobs (client & cleaner)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| My bookings (client) | List | GET `/bookings/me` → bookings[] (id, status, scheduled_start_at, address, cleaner, etc.) | Cancel, complete, review (see below) |
| My jobs (cleaner) | List | GET `/jobs/me` or schedule | Accept, start, complete, add photos |
| Booking/Job detail | One booking | GET `/bookings/:id` or GET `/jobs/:id` | Cancel, complete, review, add photos (cleaner) |
| Job details (rich) | Full context | GET `/jobs/:jobId/details` → job, cleaner, photos, checkins, ledgerEntries, paymentIntent, payout | — |
| Job tracking (live) | Live state | GET `/tracking/:jobId` → tracking state, timeline, eta, photos | Check-in, check-out, approve, dispute |

**UI hints:**
- **List:** Cards or table: date, time, address, status, cleaner name; link to detail.
- **Detail:** Use job status and timeline; show photos, ledger entries, payment/receipt when available.
- **Tracking:** Stepper or timeline from tracking state; buttons for check-in (with before photos), check-out (after photos), approve, dispute.

**States:** 404 if not found or not participant. 403 for role-gated actions. 401 → login.

---

## 7. Tracking (check-in / check-out / approve / dispute)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Job tracking | Live state | GET `/tracking/:jobId` | POST check-in, check-out, approve, dispute |
| Check-in | Cleaner at job | — | POST `/tracking/:jobId/check-in` (location, beforePhotos[], accuracyM?, source?) |
| Check-out | Cleaner finished | — | POST `/tracking/:jobId/check-out` (after photos, notes) |
| Approve | Client approves | — | POST `/tracking/:jobId/approve` (optional rating/tip) |
| Dispute | Client disputes | — | POST `/tracking/:jobId/dispute` (reason, description, etc.) |

**UI hints:**
- Check-in/check-out require **photos** (before/after); use uploads flow (e.g. POST `/uploads/sign` then POST `/jobs/:jobId/photos/commit`).
- If the app uses Trust "live" + POST events, and user taps "Check in" there, backend may return **501** — then show "Use full check-in with photos" and link to tracking check-in.

**States:** 403 if wrong role. 401 → login.

---

## 8. Cleaner (profile, schedule, earnings)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| My profile | Cleaner profile | GET `/cleaner/profile` | PATCH `/cleaner/profile` |
| Availability | Weekly slots | GET `/cleaner/availability`, GET `/cleaner/schedule` ?from, to | PUT availability, time-off, preferences |
| Schedule | Calendar | GET `/cleaner/schedule` ?from, to; GET `/cleaner/schedule/:date` | — |
| Earnings | Summary | GET `/cleaner/earnings`, `/cleaner/earnings/breakdown` | — |
| Payouts | List | GET `/cleaner/payouts` | POST `/payouts/request` |

**UI hints:**
- Schedule view: show assigned jobs in range; single-date view for availability + time-off + scheduled jobs.
- Earnings: summary card + breakdown by period; tax report/export if needed.

**States:** 403 if not cleaner. 401 → login.

---

## 9. Client (favorites, dashboard, settings)

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Favorites | Saved cleaners | GET `/client/favorites` | POST add, DELETE remove |
| Dashboard | Insights | GET `/client/dashboard/insights`, `/client/dashboard/recommendations` | — |
| Payment methods | Cards | GET `/client/payment-methods` | Set default, delete (per BACKEND_ENDPOINTS) |
| Addresses | Saved addresses | GET `/client/addresses` | Default, delete |

**States:** Some endpoints may still be stubs (see BACKEND_ENDPOINTS "Endpoints still returning stubs"). Handle empty lists and 501 if applicable.

---

## 10. Messages & Notifications

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Conversations | List | GET `/messages/conversations` | — |
| Thread | Messages | GET `/messages/job/:jobId` or `/messages/with/:userId` | POST send, PATCH read, DELETE |
| Notifications | List + badge | GET `/notifications`, GET `/notifications/unread-count` | PATCH read, POST read-all |

**UI hints:**
- Unread count in header or tab. List with "Mark all read".
- Thread: send message form; show sender, body, time; mark read on view.

**States:** 401 → login. Read state may be no-op until backend adds read_at (see BACKEND_ENDPOINTS).

---

## 11. Admin

| Screen | Purpose | Data | Actions |
|--------|---------|------|---------|
| Dashboard | Overview | GET `/admin/analytics/overview`, `/admin/dashboard/realtime`, `/admin/dashboard/alerts` | — |
| Users | List + detail | GET `/admin/users` (role, status, search, page), GET `/admin/users/:id` | PATCH status/role, DELETE, risk actions |
| Bookings / Jobs | List | GET `/admin/bookings`, `/admin/jobs` | PATCH status, cancel, resolve dispute (POST `/admin/jobs/:jobId/resolve-dispute`) |
| Finance | Transactions | GET `/admin/transactions`, `/admin/reports/financial` | Refund, reports |
| Disputes / Risk | Queues | GET `/admin/disputes/with-insights`, `/admin/risk/scoring` | Resolve, mitigate |
| Settings | System | GET `/admin/settings`, `/admin/settings/feature-flags` | PATCH settings |

**UI hints:**
- Role-gated: only admin. Tables with filters and pagination; detail pages with action buttons (resolve dispute, refund, etc.).

**States:** 403 if not admin. 401 → login.

---

## Summary: Screen → Endpoint mapping

| UI area | Main GET (data) | Main actions (POST/PATCH/DELETE) |
|---------|------------------|----------------------------------|
| Auth | `/auth/me` | `/auth/login`, `/auth/register` |
| Credits (Trust) | `/api/credits/balance`, `/api/credits/ledger` | `/api/credits/checkout` or `/credits/checkout` |
| Billing (Trust) | `/api/billing/invoices`, `/api/billing/invoices/:id` | `/api/client/invoices/:id/pay` |
| Live appointment (Trust) | `/api/appointments/:bookingId/live` | `/api/appointments/:bookingId/events` (cleaner); Socket.IO for real-time |
| Reliability | `/cleaners/:id/reliability` or `/api/cleaners/:id/reliability` | — |
| Bookings/Jobs | `/bookings/me`, `/jobs/me`, `/jobs/:id/details`, `/tracking/:jobId` | cancel, complete, review, check-in, check-out, approve, dispute |
| Cleaner | `/cleaner/profile`, `/cleaner/availability`, `/cleaner/schedule`, `/cleaner/earnings`, `/cleaner/payouts` | PATCH profile, PUT availability, request payout |
| Client | `/client/favorites`, `/client/dashboard/*`, `/client/payment-methods`, `/client/addresses` | Add/remove favorite, set default, delete |
| Messages | `/messages/conversations`, `/messages/job/:jobId` | POST send, PATCH read |
| Notifications | `/notifications`, `/notifications/unread-count` | PATCH read, POST read-all |
| Admin | `/admin/*` (analytics, users, bookings, finance, disputes, settings) | PATCH, POST resolve-dispute, refund, etc. |

---

## Related docs

- [TRUST_FRONTEND_BACKEND_SPEC.md](./TRUST_FRONTEND_BACKEND_SPEC.md) — Exact request/response shapes for Trust hooks
- [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) — Full endpoint list and stub status
- [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md) — Auth, CORS, errors, Socket.IO
- [DATA_MODEL_REFERENCE.md](./DATA_MODEL_REFERENCE.md) — Job/cleaner/payment types and DB schema
