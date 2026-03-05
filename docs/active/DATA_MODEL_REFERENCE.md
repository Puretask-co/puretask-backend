# Data Model Reference: Job, Cleaner, Payment

Single reference for DB schemas, TypeScript types, API response shapes, and retrieval queries for Job details and related entities.

---

## A) DB schemas / SQL table definitions

There is **no Prisma** in this repo; the app uses raw SQL and `src/db/client` (e.g. `query()`). Tables are created in `DB/migrations/` (e.g. `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`, `001_init.sql`).

### Enums (used by tables below)

```sql
CREATE TYPE user_role AS ENUM ('client', 'cleaner', 'admin');
CREATE TYPE job_status AS ENUM (
  'requested', 'accepted', 'on_my_way', 'in_progress',
  'awaiting_approval', 'completed', 'disputed', 'cancelled'
);
CREATE TYPE credit_reason AS ENUM (
  'purchase', 'wallet_topup', 'job_escrow', 'job_release', 'refund', 'adjustment'
);
CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved_refund', 'resolved_no_refund');
```

### Users (base for Client/Cleaner)

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'client',
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  referral_code   TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

(Additional columns exist in consolidated schema: email_verified, password_reset_*, two_factor_*, last_login_at, etc.)

### Cleaner (users + cleaner_profiles)

```sql
CREATE TABLE IF NOT EXISTS cleaner_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name               TEXT,
  last_name                TEXT,
  bio                      TEXT,
  tier                     TEXT NOT NULL DEFAULT 'bronze',
  reliability_score        NUMERIC(5,2) NOT NULL DEFAULT 100.0,
  reliability_last_computed TIMESTAMPTZ,
  hourly_rate_credits      INTEGER NOT NULL DEFAULT 0,
  base_rate_cph            NUMERIC(10,2),
  deep_addon_cph           NUMERIC(10,2),
  moveout_addon_cph        NUMERIC(10,2),
  avg_rating               NUMERIC(3,2),
  jobs_completed           INTEGER NOT NULL DEFAULT 0,
  low_flexibility_badge    BOOLEAN NOT NULL DEFAULT false,
  payout_percent           NUMERIC(5,2) DEFAULT 80,
  stripe_connect_id        TEXT,
  stripe_account_id        TEXT,
  latitude                 NUMERIC(9,6),
  longitude                NUMERIC(9,6),
  is_available             BOOLEAN DEFAULT true,
  travel_radius_km         NUMERIC(5,2) DEFAULT 50,
  max_jobs_per_day         INTEGER DEFAULT 5,
  accepts_high_risk        BOOLEAN DEFAULT false,
  minimum_payout_cents      INTEGER DEFAULT 2500,
  payout_schedule          TEXT DEFAULT 'weekly',
  instant_payout_enabled   BOOLEAN DEFAULT false,
  background_check_required BOOLEAN DEFAULT true,
  background_check_status   TEXT DEFAULT 'not_started',
  push_token               TEXT,
  onboarding_current_step  TEXT DEFAULT 'terms',
  onboarding_reminder_sent_at TIMESTAMPTZ,
  onboarding_started_at     TIMESTAMPTZ DEFAULT now(),
  onboarding_completed_at   TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- avatar_url may be added in later migrations
```

### Job

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  cleaner_id              TEXT REFERENCES users (id) ON DELETE SET NULL,
  property_id             INT REFERENCES properties(id),
  address_id              UUID REFERENCES addresses(id),
  team_id                 INT REFERENCES cleaner_teams(id),
  status                  job_status NOT NULL DEFAULT 'requested',
  scheduled_start_at      TIMESTAMPTZ NOT NULL,
  scheduled_end_at        TIMESTAMPTZ NOT NULL,
  actual_start_at         TIMESTAMPTZ,
  actual_end_at           TIMESTAMPTZ,
  address                 TEXT NOT NULL,
  latitude                NUMERIC(9,6),
  longitude               NUMERIC(9,6),
  credit_amount           INTEGER NOT NULL,
  cleaning_type           TEXT,
  duration_hours          NUMERIC(4,2),
  price_credits           INTEGER,
  held_credits            INTEGER DEFAULT 0,
  rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),
  client_notes            TEXT,
  notes_client            TEXT,
  notes_cleaner           TEXT,
  cleaner_payout_amount_cents INTEGER,
  is_rush                 BOOLEAN DEFAULT false,
  rush_fee_credits        INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Payment / credits

**Credit ledger** (source of truth for credit movements; job-related entries have `job_id` set):

```sql
CREATE TABLE IF NOT EXISTS credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  delta_credits   INTEGER NOT NULL,
  reason          credit_reason NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Payment intents** (Stripe; job charge or wallet top-up):

```sql
CREATE TABLE IF NOT EXISTS payment_intents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                      UUID REFERENCES jobs (id) ON DELETE SET NULL,
  client_id                   TEXT REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_intent_id    TEXT NOT NULL UNIQUE,
  status                      TEXT NOT NULL,
  amount_cents                INTEGER NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'usd',
  purpose                     TEXT NOT NULL DEFAULT 'wallet_topup',  -- 'wallet_topup' | 'job_charge'
  credits_amount              INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Payouts** (cleaner earnings paid out):

```sql
CREATE TABLE IF NOT EXISTS payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id          TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  job_id             UUID REFERENCES jobs(id),
  stripe_transfer_id  TEXT,
  amount_credits     INTEGER NOT NULL,
  amount_cents       INTEGER NOT NULL,
  total_usd          NUMERIC(10,2),
  status             payout_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## B) TypeScript types / interfaces

### From `src/types/db.ts` (canonical for DB rows)

```ts
// Job (matches jobs table)
export type JobStatus =
  | "requested" | "accepted" | "on_my_way" | "in_progress"
  | "awaiting_approval" | "completed" | "disputed" | "cancelled";

export interface Job {
  id: string;
  client_id: string;
  cleaner_id: string | null;
  address_id: string | null;
  status: JobStatus;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  credit_amount: number;
  cleaning_type: CleaningType | null;  // "basic" | "deep" | "move_out" | "recurring"
  duration_hours: number | null;
  price_credits: number | null;
  held_credits: number;
  cleaner_payout_amount_cents: number | null;
  rating: number | null;
  client_notes: string | null;
  notes_cleaner: string | null;
  created_at: string;
  updated_at: string;
}

// Cleaner profile (matches cleaner_profiles table)
export interface CleanerProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  tier: string;
  reliability_score: number;
  hourly_rate_credits: number;
  base_rate_cph: number | null;
  deep_addon_cph: number | null;
  moveout_addon_cph: number | null;
  avg_rating: number | null;
  jobs_completed: number;
  latitude: number | null;
  longitude: number | null;
  is_available: boolean;
  travel_radius_km: number | null;
  stripe_connect_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
  // ... more fields
}

// Credit ledger entry
export type CreditReason =
  | "purchase" | "subscription_credit" | "job_escrow" | "job_release"
  | "refund" | "adjustment" | "invoice_payment";

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  delta_credits: number;
  reason: CreditReason;
  created_at: string;
}

// Payment intent
export interface PaymentIntent {
  id: string;
  job_id: string | null;
  client_id: string | null;
  stripe_payment_intent_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  purpose: "wallet_topup" | "job_charge";
  credits_amount: number | null;
  created_at: string;
  updated_at: string;
}

// Payout
export interface Payout {
  id: string;
  cleaner_id: string;
  job_id: string;
  stripe_transfer_id: string | null;
  amount_credits: number;
  amount_cents: number;
  total_usd: number;
  status: PayoutStatus;
  created_at: string;
  updated_at: string;
}
```

### From `src/core/types.ts` (core domain; some use numeric ids)

```ts
export interface Job {
  id: number;
  clientId: number;
  cleanerId: number;
  startTime: Date;
  endTime: Date;
  heldCredits: number;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface Cleaner {
  id: number;
  reliabilityScore: number;
  reliabilityTier: "Developing" | "Semi Pro" | "Pro" | "Elite";
  flexibilityStatus: "normal" | "low_flex";
  flexibilityBadgeActive: boolean;
}
```

### Other relevant types

- **User** (`src/types/db.ts`): `id`, `email`, `role`, `first_name`, `last_name`, etc.
- **JobWithDetails** (`src/types/db.ts`): extends `Job` with optional `client_email`, `cleaner_email`.
- **JobPhoto** (`src/types/db.ts`, `src/services/photosService.ts`): `id`, `job_id`, `uploaded_by`, `type`, `url`, etc.
- **CleanerEarning** (`src/types/db.ts`): cleaner_earnings table.

---

## C) API responses (example JSON)

### GET /jobs/:jobId

**Response:** `200 OK`  
**Wrapper:** `sendSuccess(res, { job })` → body is `{ data: { job } }`.

```json
{
  "data": {
    "job": {
      "id": "uuid",
      "client_id": "user-id",
      "cleaner_id": "user-id-or-null",
      "address_id": null,
      "status": "requested",
      "scheduled_start_at": "2025-02-10T09:00:00.000Z",
      "scheduled_end_at": "2025-02-10T11:00:00.000Z",
      "actual_start_at": null,
      "actual_end_at": null,
      "address": "123 Main St, City, ST 12345",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "credit_amount": 100,
      "cleaning_type": "basic",
      "duration_hours": 2,
      "price_credits": 100,
      "held_credits": 0,
      "cleaner_payout_amount_cents": null,
      "rating": null,
      "client_notes": null,
      "notes_cleaner": null,
      "created_at": "2025-02-09T12:00:00.000Z",
      "updated_at": "2025-02-09T12:00:00.000Z"
    }
  }
}
```

404: `{ "error": { "code": "NOT_FOUND", "message": "Job not found" } }`.  
403: forbidden if not client/cleaner/admin for that job.

---

### GET /cleaners/:id

**Response:** `200 OK`  
**Body:** `{ cleaner }` (no `data` wrapper in dashboardStubs; other routers may use `data`).

```json
{
  "cleaner": {
    "id": "user-uuid",
    "email": "cleaner@example.com",
    "name": "Jane Doe",
    "avatar_url": null,
    "bio": "Professional cleaner.",
    "base_rate_cph": 25.00,
    "level": 3,
    "badges": [
      { "id": "badge-uuid", "name": "On Time", "icon": "clock" }
    ]
  }
}
```

404: `{ "error": { "code": "NOT_FOUND", "message": "Cleaner not found" } }`.

---

### GET /payments/history

**Query:** `?purpose=wallet_topup|job_charge&limit=50`  
**Response:** list of payment intents for current user; each item can have `jobId`.

```json
{
  "payments": [
    {
      "id": "pi-uuid",
      "purpose": "job_charge",
      "status": "succeeded",
      "amountCents": 5000,
      "amountFormatted": "$50.00",
      "credits": 100,
      "jobId": "job-uuid",
      "createdAt": "2025-02-09T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

There is **no** dedicated `GET /payments?jobId=...` endpoint. To get “payment/ledger for a job” use the service/query below.

---

### POST /payments/job/:jobId (create job charge)

**Response:** payment intent + pricing breakdown.

```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "jobId": "job-uuid",
  "credits": 100,
  "baseAmountCents": 5000,
  "surchargePercent": 5,
  "surchargeAmountCents": 250,
  "totalAmountCents": 5250,
  "totalAmountFormatted": "$52.50",
  "pricingNote": "Includes 5% convenience fee. Use wallet credits to save!"
}
```

---

### GET /payments/balance

```json
{
  "balance": 250,
  "balanceFormatted": "250 credits",
  "valueInCents": 12500,
  "valueFormatted": "$125.00"
}
```

---

## D) Exact retrieval queries for “Job details” page

Conceptually, to power a Job details page you need:

1. **Job by id**  
   - **Query:** `SELECT * FROM jobs WHERE id = $1`  
   - **Service:** `getJob(jobId)` or `getJobById(jobId)` in `src/services/jobsService.ts`.

2. **Cleaner by job.cleaner_id**  
   - **Query:**  
     - User: `SELECT * FROM users WHERE id = $1`  
     - Profile: `SELECT * FROM cleaner_profiles WHERE user_id = $1`  
   - **API:** `GET /cleaners/:id` (id = `job.cleaner_id`) returns combined profile + level + badges.  
   - **Service:** no single “getCleaner(cleanerId)” in one place; dashboardStubs does ad‑hoc query + level + badges.

3. **Payment / ledger by job.id**  
   - **Credit ledger entries for job:**  
     - **Query:** `SELECT * FROM credit_ledger WHERE job_id = $1 ORDER BY created_at ASC`  
     - **Service:** `getJobCreditEntries(jobId)` in `src/services/creditsService.ts`.  
   - **Payment intents for job:**  
     - **Query:** `SELECT * FROM payment_intents WHERE job_id = $1 AND purpose = 'job_charge'`  
     - **Stripe:** `GET /stripe/payment-intent/:jobId` (in `src/routes/stripe.ts`) returns payment intent for that job.

4. **Cleaner last location (optional)**  
   - **Source:** `jobs` has `latitude`, `longitude` for the **job address**.  
   - **Cleaner’s current location** is not in a separate “last_location” table in the main schema; it may come from:  
     - Check-in/tracking events (e.g. `job_events` or tracking payload with lat/lng), or  
     - `cleaner_profiles.latitude` / `cleaner_profiles.longitude` (home/base), not live GPS.  
   - So “cleaner last location” for a given job would be: either the latest check-in/tracking event for that job (if stored), or N/A if only base location is stored.

### Summary: queries to run for Job details page

| Data            | Query / service / endpoint |
|-----------------|----------------------------|
| Job by id       | `SELECT * FROM jobs WHERE id = $1` or `getJob(jobId)` |
| Cleaner         | `GET /cleaners/:id` with `id = job.cleaner_id`, or join `users` + `cleaner_profiles` on `user_id = job.cleaner_id` |
| Ledger for job  | `SELECT * FROM credit_ledger WHERE job_id = $1 ORDER BY created_at ASC` or `getJobCreditEntries(jobId)` |
| Payment for job | `SELECT * FROM payment_intents WHERE job_id = $1` and/or `GET /stripe/payment-intent/:jobId` |
| Cleaner location| Job address: `jobs.latitude`, `jobs.longitude`. Live cleaner location: from tracking/check-in events if persisted; otherwise `cleaner_profiles.latitude/longitude` (base). |

---

## E) Frontend animation checklist — exact fields to retrieve

This section maps the “data audit” spec (Living Hero, Trust Visualization, Map + Presence, Interactive Cards, Task Builder) to PureTask’s current models and where to get each field. Use it to wire animations with **zero or minimal** backend changes.

### Status mapping (for Timeline Rail + Ledger Flow)

| Spec / UI value | PureTask field | Notes |
|-----------------|----------------|--------|
| **Job timeline** | | |
| `booked` | `job.status = 'requested'` or `'accepted'` | Map both to “Booked” if you want one step. |
| `on_route` | `job.status = 'on_my_way'` | ✅ Direct. |
| `working` | `job.status = 'in_progress'` or `'awaiting_approval'` | ✅ Direct. |
| `completed` | `job.status = 'completed'` | ✅ Direct. |
| `cancelled` | `job.status = 'cancelled'` | ✅ Direct. |
| `pending_payment` | No single status | Derive: job exists, no `job_release` ledger yet for that job. |
| **Ledger flow** | | |
| `pending` | Ledger: `reason = 'job_escrow'` (credits held) | ✅ Use `credit_ledger` entries for job. |
| `moving` | Ledger: `reason = 'job_release'` (credits released to cleaner) | ✅ Same. |
| `settled` | Payout exists: `payouts` row for job with `status = 'paid'` | ✅ Optional; or treat `job_release` as settled. |

---

### 1) Job model — required fields to retrieve

| Spec field | PureTask source | Where to get it | Status |
|------------|-----------------|-----------------|--------|
| **Identity** | | | |
| `job.id` | `jobs.id` | GET /jobs/:jobId → `data.job.id` | ✅ |
| `job.publicId` / `job.jobNumber` | Not stored | — | ⚠️ Optional: use `job.id` (UUID) or truncate for display. |
| **Status (timeline rail)** | | | |
| `job.status` | `jobs.status` | GET /jobs/:jobId → `data.job.status` | ✅ |
| (Values: booked / on_route / working / completed) | Map above | Frontend map: requested/accepted→booked, on_my_way→on_route, in_progress/awaiting_approval→working, completed→completed | ✅ |
| **Schedule** | | | |
| `job.scheduledStartAt` | `jobs.scheduled_start_at` | GET /jobs/:jobId → `data.job.scheduled_start_at` | ✅ |
| `job.scheduledEndAt` | `jobs.scheduled_end_at` | Same → `data.job.scheduled_end_at` | ✅ |
| `job.estimatedDurationMins` | Derive from (end − start) or `jobs.duration_hours` | `duration_hours * 60` if set | ✅ |
| **Location (presence + map)** | | | |
| `job.location.latitude` | `jobs.latitude` | `data.job.latitude` | ✅ |
| `job.location.longitude` | `jobs.longitude` | `data.job.longitude` | ✅ |
| `job.location.addressLine1` / formatted | `jobs.address` | `data.job.address` | ✅ (single string) |
| `job.location.city` / state / postalCode | Not on job | In `addresses` or `properties` if you use them; else parse or leave blank | ⚠️ Optional |
| **Service details** | | | |
| `job.serviceType` | `jobs.cleaning_type` | `data.job.cleaning_type` (basic, deep, move_out, recurring) | ✅ |
| `job.serviceAddOns[]` | Not stored as array | — | ⚠️ Optional; could derive from rush: `is_rush`, `rush_fee_credits`. |
| `job.instructions` | `jobs.client_notes` | `data.job.client_notes` | ✅ |
| `job.homeSize` / bedrooms / bathrooms | Not on job | On `properties` if job has `property_id` | ⚠️ Optional |
| **Assignment** | | | |
| `job.cleanerId` | `jobs.cleaner_id` | `data.job.cleaner_id` | ✅ |
| `job.assignedAt` | Not stored | — | ⚠️ Optional; could use first `job_events` with type like job_accepted. |
| `job.customerId` | `jobs.client_id` | `data.job.client_id` | ✅ |
| **Proof / media** | | | |
| `job.beforePhotos[]` | `job_photos` where `type = 'before'` | GET job details or `SELECT type, url FROM job_photos WHERE job_id = $1`; split by type | ✅ |
| `job.afterPhotos[]` | `job_photos` where `type = 'after'` | Same | ✅ |
| `job.checkInAt` | Latest `job_checkins` where `type = 'check_in'` | `SELECT created_at FROM job_checkins WHERE job_id = $1 AND type = 'check_in' ORDER BY created_at DESC LIMIT 1` | ✅ |
| `job.checkOutAt` | Latest `job_checkins` where `type = 'check_out'` | Same, `type = 'check_out'` | ✅ |
| **Presence / progress** | | | |
| `job.startedAt` | `jobs.actual_start_at` | `data.job.actual_start_at` | ✅ |
| `job.completedAt` | `jobs.actual_end_at` | `data.job.actual_end_at` | ✅ |
| `job.checkInStatus` | Derive from `job_checkins` | Exists check-in row for job → checked_in | ✅ |
| `job.currentPhase` | Derive from `job.status` | Same as timeline mapping | ✅ |

**Exact retrieval for Job (single source):**

- **Endpoint:** `GET /jobs/:jobId`  
- **Response:** `{ data: { job } }` with all `jobs` columns (id, client_id, cleaner_id, status, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, address, latitude, longitude, credit_amount, cleaning_type, duration_hours, client_notes, …).

**Extra queries if you need them:**

- Before/after photos: `SELECT type, url FROM job_photos WHERE job_id = $1`.
- Check-in/check-out times: `SELECT type, created_at, lat, lng FROM job_checkins WHERE job_id = $1 ORDER BY created_at ASC`.

---

### 2) Cleaner model — required fields to retrieve

| Spec field | PureTask source | Where to get it | Status |
|------------|-----------------|-----------------|--------|
| **Identity + display** | | | |
| `cleaner.id` | `users.id` (cleaner) | GET /cleaners/:id → `cleaner.id` | ✅ |
| `cleaner.displayName` | `cleaner_profiles.first_name` + `last_name` or `users.email` | GET /cleaners/:id → `cleaner.name` | ✅ |
| `cleaner.profilePhotoUrl` | `cleaner_profiles.avatar_url` (if present) | `cleaner.avatar_url` from GET /cleaners/:id | ✅ (if column exists) |
| `cleaner.bio` | `cleaner_profiles.bio` | `cleaner.bio` | ✅ |
| **Reliability (Reliability Ring)** | | | |
| `cleaner.reliabilityScore` (0–100) | `cleaner_profiles.reliability_score` | Not in GET /cleaners/:id currently; need to add or use another endpoint | ⚙️ Add to GET /cleaners/:id or GET /cleaner/me |
| Option B signals | `avg_rating`, `jobs_completed` | `cleaner_profiles.avg_rating`, `jobs_completed` | ✅ Available in DB; can compute client-side if needed |
| **Availability** | | | |
| `cleaner.isActive` | `cleaner_profiles.is_available` | From profile query | ✅ (expose if needed) |
| `cleaner.serviceAreas[]` | `cleaner_service_areas` | Separate table; optional for Task Builder | ⚠️ Optional |
| **Presence (Map + approach dot)** | | | |
| `cleaner.lastLatitude` | No column on cleaner | Use **latest `job_events`** for this job: `event_type = 'cleaner.location_updated'`, `payload.latitude/longitude` | ✅ See below |
| `cleaner.lastLongitude` | Same | Same | ✅ |
| `cleaner.lastLocationAt` | Same | `job_events.created_at` of that event | ✅ |
| `cleaner.isOnRoute` | Derive | `job.status === 'on_my_way'` for assigned job | ✅ |
| `cleaner.etaMinutes` | Optional | `jobTrackingService` has simple ETA from distance; no dedicated API | ⚠️ Phase 2 |
| **Recent jobs (interactive cards)** | | | |
| `cleaner.recentJobs[]` | `jobs` where `cleaner_id = id` AND status = completed | No endpoint; query: `SELECT id, cleaning_type, actual_end_at FROM jobs WHERE cleaner_id = $1 AND status = 'completed' ORDER BY actual_end_at DESC LIMIT 3` | ⚙️ Optional; add GET /cleaners/:id/recent-jobs or include in profile |

**Exact retrieval for Cleaner:**

- **Endpoint:** `GET /cleaners/:id`  
- **Returns:** id, email, name, avatar_url, bio, base_rate_cph, level, badges.  
- **Missing for animations:** `reliability_score`. Add to response (e.g. from `cleaner_profiles.reliability_score`) for the Reliability Ring.

**Cleaner “last position” for a given job (approach dot):**

- **Option A (recommended):** Use the **tracking/live endpoint** if you have one that returns cleaner location for the job (e.g. from `job_events`).
- **Option B:** Query:  
  `SELECT payload, created_at FROM job_events WHERE job_id = $1 AND event_type = 'cleaner.location_updated' ORDER BY created_at DESC LIMIT 1`  
  Then read `payload.latitude`, `payload.longitude`, `created_at` as lastLocationAt.
- **Fallback:** Use `cleaner_profiles.latitude`, `cleaner_profiles.longitude` (base/home), not live.

---

### 3) Payment / ledger model — required fields to retrieve

| Spec field | PureTask source | Where to get it | Status |
|------------|-----------------|-----------------|--------|
| **Identity** | | | |
| `payment.id` | `payment_intents.id` or `credit_ledger.id` | By job: `SELECT * FROM payment_intents WHERE job_id = $1`; ledger: `getJobCreditEntries(jobId)` | ✅ |
| `payment.jobId` | `payment_intents.job_id` / `credit_ledger.job_id` | In row | ✅ |
| `payment.customerId` | `payment_intents.client_id` / `credit_ledger.user_id` | In row | ✅ |
| `payment.cleanerId` | From job | `jobs.cleaner_id` | ✅ |
| **Amounts** | | | |
| `payment.amountCents` | `payment_intents.amount_cents` | payment_intents row | ✅ |
| `payment.platformFeeCents` | Derive | (amount − cleaner_payout) if you store payout | ⚠️ Optional |
| `payment.cleanerPayoutCents` | `jobs.cleaner_payout_amount_cents` | From job row | ✅ |
| `payment.currency` | `payment_intents.currency` | In row | ✅ |
| **Ledger state (Credit Ledger Flow)** | | | |
| pending | `credit_ledger.reason = 'job_escrow'` (negative delta = held) | `getJobCreditEntries(jobId)` | ✅ |
| moving | `credit_ledger.reason = 'job_release'` (credits to cleaner) | Same | ✅ |
| settled | Payout row for job: `payouts.status = 'paid'` | `SELECT * FROM payouts WHERE job_id = $1` | ✅ |
| **Raw status** | `payment_intents.status` (Stripe) | requires_payment_method, succeeded, etc. | ✅ |
| **Timestamps** | | | |
| `payment.authorizedAt` | Not explicit | Ledger `created_at` for job_escrow | ✅ |
| `payment.capturedAt` | Not explicit | Ledger `created_at` for job_release | ✅ |
| `payment.payoutSettledAt` | `payouts.updated_at` when status = paid | From payouts table | ✅ |
| **Provider** | `payment_intents.stripe_payment_intent_id` | In row | ✅ |

**Exact retrieval for payment/ledger by job:**

1. **Credit ledger entries (for “pending → moving → settled” animation):**  
   - **Service:** `getJobCreditEntries(jobId)` in `src/services/creditsService.ts`.  
   - **Query:** `SELECT id, user_id, job_id, delta_credits, reason, created_at FROM credit_ledger WHERE job_id = $1 ORDER BY created_at ASC`.

2. **Payment intent for job (Stripe):**  
   - **Endpoint:** `GET /stripe/payment-intent/:jobId`  
   - **Query:** `SELECT * FROM payment_intents WHERE job_id = $1 AND purpose = 'job_charge'` (or use existing route).

3. **Payout (optional, for “settled”):**  
   - **Query:** `SELECT id, job_id, amount_cents, status, created_at, updated_at FROM payouts WHERE job_id = $1`.

**Mapping ledger reason → UI state:**

- `job_escrow` (negative delta) → **pending** (credits held).
- `job_release` (positive delta to cleaner) → **moving** or **settled** (depending on whether you show payout as separate step).
- Payout `status = 'paid'` → **settled**.

---

### 4) One-page summary: what to retrieve for full-fidelity animations

| Component | Data | Where |
|-----------|------|--------|
| **Job timeline** | job.id, job.status, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at | GET /jobs/:jobId |
| **Reliability ring** | cleaner.reliabilityScore (0–100) | Add to GET /cleaners/:id from `cleaner_profiles.reliability_score` |
| **Ledger flow** | credit_ledger rows for job (reason, delta_credits, created_at) | getJobCreditEntries(jobId) or new GET /jobs/:jobId/ledger |
| **Map + approach** | job.latitude, job.longitude (job address); cleaner last lat/lng from job_events `cleaner.location_updated` | Job from GET /jobs/:jobId; location from job_events query or tracking API |
| **Interactive cards** | cleaner name, photo, bio, level, badges; optional recent jobs + before/after | GET /cleaners/:id; job_photos for job; optional recent-jobs |
| **Task builder** | services, availability, cleaner list, booking | Existing endpoints; no new fields |

**Backend changes that are useful (all small):**

1. **GET /cleaners/:id** — Include `reliability_score` (and optionally `reliability_last_computed`) in the response so the Reliability Ring works without a second request.
2. **Optional:** GET /jobs/:jobId that includes `beforePhotos` / `afterPhotos` arrays and/or `checkInAt` / `checkOutAt` so the frontend doesn’t need extra photo/checkin queries (or keep separate photo/checkin queries as today).
3. **Optional:** GET /jobs/:jobId/ledger (or GET /payments?jobId=…) that returns credit_ledger entries + payment intent + payout summary for that job so the Ledger Flow has one call.

Everything else in the checklist either already exists in the schema/APIs or can be derived from the retrievals above.

---

## F) Backend routes and services — where data is fetched

This section maps **what data you have** to **where it is fetched**: route handlers, services, and queries. Use it to see how job, cleaner, ledger, photos, check-ins, and payment data are actually returned.

### 1) Job (single job by id)

| What | Where | How |
|------|--------|-----|
| **GET /jobs/:jobId** | `src/routes/jobs.ts` | Route: `GET "/:jobId"`, middleware: `requireOwnership("job", "jobId")`. Calls `getJob(jobId)` from `src/services/jobsService.ts`. |
| **Service** | `src/services/jobsService.ts` | `getJob(jobId)`: `SELECT * FROM jobs WHERE id = $1`; returns `Job \| null`. `getJobById(jobId)` throws 404 if missing. |
| **Response** | — | `sendSuccess(res, { job })` → `{ data: { job } }` with full `Job` row (id, client_id, cleaner_id, status, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, address, latitude, longitude, credit_amount, cleaning_type, etc.). |

**GET /jobs/:jobId/details** (single-call Job Details UI):

- **Where:** `src/routes/jobs.ts`, route `GET "/:jobId/details"`, same ownership.
- **Returns:** `{ data: { job, cleaner, checkins, photos, ledgerEntries, paymentIntent, payout } }`.
- **How:** One `getJob(jobId)` plus parallel queries: `cleaner_profiles` (if cleaner_id), `job_checkins`, `job_photos`, `getJobCreditEntries(jobId)`, `payment_intents` (job_charge), `payouts` — all by `job_id`.

---

### 2) Cleaners (GET /cleaners/:id)

| What | Where | How |
|------|--------|-----|
| **GET /cleaners/:id** | `src/routes/dashboardStubs.ts` | Router: `cleanersRouter`, route: `GET "/:id"`. `requireAuth` + `authedHandler`. |
| **Query** | In handler | `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph, cp.reliability_score, cp.tier, cp.avg_rating, cp.jobs_completed FROM users u LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id WHERE u.id = $1 AND u.role = 'cleaner'`. Then optional: `cleaner_level_progress` (level), `cleaner_badges` + `badge_definitions` (badges). |
| **Response** | — | `{ cleaner }` (no `data` wrapper): id, email, name, avatar_url, bio, base_rate_cph, reliability_score, tier, avg_rating, jobs_completed, level, badges. |

**Other cleaner routes (for reference):**

- **GET /admin/cleaners/:id** — `src/routes/admin/cleaners.ts` (admin only, richer profile).
- **GET /api/cleaners/:cleanerId/reliability** — `src/routes/trustAdapter.ts` (Trust API; returns reliability for a cleaner).

---

### 3) Credit ledger (by job)

| What | Where | How |
|------|--------|-----|
| **Service** | `src/services/creditsService.ts` | `getJobCreditEntries(jobId): Promise<CreditLedgerEntry[]>` |
| **Query** | In service | `SELECT * FROM credit_ledger WHERE job_id = $1 ORDER BY created_at ASC` |
| **Type** | `src/types/db.ts` | `CreditLedgerEntry`: id, user_id, job_id, delta_credits, reason, created_at. `CreditReason`: purchase, wallet_topup, job_escrow, job_release, refund, adjustment. |
| **Exposed by** | — | No standalone GET-by-job route. Returned inside **GET /jobs/:jobId/details** as `ledgerEntries`. |

---

### 4) Job photos

| What | Where | How |
|------|--------|-----|
| **Service** | `src/services/photosService.ts` | `addJobPhoto(input)` — INSERT into `job_photos`. `listJobPhotos(jobId)` — SELECT by job_id, order type ASC, created_at ASC. `getJobPhotosByType(jobId, type)`, `getPhotoById(photoId)`, `deleteJobPhoto(photoId, userId, isAdmin)`. |
| **Query (list)** | In service | `SELECT * FROM job_photos WHERE job_id = $1 ORDER BY type ASC, created_at ASC` |
| **Route (create)** | `src/routes/jobs.ts` | `POST /jobs/:jobId/photos` — body: `{ type: "before" \| "after", photoUrl }`. Calls `addJobPhoto()`. Cleaner only, `requireOwnership("job", "jobId")`. |
| **Route (read)** | — | No dedicated GET /jobs/:jobId/photos. Photos for a job are returned inside **GET /jobs/:jobId/details** as `photos` (id, job_id, uploaded_by, type, url, thumbnail_url, created_at). |
| **Type** | `src/types/db.ts` + `src/services/photosService.ts` | `JobPhoto`: id, job_id, uploaded_by, type, url, thumbnail_url, file_size, mime_type, metadata, created_at. |

**Also used:** `jobTrackingService.checkIn()` inserts into `job_photos` (before) and `checkOut()` inserts after photos; trustAdapter and adminService query `job_photos` by job_id for Trust/ops views.

---

### 5) Job check-ins (job_checkins table)

| What | Where | How |
|------|--------|-----|
| **Table** | `job_checkins` | id, job_id, cleaner_id, type ('check_in' \| 'check_out'), lat, lng, distance_from_job_meters, is_within_radius, device_info, created_at. |
| **Read** | `src/routes/jobs.ts` (GET /jobs/:jobId/details) | Inline query: `SELECT id, job_id, cleaner_id, type, lat, lng, distance_from_job_meters, is_within_radius, created_at FROM job_checkins WHERE job_id = $1 ORDER BY created_at ASC`. Returned as `checkins`. |
| **Write** | — | No `INSERT INTO job_checkins` in current codebase. Table is used by metrics/level logic (e.g. `src/lib/metricsCalculator.ts`, `src/services/cleanerLevelService.ts`). Tracking flow uses `job_events` and job status updates; if you add check-in persistence, this is the table and shape to use. |
| **Type** | `src/types/db.ts` | `JobCheckin`: id, job_id, cleaner_id, type, lat, lng, distance_from_job_meters, is_within_radius, device_info, created_at. |

**Tracking API (status + location, not job_checkins rows):** `src/routes/tracking.ts` — GET /tracking/:jobId returns `getJobTrackingState(jobId)` from `src/services/jobTrackingService.ts` (job, timeline from `job_events`, photos, cleaner, currentLocation from latest `cleaner.location_updated` event). POST /tracking/:jobId/en-route, /arrived, /check-in, /check-out call `jobTrackingService` (startEnRoute, markArrived, checkIn, checkOut); those handlers update job status and publish events; they do not currently write to `job_checkins`.

---

### 6) Payment intent (by job)

| What | Where | How |
|------|--------|-----|
| **Service** | `src/services/paymentService.ts` | `getPaymentIntentByJobId(jobId): Promise<PaymentIntent \| null>` |
| **Query** | In service | `SELECT * FROM payment_intents WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1` (no purpose filter in service; route may filter). |
| **Route** | `src/routes/stripe.ts` | `GET /stripe/payment-intent/:jobId` — `requireAuth`, `requireOwnership("job", "jobId")`. Calls `getPaymentIntentByJobId(jobId)`; returns `{ paymentIntent }` or 404. Verifies client_id or admin. |
| **Also** | `src/routes/jobs.ts` (GET /jobs/:jobId/details) | Inline query: `SELECT ... FROM payment_intents WHERE job_id = $1 AND purpose = 'job_charge' ORDER BY created_at DESC LIMIT 1` as `paymentIntent`. |
| **Type** | `src/types/db.ts` | `PaymentIntent`: id, job_id, client_id, stripe_payment_intent_id, status, amount_cents, currency, purpose, credits_amount, created_at, updated_at. |

**Create:** `src/routes/payments.ts` — `POST /payments/job/:jobId` creates job_charge payment intent via `createJobPaymentIntent` in `paymentService`.

---

### 7) Payout (by job)

| What | Where | How |
|------|--------|-----|
| **Service** | `src/services/payoutsService.ts` | `getPayoutForJob(jobId): Promise<Payout \| null>` |
| **Query** | In service | `SELECT * FROM payouts WHERE job_id = $1 LIMIT 1` |
| **Route** | — | No dedicated GET /payouts?jobId= or GET /jobs/:jobId/payout. Returned inside **GET /jobs/:jobId/details** as `payout` (id, job_id, amount_cents, status, created_at, updated_at). |
| **Other** | `src/routes/cleaner.ts` | `GET /cleaner/payouts` — list payouts for current cleaner via `getCleanerPayouts(cleanerId, limit)`. Admin: `src/routes/admin.ts` GET /admin/payouts, finance routes in `src/routes/admin/finance.ts`. |
| **Type** | `src/types/db.ts` | `Payout`: id, cleaner_id, job_id, stripe_transfer_id, amount_credits, amount_cents, total_usd, status, created_at, updated_at. |

---

### 8) Summary table: route/service → data

| Data | Primary route | Service / query location |
|------|----------------|--------------------------|
| Job by id | GET /jobs/:jobId | `jobsService.getJob()` — `src/services/jobsService.ts` |
| Job details (all-in-one) | GET /jobs/:jobId/details | `src/routes/jobs.ts` — getJob + parallel queries (cleaner_profiles, job_checkins, job_photos, getJobCreditEntries, payment_intents, payouts) |
| Cleaner profile | GET /cleaners/:id | `src/routes/dashboardStubs.ts` — inline query users + cleaner_profiles + level + badges |
| Ledger by job | (inside /details) | `creditsService.getJobCreditEntries()` — `src/services/creditsService.ts` |
| Job photos list | (inside /details); create: POST /jobs/:jobId/photos | `photosService.listJobPhotos()`, `addJobPhoto()` — `src/services/photosService.ts` |
| Job checkins list | (inside /details) | Inline query in `src/routes/jobs.ts` (GET /jobs/:jobId/details) |
| Payment intent by job | GET /stripe/payment-intent/:jobId | `paymentService.getPaymentIntentByJobId()` — `src/services/paymentService.ts` |
| Payout by job | (inside /details) | `payoutsService.getPayoutForJob()` — `src/services/payoutsService.ts`; also inline in /details |

---

*Generated from `DB/migrations/`, `src/types/db.ts`, `src/routes/jobs.ts`, `src/routes/dashboardStubs.ts`, `src/routes/tracking.ts`, `src/routes/stripe.ts`, `src/routes/payments.ts`, `src/services/jobsService.ts`, `src/services/creditsService.ts`, `src/services/photosService.ts`, `src/services/paymentService.ts`, `src/services/payoutsService.ts`, `src/services/jobTrackingService.ts`.*

---

## Interactive UI Data Guide (frontend–backend contract)

Single reference mapping **UI components → required data → DB tables → API endpoints → fallback rules** for the Job Details UI. Backend implements this contract.

### Architecture (best practice)

| Use case | API | Notes |
|----------|-----|--------|
| **Static / page data** | GET /jobs/:jobId/details | One call; caching-friendly. |
| **Live presence** | GET /tracking/:jobId | Poll 5–10s; request dedupe + abort controller. |

**Why:** Keeps UI fast and cacheable; presence stays real-time.

### Canonical sources

- **DB (truth):** jobs, users, cleaner_profiles, credit_ledger, job_photos, job_checkins, payment_intents, payouts, job_events (timeline + live via tracking).
- **APIs:** GET /jobs/:jobId/details (static payload); GET /tracking/:jobId (live state). Optional: GET /jobs/:jobId, GET /cleaners/:id, GET /stripe/payment-intent/:jobId.

### 1) Job Timeline Rail (Booked → On Route → Working → Completed)

| What | Source |
|------|--------|
| **Minimum data** | job: id, status, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at |
| **API** | GET /jobs/:jobId/details → data.job |
| **Status → UI phase** | requested/accepted → booked; on_my_way → on_route; in_progress/awaiting_approval → working; completed → completed; cancelled → cancelled; disputed → disputed |
| **Fallback** | If actual_start_at set but status not in_progress → show “Working”. If actual_end_at set → force “Completed”. |

### 2) Reliability Ring (Trust viz)

| What | Source |
|------|--------|
| **Minimum data** | cleaner: reliability_score (0–100); optional tier, avg_rating, jobs_completed |
| **API** | GET /jobs/:jobId/details → data.cleaner |
| **Fallback** | No cleaner_id → hide ring, show “Matching in progress”. No reliability_score → derive from avg_rating (e.g. avg_rating/5*100) + jobs_completed. |

### 3) Credit Ledger Flow (Escrow → Release → Settled)

| What | Source |
|------|--------|
| **Minimum data** | ledgerEntries (delta_credits, reason, created_at, user_id); job.client_id, job.cleaner_id; optional payout.status |
| **API** | GET /jobs/:jobId/details → data.ledgerEntries, data.payout |
| **Reason → UI** | job_escrow → credits held; job_release → credits released; refund → reverse; adjustment → neutral |
| **Fallback** | No payout → treat job_release as settled. Empty ledger → “No credit movements yet”. |

### 4) Map + Presence (Approach dot + arrival pulse)

| What | Source |
|------|--------|
| **Static** | job: latitude, longitude, address → GET /jobs/:jobId/details → data.job |
| **Live** | GET /tracking/:jobId → current location + timeline events (poll 5–10s) |
| **Fallback** | No live location → use job.status for “On route”. Optionally cleaner base lat/lng as “home base”. |

### 5) Cleaner Profile Cards

| What | Source |
|------|--------|
| **Minimum data** | cleaner: id, name, avatar_url, bio, reliability_score, tier, avg_rating, jobs_completed; optional level, badges[] |
| **API** | GET /jobs/:jobId/details → data.cleaner |
| **Fallback** | No avatar_url → initials chip. No badges → hide badges row. |

### 6) Proof & Media (Before/After gallery)

| What | Source |
|------|--------|
| **Minimum data** | photos: type (before/after), url, created_at |
| **API** | GET /jobs/:jobId/details → data.photos |
| **Fallback** | No photos → “Awaiting before/after photos” by status. |

### 7) Check-in / Check-out

| What | Source |
|------|--------|
| **Minimum data** | checkins: type (check_in/check_out), created_at; optional is_within_radius, distance_from_job_meters |
| **API** | GET /jobs/:jobId/details → data.checkins |
| **Fallback** | If job_checkins empty → derive from GET /tracking/:jobId timeline events (check_in, check_out). |

### 8) Payments (Status & reassurance)

| What | Source |
|------|--------|
| **Minimum data** | paymentIntent: status, amount_cents, currency, created_at |
| **API** | GET /jobs/:jobId/details → data.paymentIntent |
| **Fallback** | paymentIntent null → use ledger (escrow/release) for status; don’t break UI. |

### Exact field checklist for GET /jobs/:jobId/details

- **jobs:** id, client_id, cleaner_id, status; scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at; address, latitude, longitude; credit_amount, held_credits, cleaning_type, duration_hours; cleaner_payout_amount_cents.
- **cleaner (users + cleaner_profiles):** id, email; first_name, last_name, bio; avatar_url; base_rate_cph; reliability_score, tier; avg_rating, jobs_completed; optional level, badges[].
- **job_photos:** id, job_id, uploaded_by, type, url, thumbnail_url, created_at.
- **job_checkins:** id, job_id, cleaner_id, type, lat, lng, distance_from_job_meters, is_within_radius, created_at.
- **credit_ledger:** id, user_id, job_id, delta_credits, reason, created_at.
- **payment_intents (job_charge):** id, job_id, client_id, stripe_payment_intent_id, status, amount_cents, currency, purpose, credits_amount, created_at, updated_at.
- **payouts:** id, cleaner_id, job_id, stripe_transfer_id, amount_credits, amount_cents, total_usd, status, created_at, updated_at.

---

## Frontend Integration Guide: /jobs/:jobId/details + /tracking/:jobId

Single reference for frontend developers: implement in the **frontend repo**. Backend contract below.

**Goal:** Job Details page — (1) GET /jobs/:jobId/details once, (2) poll GET /tracking/:jobId every 5–10s, (3) bind to Timeline Rail, Reliability Ring, Ledger Flow, Proof Gallery, Presence Map (Framer Motion).

**Backend response shapes:**

- **GET /jobs/:jobId/details** → `{ data: { job, cleaner, photos, checkins, ledgerEntries, paymentIntent, payout } }`.
- **GET /tracking/:jobId** → `{ tracking: state }` (no `data` wrapper). Backend `state`: `jobId`, `status`, `currentLocation` (`{ latitude, longitude, updatedAt }` or null), `timeline` (event_type, timestamp, payload, actor_type), `eta`, `photos`, `cleaner`, `times`. Frontend can map to `currentLocation: { lat, lng, at }` and `events`.

**Frontend files to add (in frontend repo):**

| File | Purpose |
|------|--------|
| `src/types/jobDetails.ts` | JobStatus, Job, CleanerComposite, JobPhoto, JobCheckin, CreditLedgerEntry, PaymentIntent, Payout, JobDetails, JobDetailsResponse (data: JobDetails), TrackingState |
| `src/lib/api.ts` | apiGet with credentials, error parsing |
| `src/services/jobDetails.client.ts` | getJobDetails(jobId) return res.data; getJobTracking(jobId) return res.tracking |
| `src/hooks/useJobDetails.ts` | Fetch details once; state idle/loading/success/error |
| `src/hooks/useJobTrackingPoll.ts` | Poll every 8s; inflight dedupe; return tracking, error |
| `src/app/jobs/[jobId]/page.tsx` | Thin server component to JobDetailsClient |
| `src/app/jobs/[jobId]/JobDetailsClient.tsx` | useJobDetails + useJobTrackingPoll; render TimelineRail, ReliabilityRing, PresenceMiniMap, LedgerFlow, ProofGallery |
| `src/components/job/TimelineRail.tsx` | Map status to booked/on_route/working/completed; Framer Motion steps |
| `src/components/job/ReliabilityRing.tsx` | SVG ring + reliability_score; no cleaner = Matching in progress |
| `src/components/job/LedgerFlow.tsx` | Ledger state (pending/moving/settled); Client-Escrow-Cleaner nodes |
| `src/components/job/ProofGallery.tsx` | Before/after; empty hints; modal on click |
| `src/components/job/PresenceMiniMap.tsx` | Job marker + cleaner dot; pulse when checked in |

**Gotchas:** (1) If backend is under /api, use /api/jobs/... and /api/tracking/... (2) Auth: cookies use credentials include; bearer use Authorization header (3) Tracking: backend returns { tracking }, not { data: { tracking } }; service should return res.tracking.

Backend implements all of the above in GET /jobs/:jobId/details and GET /tracking/:jobId as described in this doc and in the “Backend: GET /jobs/:jobId/details — Implementation guide”.
