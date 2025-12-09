# Booking System Spec
(Job Lifecycle Spec #1)

## 0. Scope & Purpose
Defines how bookings are created and validated, tying together wallet/escrow, scheduling, and job initialization. Depends on Financial Inflow (credits/wallet) and Escrow Lifecycle. Feeds Cancellation, No-Show, Reassignment, and Pricing specs.

## 1. Actors & Inputs
- Client (creates booking)
- Backend API (booking endpoint)
- Cleaner (may be preselected or matched later)
- Data: address, datetime window, estimated duration, cleaning type/notes, pricing inputs (see Pricing spec), optional cleaner preference.

## 2. Preconditions
- Client authenticated and role=client.
- Client wallet or payment path available (credits or auto-refill enabled).
- Slot/time passes business rules (lead time, blackout, availability if enforcing at book-time).
- Address/service area valid.

## 3. Core Flow (Happy Path)
1) Client requests booking with required fields.
2) Backend validates request (schema, role, address, time rules).
3) Pricing computed (see Pricing spec) → required_credits.
4) Wallet/auto-refill check:
   - If wallet >= required_credits → proceed.
   - Else auto-refill if enabled; otherwise reject insufficient credits.
5) Escrow hold placed for required_credits.
6) Job created: status=created (or assigned if pre-assigned), escrow_amount stored, client/cleaner set, scheduling fields set.
7) Optional: trigger matching/assignment flow (separate spec).

## 4. Data Model (Key Fields)
- job: id, client_id, cleaner_id (nullable), status (`created/assigned/...`), scheduled_start/end, address fields, cleaning_type, notes, escrow_amount, pricing_version, created_at, updated_at.
- credit_ledger: `escrow_hold` linked to job_id.

## 5. Business Rules
- Lead time: configurable minimum before start.
- Max duration/cost: enforce upper bound to prevent oversized bookings.
- Service area: address must fall within supported area.
- Idempotency: duplicate booking submissions with same idempotency key should not double-charge or double-create.
- Escrow atomicity: hold + wallet decrement + job creation in one transaction; on failure, no partial state.

## 6. Sub-Scenarios
- Booking with sufficient wallet credits (straight escrow hold).
- Booking triggers auto-refill (credits added, then escrow hold).
- Booking rejected for insufficient credits with auto-refill disabled.
- Booking rejected for invalid time/address.
- Rebooking / duplicate submit: idempotent create or graceful error.

## 7. Failure Modes & Handling
- Wallet insufficient and auto-refill off → 400 with clear message.
- Escrow hold fails → abort job creation; no ledger side-effect.
- Pricing lookup fails → abort with error.
- Idempotency violation → return existing job reference without new ledger entries.

## 8. Validation & Integrity
- After booking: job row exists, escrow_hold exists, wallet decreased by escrow_amount, ledger consistent (wallet vs ledger).
- No job without corresponding escrow_hold.
- No escrow_hold without a job_id.

## 9. Dependencies
- Uses Pricing & Credit Calculation spec for required_credits.
- Uses Escrow spec for hold semantics.
- Uses Financial Inflow (wallet/auto-refill).
- Matching/assignment handled separately.

