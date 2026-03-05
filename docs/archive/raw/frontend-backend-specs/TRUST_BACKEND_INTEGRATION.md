# Trust-Fintech Backend Integration

Reference for integrating the PureTask frontend with the backend. Backend implements these requirements.

---

## 1. Backend Requirements Checklist

| Requirement | Status |
|-------------|--------|
| Serve at `http://localhost:4000` | ✓ |
| `GET /health` → 200 | ✓ |
| CORS: localhost:3000, 3001, app.puretask.com, admin.puretask.com | ✓ |
| Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS | ✓ |
| Headers: Content-Type, Authorization, x-n8n-signature | ✓ |
| `credentials: true` | ✓ |
| `POST /auth/login`, `POST /auth/register` → `{ token, user }` | ✓ |
| `GET /auth/me` with Bearer token | ✓ |
| 401 when token missing/invalid | ✓ |
| 403 for wrong role | ✓ |
| Trust: `/api/credits/*`, `/api/billing/*`, `/api/appointments/*` | ✓ |

---

## 2. Base Setup

| Item | Value |
|------|-------|
| API base URL | `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` |
| Auth header | `Authorization: Bearer <JWT>` on all protected requests |
| Job ID = Booking ID | Same — use `job.id` as `bookingId` |

---

## 3. Auth Flow

- **Register:** `POST /auth/register` — `{ email, password, role? }` → `{ token, user }`
- **Login:** `POST /auth/login` — `{ email, password }` → `{ token, user }`
- **Me:** `GET /auth/me` — requires `Authorization: Bearer <token>`

Store token (e.g. `localStorage.setItem("token", token)`) and attach to **every** API request. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for "signed out when clicking links" fix.

---

## 4. Trust Response Contracts

### GET /api/credits/balance
```json
{ "balance": 120, "currency": "USD", "lastUpdatedISO": "..." }
```

### GET /api/credits/ledger
```json
{
  "entries": [{
    "id": "uuid",
    "createdAtISO": "...",
    "type": "deposit|spend|adjustment|credit",
    "amount": 150,
    "currency": "USD",
    "description": "Credits top-up",
    "status": "posted",
    "invoiceId": "uuid|null",
    "relatedBookingId": "uuid|null"
  }]
}
```

### GET /api/billing/invoices
```json
{
  "invoices": [{
    "id": "uuid",
    "createdAtISO": "...",
    "status": "sent|paid|declined|cancelled|expired",
    "subtotal": 150,
    "tax": 0,
    "total": 150,
    "currency": "USD",
    "bookingId": "uuid|null",
    "receiptUrl": "",
    "lineItems": [],
    "paymentMethodSummary": "credits ••••"
  }]
}
```

### GET /api/appointments/:bookingId/live
```json
{
  "bookingId": "uuid",
  "state": "scheduled|en_route|arrived|checked_in|completed|cancelled",
  "etaISO": "...|null",
  "gps": [],
  "photos": [],
  "checklist": [],
  "events": []
}
```

### POST /api/appointments/:bookingId/events
Request: `{ type, note?, gps?, source? }` — Response: `{ ok: true }` or **501** for check_in/check_out (use `/tracking/:jobId/check-in` and `check-out`).

---

## 5. Role Requirements

| Endpoint | Role |
|----------|------|
| `/api/credits/*` | client |
| `/api/billing/*` | client |
| `/api/appointments/:id/live` | client or cleaner (job participant) |
| `/api/appointments/:id/events` | cleaner only |

---

## 6. Operations Not in Trust Adapter

- **Pay invoice:** `POST /client/invoices/:id/pay` — `{ payment_method: "credits"|"card" }`
- **Buy credits:** `POST /credits/checkout` — `{ packageId, successUrl, cancelUrl }`

---

## 7. Errors

| Status | Meaning |
|--------|---------|
| 401 | Missing/invalid token → redirect to login |
| 403 | Wrong role |
| 404 | Not found |
| 501 | check_in/check_out → use tracking endpoints |

---

## 8. Trust-Fintech Completion Checklist

### 1. Backend – Endpoints and response shapes ✓

| Endpoint | Contract | Status |
|----------|----------|--------|
| GET /api/credits/balance | `{ balance, currency, lastUpdatedISO }` | ✓ Implemented |
| GET /api/credits/ledger | `{ entries }` with id, createdAtISO, type, amount, etc. | ✓ |
| GET /api/billing/invoices | `{ invoices }` with Trust shape | ✓ |
| GET /api/billing/invoices/:id | Invoice + lineItems | ✓ |
| GET /api/appointments/:id/live | `{ bookingId, state, gps, photos, checklist, events }` | ✓ |
| POST /api/appointments/:id/events | `{ ok: true }` | ✓ |

**Optional (implemented):**

| Endpoint | Status |
|----------|--------|
| POST /client/invoices/:id/pay | ✓ Exists in clientInvoices |
| POST /credits/checkout | ✓ Exists in credits router |

### 2. End-to-end testing

**Automated (backend):** `npm run test -- src/tests/integration/trustAdapter.test.ts src/tests/integration/trustE2EFlow.test.ts` — 23 tests for Trust endpoints and full login → credits → billing → live flow.

**Manual flow (frontend):** Run backend (`npm run dev`), then in frontend:

1. **Login** → `POST /auth/login` → token stored → no redirect to login on nav
2. **Credits** → GET /api/credits/balance → balance shown
3. **Ledger** → GET /api/credits/ledger → entries listed
4. **Billing** → GET /api/billing/invoices → invoices listed
5. **Live appointment** → GET /api/appointments/:bookingId/live → state, events, photos

Automated E2E (Playwright, etc.) can reuse these flows.

### 3. Edge cases – Error handling

| Scenario | Backend | Frontend should |
|----------|---------|-----------------|
| No token | 401 `{ error: { code: "UNAUTHENTICATED", message } }` | Redirect to login |
| Invalid token | 401 `{ error: { code: "INVALID_TOKEN" } }` | Redirect to login |
| Wrong role (e.g. cleaner on credits) | 403 `{ error: { code: "FORBIDDEN" } }` | Show "not allowed" |
| Not found | 404 `{ message }` or `{ error }` | Show "not found" |
| Server error | 500 `{ message }` or `{ error }` | Show retry / error state |
| Empty data | 200 `{ invoices: [] }` or `{ entries: [] }` | Show "no invoices" / "no entries" |

Backend returns consistent shapes. Frontend must handle each status and render accordingly.

### 4. Optional – Pay invoice, buy credits

Both exist:

- **Pay invoice:** `POST /client/invoices/:invoiceId/pay` — body: `{ payment_method: "credits"|"card" }`
- **Buy credits:** `POST /credits/checkout` — body: `{ packageId, successUrl, cancelUrl }`

---

## 9. Related Docs

- [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) — Full endpoint list
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — Auth persistence, common issues
