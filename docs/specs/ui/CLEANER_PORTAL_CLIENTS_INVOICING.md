# Cleaner Portal: Previous Clients + Invoicing Module Spec

## Overview

A first-class tab inside the cleaner app/dashboard for managing client relationships and invoicing.

**Tab:** Cleaners → My Clients

This is **separate from Jobs** because it organizes **relationships**, not tasks.

---

## 1. Main Goals

Cleaners should be able to:

1. **View all previous clients they've serviced**
   - Pulled from: `jobs`, `job_events`, `favorite_cleaners`, `cleaner_client_notes`

2. **See relevant client information**
   - Name
   - Address(es) serviced
   - Job history & totals
   - Notes left by the cleaner
   - Ratings (future)
   - Client reliability/flexibility indicators (sanitized)

3. **Send invoices**
   - For: Extra services, add-ons, damages, time extensions, off-platform upsells
   - Integrates with: `credit_purchases`, `payment_intents`, `credit_ledger`
   - Admin review for invoices over threshold

---

## 2. My Clients Page Layout

### Header
- **Title:** My Clients
- **Subtext:** Clients you've previously cleaned for.

### Filters
| Filter | Options |
|--------|---------|
| Sort By | Most recent, Most jobs, Highest earnings, Favorites |
| Favorite Only | Toggle |
| Has Invoices | Toggle |

### Search
- Client name
- Address
- Job ID

---

## 3. Client List Fields

| Field | Description |
|-------|-------------|
| Client Name | Full name |
| Primary Address | Most frequently serviced address |
| Jobs Completed | Count + total hours |
| Last Job Date | Timestamp |
| Total Earnings | From this client (cleaner-side only) |
| Notes | Cleaner's personal notes |
| Client Indicator | "Reliable" / "Flexible" / "May need confirmation" |
| Actions | View Profile • Send Invoice |

---

## 4. Client Profile (Cleaner View)

### A. Client Overview
- Name
- Address(es)
- Jobs completed count
- Last job date
- Total time worked
- Total earnings
- "Favorite Client" toggle

### B. Job History
Chronological feed of all jobs:
- Job date
- Duration
- Size/type (Standard, Deep, Move-out, etc.)
- Photos (before/after)
- Rating (future)
- Issues (late starts, extension requests, etc.)

### C. Notes (Private to Cleaner)
- Preferences
- Pets
- Parking
- Entry instructions
- Personal reminders

Stored in: `cleaner_client_notes`

### D. Invoice Center
- Create invoice
- View previously sent invoices
- See invoice status (Paid, Pending, Declined, Expired)

---

## 5. Invoice Flow

### A. Create Invoice

**Fields:**
- Client (pre-filled)
- Job or "General"
- Line items:
  - Description
  - Qty
  - Price per unit
- Tax (auto-calculated from `INVOICE_TAX_RATE_BPS`)
- Total due

**Payment Method:** Credits or Stripe card

**Admin Approval Rule:**
- If invoice total > `INVOICE_APPROVAL_THRESHOLD_CENTS` → sent to admin for approval

### B. Invoice Delivery

1. Cleaner creates and sends invoice
2. System sends push notification + email to client
3. Creates payment intent (for card) or holds escrow (for credits)
4. Client approves/pays or declines

### C. Invoice → Credits & Ledger

When client pays:
1. Credit deduction from client wallet (or card charge)
2. Platform fee deducted (15% default)
3. Net amount → `cleaner_earnings` table
4. Included in next payout batch

---

## 6. Database Schema

### Tables

**cleaner_client_notes**
```sql
CREATE TABLE cleaner_client_notes (
  id UUID PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES users(id),
  client_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  preferences TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(cleaner_id, client_id)
);
```

**invoices**
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  cleaner_id UUID NOT NULL REFERENCES users(id),
  client_id UUID NOT NULL REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  status invoice_status NOT NULL,
  title TEXT,
  description TEXT,
  notes_to_client TEXT,
  requires_approval BOOLEAN,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  denial_reason TEXT,
  payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  paid_via TEXT,  -- 'credits' or 'card'
  due_date DATE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**invoice_line_items**
```sql
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  sort_order INTEGER
);
```

**invoice_status_history**
```sql
CREATE TABLE invoice_status_history (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  old_status invoice_status,
  new_status invoice_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  actor_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ
);
```

### Views

**cleaner_client_summary**
- Joins jobs + clients + earnings for fast retrieval
- Aggregates: jobs_completed, total_hours, total_earnings, addresses, last_job_date
- Includes client indicator (sanitized risk band)
- Includes favorite status and notes

---

## 7. API Endpoints

### Cleaner Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cleaner/clients` | List all clients with filters/pagination |
| GET | `/cleaner/clients/:clientId` | Get client profile |
| GET | `/cleaner/clients/:clientId/jobs` | Get job history with client |
| PUT | `/cleaner/clients/:clientId/notes` | Update notes/preferences |
| POST | `/cleaner/clients/:clientId/favorite` | Toggle favorite |
| POST | `/cleaner/clients/:clientId/invoices` | Create invoice |
| GET | `/cleaner/invoices` | List cleaner's invoices |
| GET | `/cleaner/invoices/:invoiceId` | Get invoice details |
| POST | `/cleaner/invoices/:invoiceId/send` | Send invoice to client |
| POST | `/cleaner/invoices/:invoiceId/cancel` | Cancel invoice |

### Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/client/invoices` | List invoices sent to client |
| GET | `/client/invoices/:invoiceId` | Get invoice details |
| POST | `/client/invoices/:invoiceId/pay` | Pay invoice (credits or card) |
| POST | `/client/invoices/:invoiceId/decline` | Decline invoice |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/invoices` | List all invoices |
| GET | `/admin/invoices/pending-approval` | List pending approval |
| GET | `/admin/invoices/:invoiceId` | Get invoice details |
| PATCH | `/admin/invoices/:invoiceId/approve` | Approve invoice |
| PATCH | `/admin/invoices/:invoiceId/deny` | Deny invoice |

---

## 8. Configuration

| Feature Flag | Default | Description |
|--------------|---------|-------------|
| `INVOICE_APPROVAL_THRESHOLD_CENTS` | 10000 ($100) | Invoices over this require admin approval |
| `INVOICE_EXPIRY_DAYS` | 30 | Days until unpaid invoice expires |
| `INVOICE_TAX_RATE_BPS` | 0 | Tax rate in basis points |

---

## 9. UX Rules

1. **Cleaners only see sanitized client indicators:**
   - "Reliable client" (normal/mild risk)
   - "Flexible" (high flexibility score)
   - "May need confirmation" (elevated risk)

2. **Invoices must look professional, minimal, and branded**

3. **Cleaners can only invoice clients they have worked with** (no cold billing)

4. **All invoice actions tracked in:**
   - `audit_logs`
   - `stripe_object_processed` (for Stripe payments)
   - `credit_ledger`

---

## 10. Invoice Status Flow

```
draft → pending_approval → sent → paid
                        ↘ declined
                        ↘ expired
      → cancelled (by cleaner at any point before paid)
```

---

## 11. Platform Fee

Default: **15%** of invoice total goes to platform

Example:
- Invoice total: $100
- Platform fee: $15
- Cleaner earnings: $85

---

## Summary

✅ Client management dashboard for cleaners
✅ Complete invoicing system compatible with PureTask credit economy
✅ New backend tables and endpoints
✅ UX flows matching existing job lifecycle and payment layers
✅ Admin approval workflow for high-value invoices

