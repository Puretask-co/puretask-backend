# Frontend → Backend Spec

Every frontend Trust hook maps to a backend endpoint. Use this as the backend implementation spec.

---

## 1. useCreditsTrust

### useCreditsBalance

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/credits/balance` |
| **Request payload** | None |
| **Response type** | `CreditsBalance` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | None (read-only) |

**Response shape:**
```ts
{
  balance: number;
  currency: 'USD';
  lastUpdatedISO: string; // ISO datetime
}
```

---

### useCreditsLedger

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/credits/ledger` |
| **Query params** | `from`, `to`, `type`, `status`, `search`, `limit` |
| **Request payload** | None |
| **Response type** | `{ entries: CreditLedgerEntry[] }` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | None (read-only) |

**Response shape:**
```ts
{
  entries: Array<{
    id: string;
    createdAtISO: string;
    type: 'deposit' | 'spend' | 'refund' | 'bonus' | 'fee';
    amount: number;
    currency: 'USD';
    description: string;
    status: 'pending' | 'posted' | 'reversed';
    relatedBookingId?: string;
    invoiceId?: string;
  }>;
}
```

---

### useBuyCredits

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/credits/checkout` |
| **Request payload** | `BuyCreditsRequest` |
| **Response type** | `BuyCreditsResponse` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | Create checkout session; return redirect URL; frontend redirects user |

**Request shape:**
```ts
{
  packageId: string;    // e.g. 'starter', 'standard', 'premium'
  successUrl: string;   // e.g. 'http://localhost:3001/client/credits-trust?success=1'
  cancelUrl: string;    // e.g. 'http://localhost:3001/client/credits-trust?cancel=1'
}
```

**Response shape (at least one of):**
```ts
{
  checkoutUrl?: string;  // URL to redirect for payment (Stripe, etc.)
  url?: string;         // Alternative field name
}
```

---

## 2. useBillingTrust

### useInvoices

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/billing/invoices` |
| **Request payload** | None |
| **Response type** | `{ invoices: Invoice[] }` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | None (read-only) |

**Response shape:**
```ts
{
  invoices: Array<{
    id: string;
    createdAtISO: string;
    status: 'draft' | 'open' | 'paid' | 'void' | 'refunded';
    subtotal: number;
    tax: number;
    total: number;
    currency: 'USD';
    bookingId?: string;
    receiptUrl?: string;
    lineItems: Array<{ id: string; label: string; quantity?: number; unitPrice?: number; amount: number }>;
    paymentMethodSummary?: string;
  }>;
}
```

---

### useInvoice

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/billing/invoices/:id` |
| **Request payload** | None |
| **Response type** | `Invoice` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | None (read-only) |

**Response shape:** Same as list item above, with full `lineItems`.

---

### usePayInvoice

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/client/invoices/:id/pay` |
| **Request payload** | `PayInvoiceRequest` |
| **Response type** | `{ ok: boolean }` |
| **Auth** | Bearer token; **client** role |
| **Side effects** | Deduct credits or charge card; update invoice status; create ledger entry (if credits); mark invoice paid |

**Request shape:**
```ts
{
  payment_method: 'credits' | 'card';
}
```

**Response shape:**
```ts
{ ok: true }
```

---

## 3. useLiveAppointmentTrust

### useLiveAppointment

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/api/appointments/:bookingId/live` |
| **Request payload** | None |
| **Response type** | `LiveAppointment` |
| **Auth** | Bearer token; **client** or **cleaner** (job participant) |
| **Side effects** | None (read-only) |

**Response shape:**
```ts
{
  bookingId: string;
  state: 'scheduled' | 'en_route' | 'arrived' | 'checked_in' | 'completed';
  etaISO?: string;
  reliability?: ReliabilityScore;
  gps: Array<{
    id: string;
    event: 'en_route' | 'arrived' | 'check_in' | 'check_out';
    atISO: string;
    lat: number;
    lng: number;
    accuracyM?: number;
    source: 'device' | 'manual_override';
  }>;
  photos: Array<{
    id: string;
    kind: 'before' | 'after';
    url: string;
    createdAtISO: string;
    uploadedBy: 'cleaner' | 'client' | 'support';
  }>;
  checklist: Array<{
    id: string;
    label: string;
    completed: boolean;
    completedAtISO?: string;
  }>;
  events: Array<{
    id: string;
    atISO: string;
    type: 'state_change' | 'gps' | 'photo' | 'checklist' | 'payment' | 'note' | 'manual_override';
    summary: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

---

### usePostAppointmentEvent

| Field | Value |
|-------|-------|
| **Method** | POST |
| **URL** | `/api/appointments/:bookingId/events` |
| **Request payload** | `AppointmentEventCreate` |
| **Response type** | `{ ok: true }` |
| **Auth** | Bearer token; **cleaner** only |
| **Side effects** | Append event; optionally update state (en_route, arrived); store GPS; for check_in/check_out may return 501 (use main tracking API) |

**Request shape:**
```ts
{
  type: 'en_route' | 'arrived' | 'check_in' | 'check_out' | 'note';
  note?: string;
  gps?: { lat: number; lng: number; accuracyM?: number };
  source?: 'device' | 'manual_override';
}
```

**Response shape:**
```ts
{ ok: true }
```

**Note:** For `check_in` / `check_out`, backend may return **501** — frontend should use main tracking API (`/tracking/:jobId/check-in`, `/tracking/:jobId/check-out`) with photos instead.

---

## 4. Reliability (reliabilityService, not Trust hooks)

Uses **axios** apiClient, not fetch apiClient. Endpoint is part of main PureTask API.

### getCleanerReliability

| Field | Value |
|-------|-------|
| **Method** | GET |
| **URL** | `/cleaners/:cleanerId/reliability` |
| **Request payload** | None |
| **Response type** | `{ reliability: ReliabilityScore }` |
| **Auth** | Bearer token; **client** (viewing cleaner profile) |
| **Side effects** | None (read-only) |

**Response shape:**
```ts
{
  reliability: {
    score: number;        // 0–100
    tier: 'Excellent' | 'Good' | 'Watch' | 'Risk';
    breakdown: {
      onTimePct: number;
      completionPct: number;
      cancellationPct: number;  // lower is better
      communicationPct: number;
      qualityPct: number;
    };
    explainers: string[];
    lastUpdatedISO: string;
  };
}
```

---

## Summary Table

| Hook / Service | Method | URL | Auth role | Side effects |
|----------------|--------|-----|-----------|--------------|
| useCreditsBalance | GET | `/api/credits/balance` | client | — |
| useCreditsLedger | GET | `/api/credits/ledger` | client | — |
| useBuyCredits | POST | `/credits/checkout` | client | Create checkout session |
| useInvoices | GET | `/api/billing/invoices` | client | — |
| useInvoice | GET | `/api/billing/invoices/:id` | client | — |
| usePayInvoice | POST | `/client/invoices/:id/pay` | client | Pay invoice, ledger entry |
| useLiveAppointment | GET | `/api/appointments/:bookingId/live` | client or cleaner | — |
| usePostAppointmentEvent | POST | `/api/appointments/:bookingId/events` | cleaner | Append event, state update |
| reliabilityService.getCleanerReliability | GET | `/cleaners/:cleanerId/reliability` | client | — |

---

## Related Docs

- [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md) — Auth, errors, CORS, env
- [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) — Full endpoint list
