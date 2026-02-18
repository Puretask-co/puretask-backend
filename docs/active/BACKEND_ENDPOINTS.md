# Backend API Endpoints — Frontend Reference

API endpoints the PureTask frontend expects. Paths are relative to the API base URL (`NEXT_PUBLIC_API_BASE_URL`).

**Auth, CORS, response contracts:** See [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md).

---

## Path Conventions

| Convention | Example | Backend mount |
|------------|---------|---------------|
| Root | `/auth/login` | `/` and `/api/v1` |
| Trust API | `/api/credits/balance` | `/api` |
| Client | `/client/invoices` | `/` |

---

## Auth

| Method | Path | Backend | Notes |
|--------|------|---------|-------|
| POST | `/auth/login` | ✓ | Returns `{ token, user }` |
| POST | `/auth/register` | ✓ | Body: `{ email, password, role? }` |
| GET | `/auth/me` | ✓ | Requires `Authorization: Bearer` |
| POST | `/auth/logout` | — | JWT: client deletes token; no backend call required |

---

## Credits

| Method | Path | Backend | Notes |
|--------|------|---------|-------|
| GET | `/credits/balance` | ✓ | Main: `{ balance }` |
| GET | `/credits/history` | ✓ | Main: `{ transactions }` |
| GET | `/api/credits/balance` | ✓ | Trust: `{ balance, currency, lastUpdatedISO }` |
| GET | `/api/credits/ledger` | ✓ | Trust: `{ entries }` with `?from,to,type,search,limit` |
| POST | `/credits/checkout` | ✓ | Body: `{ packageId, successUrl, cancelUrl }` |

---

## Billing / Invoices

| Method | Path | Backend | Notes |
|--------|------|---------|-------|
| GET | `/client/invoices` | ✓ | Client invoices; use this path |
| GET | `/client/invoices/:id` | ✓ | With line items |
| POST | `/client/invoices/:id/pay` | ✓ | Body: `{ payment_method: "credits"|"card" }` |
| GET | `/api/billing/invoices` | ✓ | Trust contract |
| GET | `/api/billing/invoices/:id` | ✓ | Trust contract |

**Note:** Frontend may expect `/billing/invoices`. Backend uses `/client/invoices` and `/api/billing/invoices` (Trust).

---

## Jobs / Bookings / Appointments

| Method | Path | Backend | Notes |
|--------|------|---------|-------|
| POST | `/jobs` | ✓ | Create job |
| GET | `/jobs/:id` | ✓ | Job details |
| GET | `/client/jobs/:id/live-status` | ✓ | Live status (main) |
| GET | `/api/appointments/:bookingId/live` | ✓ | Trust live state |
| POST | `/api/appointments/:bookingId/events` | ✓ | Trust: en_route, arrived, note; 501 for check_in/check_out |
| POST | `/tracking/:jobId/en-route` | ✓ | With `{ location }` |
| POST | `/tracking/:jobId/arrived` | ✓ | With `{ location }` |
| POST | `/tracking/:jobId/check-in` | ✓ | With `{ location, beforePhotos }` |
| POST | `/tracking/:jobId/check-out` | ✓ | With `{ afterPhotos, notes? }` |

**Note:** `bookingId` = `job.id`.

---

## Cleaner, Client, Admin, Messages, etc.

Full coverage in Swagger: `http://localhost:4000/api-docs`. Main routes: `/cleaner/*`, `/client/*`, `/admin/*`, `/messages/*`, `/search`, `/payments`, `/notifications`, `/holidays`, `/pricing`, `/user/*`.

---

## Related

- [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md) — Auth, contracts, roles, errors
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — "Signed out when clicking links" and other fixes
