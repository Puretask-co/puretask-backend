# Complete Testing Strategy for PureTask - Detailed Breakdown

## 📋 Overview

This document outlines a comprehensive testing strategy for the PureTask platform, covering both backend (Node.js/Express) and frontend (Next.js/React) codebases. The strategy is adapted from industry best practices and aligned with PureTask's actual architecture.

---

## Phase 1: Testing Infrastructure Setup

### 1.1 What It Is
Testing infrastructure is the foundational tooling that allows you to run automated tests. Without this, you cannot execute any automated tests.

### 1.2 Current State Analysis

**Backend (puretask-backend):**
- ✅ **Jest** - Already configured (`jest.config.js`)
- ✅ **ts-jest** - TypeScript support
- ✅ **Test scripts** - Defined in `package.json`
- ✅ **Test setup** - `src/tests/setup.ts` exists
- ✅ **Test utilities** - `src/tests/utils/testApp.ts` exists
- ⚠️ **Coverage** - Needs verification

**Frontend (puretask-frontend):**
- ✅ **Jest** - Configured (`jest.config.js`)
- ✅ **React Testing Library** - Available
- ✅ **Playwright** - Configured (`playwright.config.ts`)
- ✅ **Test scripts** - Defined in `package.json`
- ⚠️ **Coverage** - Needs verification

### 1.3 What It Entails

| Component | Purpose | Files Created/Modified | Status |
|-----------|---------|------------------------|--------|
| Jest (Backend) | Unit test runner for Node.js | `jest.config.js` | ✅ Exists |
| Jest (Frontend) | Unit test runner for React | `jest.config.js` | ✅ Exists |
| React Testing Library | Renders React components in test environment | - | ✅ Available |
| jsdom | Simulates browser DOM in Node.js | - | ✅ Available |
| Playwright | Browser automation for E2E tests | `playwright.config.ts` | ✅ Exists |
| Test Scripts | NPM commands to run tests | `package.json` | ✅ Exists |
| Test Utilities | Helper functions for testing | `src/tests/utils/` | ✅ Exists |

### 1.4 Success Criteria
- ✅ Running `npm run test` executes unit tests (Backend)
- ✅ Running `npm test` executes unit tests (Frontend)
- ✅ Running `npm run test:e2e` executes E2E tests (if configured)
- ✅ Test output shows pass/fail status clearly
- ⚠️ Coverage reports generate showing % of code covered (needs verification)

### 1.5 How to Conduct

**Backend:**
```bash
cd puretask-backend
npm run test
npm run test:coverage
```

**Frontend:**
```bash
cd puretask-frontend
npm test
npm run test:coverage
```

**Action Items:**
1. Verify coverage reporting works
2. Ensure test scripts are properly configured
3. Create sample tests to verify setup

---

## Phase 2: Unit Tests

### 2.1 What They Are
Unit tests verify that individual functions work correctly in isolation. They test one "unit" of code at a time, without external dependencies.

### 2.2 Backend Utility Function Tests

#### File to Test: `src/lib/pricing.ts` (if exists) or `src/services/pricingService.ts`

**Note:** PureTask uses a credit-based system. We need to test:
- Credit calculations
- Platform fee calculations
- Cleaner payout calculations
- Tier-based pricing

| Test Name | What It Tests | Input | Expected Output | Success Criteria |
|-----------|---------------|-------|------------------|------------------|
| `calculateJobPrice` returns correct base price | Base price calculation | `{ hours: 2, rate: 20 }` | `40 credits` | Returns 40 |
| `calculatePlatformFee` returns 15% fee | Platform fee calculation | `{ price: 100 }` | `15 credits` | Returns 15 |
| `calculateCleanerPayout` returns 85% for platinum | Cleaner payout | `{ price: 100, tier: 'platinum' }` | `85 credits` | Returns 85 |
| `calculateCleanerPayout` returns 80% for bronze | Tier-based payout | `{ price: 100, tier: 'bronze' }` | `80 credits` | Returns 80 |
| `calculateTotalWithAddons` includes addon prices | Addon calculation | `{ base: 50, addons: [{ price: 10 }, { price: 15 }] }` | `75 credits` | Returns 75 |

**How to Conduct:**
```typescript
// src/lib/__tests__/pricing.test.ts
import { describe, it, expect } from '@jest/globals';
import { calculateJobPrice, calculatePlatformFee, calculateCleanerPayout } from '../pricing';

describe('pricing utilities', () => {
  it('calculates base job price correctly', () => {
    const price = calculateJobPrice({ hours: 2, hourlyRate: 20 });
    expect(price).toBe(40);
  });

  it('calculates platform fee as 15%', () => {
    const fee = calculatePlatformFee(100);
    expect(fee).toBe(15);
  });

  it('calculates cleaner payout based on tier', () => {
    const bronzePayout = calculateCleanerPayout(100, 'bronze');
    expect(bronzePayout).toBe(80);
    
    const platinumPayout = calculateCleanerPayout(100, 'platinum');
    expect(platinumPayout).toBe(85);
  });
});
```

#### File to Test: `src/lib/validation.ts` or `src/lib/sanitization.ts`

**Note:** We have `src/lib/sanitization.ts` for input sanitization.

| Test Name | What It Tests | Input | Expected Output | Success Criteria |
|-----------|---------------|-------|------------------|------------------|
| `sanitizeHtml` removes script tags | XSS prevention | `"<script>alert('xss')</script>Hello"` | `"Hello"` | Script removed |
| `sanitizeEmail` validates email format | Email validation | `"invalid-email"` | `null` or error | Invalid email rejected |
| `sanitizePhone` formats phone numbers | Phone formatting | `"1234567890"` | `"+11234567890"` | Properly formatted |
| `sanitizeText` removes HTML | Text sanitization | `"<b>Bold</b> text"` | `"Bold text"` | HTML removed |

**How to Conduct:**
```typescript
// src/lib/__tests__/sanitization.test.ts
import { describe, it, expect } from '@jest/globals';
import { sanitizeHtml, sanitizeEmail, sanitizePhone } from '../sanitization';

describe('sanitization utilities', () => {
  it('removes script tags from HTML', () => {
    const input = "<script>alert('xss')</script>Hello";
    const output = sanitizeHtml(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('Hello');
  });

  it('validates email format', () => {
    expect(sanitizeEmail('valid@email.com')).toBeTruthy();
    expect(sanitizeEmail('invalid-email')).toBeNull();
  });
});
```

#### File to Test: `src/lib/errorRecovery.ts`

**Note:** We have error recovery utilities.

| Test Name | What It Tests | Success Criteria |
|-----------|---------------|------------------|
| `retryWithExponentialBackoff` retries failed requests | Retries up to max attempts | Retries 3 times with backoff |
| `retryWithExponentialBackoff` stops on success | Stops on first success | Returns immediately |
| `isNetworkError` detects network errors | Network error detection | Returns true for network errors |

### 2.3 Frontend Utility Function Tests

#### File to Test: `src/lib/utils.ts`

| Test Name | What It Tests | Success Criteria |
|-----------|---------------|------------------|
| `formatCurrency` formats credits as currency | `formatCurrency(100)` | Returns "$10.00" (10 credits = $1) |
| `formatDate` formats dates correctly | `formatDate(new Date())` | Returns readable date string |
| `cn` merges class names | `cn('a', 'b')` | Returns "a b" |

#### File to Test: `src/lib/mobile/inputTypes.ts`

| Test Name | What It Tests | Success Criteria |
|-----------|---------------|------------------|
| `getMobileInputConfig` returns phone config | Phone input type | Returns `{ type: 'tel', inputMode: 'tel' }` |
| `getMobileInputConfig` returns email config | Email input type | Returns `{ type: 'email', inputMode: 'email' }` |

### 2.4 Backend Service Tests

#### File to Test: `src/services/authService.ts`

| Test Name | What It Tests | Mock Setup | Expected Behavior | Success Criteria |
|-----------|---------------|------------|-------------------|------------------|
| `registerUser` creates user | User registration | Mock DB query | User created in database | Returns user object |
| `registerUser` hashes password | Password security | Mock bcrypt | Password is hashed | Hash stored, not plain text |
| `loginUser` validates credentials | Authentication | Valid credentials | Returns JWT token | Token returned |
| `loginUser` rejects invalid password | Security | Wrong password | Throws error | Error thrown |

**How to Conduct:**
```typescript
// src/services/__tests__/authService.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { registerUser, loginUser } from '../authService';
import { query } from '../../db/client';

jest.mock('../../db/client');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates user with hashed password', async () => {
    const mockQuery = query as jest.MockedFunction<typeof query>;
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: '123', email: 'test@test.com' }],
    });

    const user = await registerUser({
      email: 'test@test.com',
      password: 'password123',
      role: 'client',
    });

    expect(user).toBeDefined();
    expect(mockQuery).toHaveBeenCalled();
    // Verify password was hashed (not plain text)
    const passwordCall = mockQuery.mock.calls.find(call => 
      call[0].includes('password_hash')
    );
    expect(passwordCall).toBeDefined();
  });
});
```

### 2.5 Frontend Hook Tests

#### File to Test: `src/hooks/useCleanerOnboarding.ts`

| Test Name | What It Tests | Mock Setup | Expected Behavior | Success Criteria |
|-----------|---------------|------------|-------------------|------------------|
| `saveCurrentStep` persists step | Progress persistence | Mock API | Step saved to backend | API called with step |
| `goToNextStep` advances step | Step navigation | Local state | Current step increments | Step changes |
| `goToNextStep` saves to DB | Auto-save | Mock API | Step persisted | API called |
| `useCleanerOnboarding` loads saved step | Resume onboarding | Mock progress API | Loads saved step | Starts at saved step |

**How to Conduct:**
```typescript
// src/hooks/__tests__/useCleanerOnboarding.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCleanerOnboarding } from '../useCleanerOnboarding';
import { apiClient } from '@/lib/api';

jest.mock('@/lib/api');

describe('useCleanerOnboarding', () => {
  it('loads saved step on mount', async () => {
    const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
    mockApiClient.get.mockResolvedValueOnce({
      progress: {
        current_step: 'phone-verification',
        completed: 2,
        total: 10,
      },
    });

    const wrapper = ({ children }) => (
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useCleanerOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentStep).toBe('phone-verification');
    });
  });
});
```

#### File to Test: `src/hooks/useBookings.ts`

| Test Name | What It Tests | Success Criteria |
|-----------|---------------|------------------|
| `createBooking` requires authentication | Auth check | Throws if not authenticated |
| `createBooking` validates credit balance | Credit validation | Throws if insufficient credits |
| `createBooking` creates job | Job creation | Returns job ID |
| `createBooking` holds credits | Credit hold | Credits held in database |

### 2.6 Component Tests

#### Component: `src/components/booking/DateTimePicker.tsx` (if exists)

**Note:** Check if this component exists in frontend.

| Test Name | User Action | Expected Result | Success Criteria |
|-----------|-------------|-----------------|-------------------|
| renders calendar | Mount component | Calendar visible | Calendar element in DOM |
| disables past dates | View dates | Yesterday is disabled | Past dates not clickable |
| calls onDateChange when date selected | Click a date | Callback fired | onDateChange called with Date |
| calls onTimeChange when time selected | Click time slot | Callback fired | onTimeChange called with string |

**How to Conduct:**
```typescript
// src/components/booking/__tests__/DateTimePicker.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimePicker } from '../DateTimePicker';

describe('DateTimePicker', () => {
  it('disables past dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    render(<DateTimePicker onDateChange={jest.fn()} />);
    
    const yesterdayButton = screen.getByLabelText(yesterday.toDateString());
    expect(yesterdayButton).toBeDisabled();
  });

  it('calls onDateChange when date selected', () => {
    const handleDateChange = jest.fn();
    render(<DateTimePicker onDateChange={handleDateChange} />);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowButton = screen.getByLabelText(tomorrow.toDateString());
    
    fireEvent.click(tomorrowButton);
    expect(handleDateChange).toHaveBeenCalledWith(expect.any(Date));
  });
});
```

#### Component: `src/components/onboarding/OnboardingProgress.tsx`

| Test Name | What It Tests | Success Criteria |
|-----------|---------------|------------------|
| displays progress percentage | Progress bar | Shows correct percentage |
| highlights current step | Step indicator | Current step is highlighted |
| shows completed steps | Step list | Completed steps are marked |

---

## Phase 3: Integration Tests

### 3.1 What They Are
Integration tests verify that multiple components/systems work correctly together. They test the "seams" between units.

### 3.2 Payment Flow Integration

**Note:** PureTask uses Stripe for payments. Flow may differ from Supabase example.

| Step | System Under Test | What to Verify | Success Criteria |
|------|-------------------|----------------|------------------|
| 1 | `POST /client/credits/purchase` | Creates Stripe session | Returns `{ url, sessionId }` |
| 2 | Stripe (mocked) | Payment completes | Session status = "paid" |
| 3 | `POST /stripe/webhook` | Processes payment | Credits added to account |
| 4 | `credit_accounts` table | Balance updated | `current_balance` increased |
| 5 | `credit_ledger` table | Transaction logged | Entry with reason = "purchase" |
| 6 | `credit_purchases` table | Purchase recorded | Row with status = "completed" |

**Idempotency Test (Critical):**
```typescript
// Test that webhook processing is idempotent
it('does not double-credit on duplicate webhook', async () => {
  const sessionId = 'cs_test_123';
  const userId = 'user-123';
  
  // First webhook - should add 50 credits
  await processStripeWebhook({ sessionId, status: 'paid' });
  const balanceAfterFirst = await getCreditBalance(userId);
  
  // Second webhook with same sessionId - should NOT add more credits
  await processStripeWebhook({ sessionId, status: 'paid' });
  const balanceAfterSecond = await getCreditBalance(userId);
  
  expect(balanceAfterSecond).toBe(balanceAfterFirst);
});
```

### 3.3 Booking Flow Integration

| Step | What Happens | Validation | Success Criteria |
|------|--------------|------------|------------------|
| 1 | Client selects cleaning type | UI shows correct base price | Price matches config |
| 2 | Client selects date/time | Date/time validated | Valid date/time selected |
| 3 | Client selects address | Address validated | GPS coordinates resolved |
| 4 | System checks credit balance | Sufficient funds required | Error if insufficient |
| 5 | `POST /client/bookings` creates job | All fields populated | Job status = "pending" |
| 6 | Credits held | `held_balance` updated | Available balance reduced |
| 7 | Client redirected | Navigation to booking status | URL = `/client/bookings/[id]` |

**How to Conduct:**
```typescript
// src/tests/integration/booking.test.ts
import { testApp } from '../utils/testApp';
import { query } from '../../db/client';

describe('Booking Flow Integration', () => {
  it('creates booking and holds credits', async () => {
    const app = await testApp();
    
    // 1. Login as client
    const loginRes = await app.post('/auth/login').send({
      email: 'client@test.com',
      password: 'password123',
    });
    const token = loginRes.body.token;
    
    // 2. Get initial balance
    const initialBalance = await query(
      'SELECT current_balance FROM credit_accounts WHERE user_id = $1',
      [loginRes.body.user.id]
    );
    
    // 3. Create booking
    const bookingRes = await app
      .post('/client/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cleaningType: 'regular',
        hours: 2,
        date: '2026-01-25',
        time: '14:00',
        addressId: 'addr-123',
        cleanerId: 'cleaner-123',
        totalCredits: 50,
      });
    
    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.job.id).toBeDefined();
    
    // 4. Verify credits held
    const afterBalance = await query(
      'SELECT current_balance, held_balance FROM credit_accounts WHERE user_id = $1',
      [loginRes.body.user.id]
    );
    
    expect(afterBalance.rows[0].held_balance).toBe(50);
    expect(afterBalance.rows[0].current_balance).toBe(initialBalance.rows[0].current_balance - 50);
  });
});
```

### 3.4 Auth Flow Integration

| Test | Actions | Verifications | Success Criteria |
|------|---------|--------------|------------------|
| Signup as client | Sign up with role="client" | `users` entry, `client_profiles` entry, `credit_accounts` entry | All 3 tables have rows |
| Signup as cleaner | Sign up with role="cleaner" | `users` entry, `cleaner_profiles` entry | Both tables have rows |
| Login | Sign in with password | Session returned | `useAuth().isAuthenticated = true` |
| Logout | Sign out | Session cleared | `user = null`, redirected |
| Role-based redirect | Login as cleaner | Redirected to cleaner dashboard | URL = `/cleaner/dashboard` |

**How to Conduct:**
```typescript
// src/tests/integration/auth.test.ts
describe('Auth Flow Integration', () => {
  it('creates all required records for client signup', async () => {
    const app = await testApp();
    
    const res = await app.post('/auth/register').send({
      email: 'newclient@test.com',
      password: 'password123',
      role: 'client',
      firstName: 'John',
      lastName: 'Doe',
    });
    
    expect(res.status).toBe(201);
    
    // Verify user created
    const user = await query('SELECT * FROM users WHERE email = $1', ['newclient@test.com']);
    expect(user.rows.length).toBe(1);
    
    // Verify client profile created
    const profile = await query('SELECT * FROM client_profiles WHERE user_id = $1', [user.rows[0].id]);
    expect(profile.rows.length).toBe(1);
    
    // Verify credit account created
    const creditAccount = await query('SELECT * FROM credit_accounts WHERE user_id = $1', [user.rows[0].id]);
    expect(creditAccount.rows.length).toBe(1);
    expect(creditAccount.rows[0].current_balance).toBe(0);
  });
});
```

### 3.5 Onboarding Flow Integration

| Step | What Happens | Validation | Success Criteria |
|------|--------------|------------|------------------|
| 1 | Cleaner starts onboarding | Step 1 loaded | Onboarding page visible |
| 2 | Completes terms agreement | Agreement saved | `cleaner_agreements` table updated |
| 3 | Enters basic info | Profile updated | `cleaner_profiles` table updated |
| 4 | Verifies phone | OTP sent and verified | `phone_verifications` table updated |
| 5 | Uploads face photo | Photo uploaded | `profile_photo_url` set |
| 6 | Uploads ID | ID verification created | `id_verifications` table has entry |
| 7 | Completes all steps | Onboarding marked complete | `onboarding_completed_at` set |

---

## Phase 4: End-to-End (E2E) Tests

### 4.1 What They Are
E2E tests simulate a real user interacting with the full application in a browser. They test the complete system from UI to database.

### 4.2 Client Booking E2E

**Scenario:** New client signs up, buys credits, books cleaning

| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Navigate to `/auth` | Page loads | Sign in form visible |
| 2 | Click "Sign Up" tab | Tab switches | Sign up form visible |
| 3 | Select "Client" role | Role selected | Client option highlighted |
| 4 | Enter email/password | Fields filled | No validation errors |
| 5 | Click "Sign Up" | Account created | Redirected to dashboard |
| 6 | Navigate to wallet/credits | Credits page loads | Balance shows 0 |
| 7 | Click "Buy Credits" | Dialog opens | Package options visible |
| 8 | Select package, complete checkout | Stripe flow | Redirected with success |
| 9 | Verify balance updated | Balance > 0 | Credits added |
| 10 | Navigate to `/booking` | Booking wizard loads | Step 1 visible |
| 11 | Select cleaning type | Type selected | Proceed enabled |
| 12 | Select date/time | Date picker works | Time slot selected |
| 13 | Enter address | Address input | Map preview shown |
| 14 | Select a cleaner | Cleaner list | Cleaner highlighted |
| 15 | Confirm booking | Credits held | Redirected to status page |
| 16 | Verify booking in database | Query jobs table | Job exists with correct data |

**How to Conduct (Playwright):**
```typescript
// tests/e2e/booking.spec.ts
import { test, expect } from '@playwright/test';

test('client can complete full booking flow', async ({ page }) => {
  // 1. Sign up
  await page.goto('/auth');
  await page.getByRole('tab', { name: 'Sign Up' }).click();
  await page.getByText('Client').click();
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'Test123!');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  
  // 2. Wait for redirect
  await expect(page).toHaveURL('/client/dashboard');
  
  // 3. Navigate to booking
  await page.goto('/booking');
  await expect(page.getByText('Select Cleaning Type')).toBeVisible();
  
  // 4. Complete wizard steps...
  await page.getByText('Regular Clean').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // ... continue through all steps
  
  // 5. Verify booking created
  await expect(page).toHaveURL(/\/client\/bookings\/.+/);
  await expect(page.getByText('Booking Confirmed')).toBeVisible();
});
```

### 4.3 Cleaner Onboarding E2E

| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Cleaner signs up | Account created | Redirected to onboarding |
| 2 | Completes Step 1 (Terms) | Agreement accepted | Step 2 unlocked |
| 3 | Enters basic info | Profile saved | Step 3 unlocked |
| 4 | Verifies phone | OTP sent and verified | Phone verified |
| 5 | Uploads face photo | Photo uploaded | Step 5 unlocked |
| 6 | Uploads ID | ID uploaded | Step 6 unlocked |
| 7 | Completes all steps | Onboarding complete | Redirected to dashboard |
| 8 | Verifies dashboard access | Dashboard loads | Cleaner can access dashboard |

### 4.4 Cleaner Job Lifecycle E2E

| Step | Action | Assertion | Success Criteria |
|------|--------|-----------|------------------|
| 1 | Cleaner logs in | Dashboard loads | Jobs list visible |
| 2 | Open assigned job | Job detail page | All info displayed |
| 3 | Check in (GPS) | Location captured | Check-in recorded |
| 4 | Upload before photos | Photos uploaded | Photos visible in grid |
| 5 | Complete work | Mark complete | Status updates |
| 6 | Upload after photos | Photos uploaded | Before/after paired |
| 7 | Client approves | Job approved | Credits released |
| 8 | Verify earnings | Earnings page | Correct amount shown |

---

## Phase 5: API Endpoint Tests

### 5.1 What They Are
Tests that verify your backend API endpoints work correctly, including auth checks, input validation, and database operations.

### 5.2 Authentication Endpoints

| Endpoint | Test Case | Input | Expected Response | Success Criteria |
|----------|-----------|-------|-------------------|------------------|
| `POST /auth/register` | Valid registration | `{ email, password, role }` | `201`, user object | User created |
| `POST /auth/register` | Duplicate email | Same email twice | `400`, error message | Registration rejected |
| `POST /auth/login` | Valid credentials | `{ email, password }` | `200`, token | Token returned |
| `POST /auth/login` | Invalid password | Wrong password | `401`, error | Login rejected |
| `GET /auth/me` | Valid token | Bearer token | `200`, user object | User returned |
| `GET /auth/me` | No token | No auth header | `401`, error | Request rejected |

**How to Conduct:**
```typescript
// src/tests/integration/auth.test.ts
import { testApp } from '../utils/testApp';

describe('Auth Endpoints', () => {
  it('registers new user', async () => {
    const app = await testApp();
    
    const res = await app.post('/auth/register').send({
      email: 'newuser@test.com',
      password: 'password123',
      role: 'client',
    });
    
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.com');
  });

  it('rejects duplicate email', async () => {
    const app = await testApp();
    
    // First registration
    await app.post('/auth/register').send({
      email: 'duplicate@test.com',
      password: 'password123',
      role: 'client',
    });
    
    // Second registration with same email
    const res = await app.post('/auth/register').send({
      email: 'duplicate@test.com',
      password: 'password123',
      role: 'client',
    });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });
});
```

### 5.3 Booking Endpoints

| Endpoint | Test Case | Auth | Expected Response | Success Criteria |
|----------|-----------|------|-------------------|------------------|
| `POST /client/bookings` | Valid booking | Client JWT | `201`, job object | Job created |
| `POST /client/bookings` | Insufficient credits | Client JWT | `400`, error | Booking rejected |
| `POST /client/bookings` | No auth | No token | `401`, error | Request rejected |
| `GET /client/bookings` | List bookings | Client JWT | `200`, array | Only client's bookings |
| `GET /client/bookings/:id` | Get booking | Client JWT | `200`, job object | Job returned |
| `GET /client/bookings/:id` | Other client's booking | Client JWT | `403`, error | Access denied |

### 5.4 Cleaner Onboarding Endpoints

| Endpoint | Test Case | Auth | Expected Response | Success Criteria |
|----------|-----------|------|-------------------|------------------|
| `POST /cleaner/onboarding/agreements` | Save agreements | Cleaner JWT | `200`, success | Agreements saved |
| `POST /cleaner/onboarding/basic-info` | Save basic info | Cleaner JWT | `200`, success | Profile updated |
| `POST /cleaner/onboarding/send-otp` | Send OTP | Cleaner JWT | `200`, success | OTP sent |
| `POST /cleaner/onboarding/verify-otp` | Verify OTP | Cleaner JWT | `200`, success | Phone verified |
| `PATCH /cleaner/onboarding/current-step` | Save step | Cleaner JWT | `200`, success | Step persisted |
| `GET /cleaner/onboarding/progress` | Get progress | Cleaner JWT | `200`, progress | Progress returned |

### 5.5 Admin Endpoints

| Endpoint | Test Case | Auth | Expected Response | Success Criteria |
|----------|-----------|------|-------------------|------------------|
| `GET /admin/users` | List users | Admin JWT | `200`, array | All users returned |
| `GET /admin/users` | Non-admin | Client JWT | `403`, error | Access denied |
| `PATCH /admin/id-verifications/:id/status` | Approve ID | Admin JWT | `200`, success | Status updated |
| `POST /admin/onboarding-reminders/send` | Send reminders | Admin JWT | `200`, count | Reminders sent |

---

## Phase 6: Security & Authorization Tests

### 6.1 What They Are
Tests that verify your authorization middleware and database access controls correctly restrict data access.

### 6.2 Role-Based Access Control (RBAC) Tests

**Note:** PureTask uses JWT-based auth with role middleware, not Supabase RLS.

| Endpoint | Test | Auth Role | Expected | Success Criteria |
|----------|------|-----------|----------|------------------|
| `GET /client/bookings` | Client access | Client | `200`, bookings | Access granted |
| `GET /client/bookings` | Cleaner access | Cleaner | `403`, error | Access denied |
| `GET /cleaner/jobs` | Cleaner access | Cleaner | `200`, jobs | Access granted |
| `GET /cleaner/jobs` | Client access | Client | `403`, error | Access denied |
| `GET /admin/users` | Admin access | Admin | `200`, users | Access granted |
| `GET /admin/users` | Client access | Client | `403`, error | Access denied |

**How to Conduct:**
```typescript
// src/tests/integration/rbac.test.ts
describe('Role-Based Access Control', () => {
  it('allows client to access client endpoints', async () => {
    const app = await testApp();
    const clientToken = await getClientToken();
    
    const res = await app
      .get('/client/bookings')
      .set('Authorization', `Bearer ${clientToken}`);
    
    expect(res.status).toBe(200);
  });

  it('denies cleaner access to client endpoints', async () => {
    const app = await testApp();
    const cleanerToken = await getCleanerToken();
    
    const res = await app
      .get('/client/bookings')
      .set('Authorization', `Bearer ${cleanerToken}`);
    
    expect(res.status).toBe(403);
  });
});
```

### 6.3 Data Isolation Tests

| Test | Action | Expected | Success Criteria |
|------|--------|----------|------------------|
| Client A sees only own bookings | Query as Client A | Only Client A's bookings | No Client B's bookings |
| Cleaner sees only assigned jobs | Query as Cleaner | Only assigned jobs | No unassigned jobs |
| Admin sees all data | Query as Admin | All bookings/jobs | Full access |

### 6.4 Input Validation & Sanitization Tests

| Test | Input | Expected | Success Criteria |
|------|-------|----------|------------------|
| XSS in email field | `<script>alert('xss')</script>@test.com` | Sanitized or rejected | Script removed |
| SQL injection in search | `'; DROP TABLE users; --` | Sanitized | Query safe |
| Phone number validation | Invalid format | Rejected | Error returned |

---

## Phase 7: Manual Testing Protocol

### 7.1 Pre-Release Checklist

| Category | Test | How to Verify | Pass Criteria |
|----------|------|---------------|---------------|
| Auth | Sign up as client | Fill form, submit | Redirected to dashboard |
| Auth | Sign up as cleaner | Fill form, submit | Redirected to onboarding |
| Auth | Login | Use existing creds | Session established |
| Auth | Logout | Click logout | Redirected to home |
| Booking | Complete booking | Full wizard flow | Job appears in dashboard |
| Payments | Buy credits | Stripe checkout | Balance updated |
| Cleaner | Complete onboarding | All 10 steps | Dashboard accessible |
| Cleaner | Check in to job | GPS permission | Location recorded |
| Admin | View all jobs | Admin dashboard | All jobs visible |
| Admin | Approve ID verification | ID dashboard | Status updated |
| Mobile | Responsive layout | Resize to 375px | No horizontal scroll |
| Mobile | Touch targets | Tap buttons | All buttons tappable |

### 7.2 Cross-Browser Matrix

| Browser | Desktop | Mobile | Critical Flows |
|---------|---------|--------|----------------|
| Chrome | ✅ | Android | All flows |
| Firefox | ✅ | - | Booking, Auth |
| Safari | ✅ | iOS | All flows |
| Edge | ✅ | - | Booking |

---

## Phase 8: Performance Tests

### 8.1 What They Are
Tests that verify the application performs well under load and responds quickly.

### 8.2 Performance Test Cases

| Test | Metric | Target | Success Criteria |
|------|--------|--------|------------------|
| Page load time | Home page | < 2s | Loads in under 2 seconds |
| API response time | Booking creation | < 500ms | API responds quickly |
| Database query time | User lookup | < 100ms | Query is fast |
| Image load time | Profile photos | < 1s | Images load quickly |

### 8.3 Load Tests

| Test | Scenario | Expected | Success Criteria |
|------|-----------|----------|------------------|
| Concurrent users | 100 users booking | All succeed | No errors |
| Database load | 1000 queries/sec | Stable | No timeouts |

---

## Summary: Test Coverage Goals

| Test Type | Coverage Target | Critical Files | Status |
|-----------|----------------|----------------|--------|
| Unit Tests | 80% of utility functions | `pricing.ts`, `sanitization.ts`, `errorRecovery.ts` | ⚠️ Needs implementation |
| Service Tests | All services | `authService.ts`, `bookingService.ts`, `onboardingService.ts` | ⚠️ Needs implementation |
| Hook Tests | All data-mutating hooks | `useBooking.ts`, `useCleanerOnboarding.ts` | ⚠️ Needs implementation |
| Component Tests | All form components | `DateTimePicker`, `OnboardingProgress` | ⚠️ Needs implementation |
| Integration | All payment/booking flows | Stripe + Database interaction | ⚠️ Needs implementation |
| E2E | Happy paths for all user types | Client booking, Cleaner onboarding, Admin workflows | ⚠️ Needs implementation |
| Security | All RBAC checks | Role middleware, data isolation | ⚠️ Needs implementation |

---

## Action Items & Next Steps

### Immediate Actions:
1. ✅ **Verify test infrastructure** - Jest and Playwright are configured
2. ⚠️ **Create unit tests** - Start with utility functions
3. ⚠️ **Create service tests** - Test backend services
4. ⚠️ **Create hook tests** - Test React hooks
5. ⚠️ **Create integration tests** - Test API endpoints
6. ⚠️ **Create E2E tests** - Test complete user flows
7. ⚠️ **Set up coverage reporting** - Ensure coverage reports generate
8. ⚠️ **Add to CI/CD** - Run tests on every commit

### Files That Need Tests Created:

**Backend:**
- `src/lib/pricing.ts` (if exists) - Pricing calculations
- `src/lib/sanitization.ts` - Input sanitization
- `src/lib/errorRecovery.ts` - Error recovery
- `src/services/authService.ts` - Authentication
- `src/services/bookingService.ts` - Booking logic
- `src/services/cleanerOnboardingService.ts` - Onboarding
- `src/routes/*.ts` - API endpoints

**Frontend:**
- `src/hooks/useCleanerOnboarding.ts` - Onboarding hook
- `src/hooks/useBookings.ts` - Booking hook
- `src/components/onboarding/*.tsx` - Onboarding components
- `src/components/booking/*.tsx` - Booking components

---

## Notes & Adaptations

### What Doesn't Apply:
1. **Supabase Edge Functions** - PureTask uses Express routes, not Edge Functions
2. **Supabase RLS** - PureTask uses JWT middleware for authorization
3. **Vitest** - PureTask uses Jest (both backend and frontend)
4. **Same-day booking rules** - Need to verify if PureTask has this feature

### What's Similar:
1. **Credit system** - Similar to the example's credit system
2. **Booking flow** - Similar multi-step booking process
3. **Onboarding** - Similar multi-step onboarding (10 steps)
4. **Role-based access** - Similar RBAC implementation

### What Needs Verification:
1. Does PureTask have same-day booking restrictions?
2. Does PureTask have rush fees?
3. What are the exact pricing rules?
4. What are the tier-based payout percentages?

---

**Status**: 📋 **Strategy Documented** - Ready for Implementation
**Next Step**: Begin creating tests starting with unit tests for utility functions

---

## ⚠️ CRITICAL GAPS IDENTIFIED

**See `TESTING_STRATEGY_GAPS_ANALYSIS.md` for complete gap analysis.**

### Missing Test Categories:

1. **Backend Middleware Tests** ❌ 0% coverage
   - JWT authentication middleware
   - CSRF protection
   - Security headers
   - Rate limiting

2. **Backend Service Tests** ⚠️ ~20% coverage
   - Phone verification service
   - File upload service
   - Onboarding reminder service
   - Cleaner onboarding service
   - Many other services (50+ services exist)

3. **Backend Worker Tests** ❌ 0% coverage
   - Onboarding reminder worker
   - Auto-cancel jobs worker
   - Payout workers
   - All background workers

4. **Frontend Context Tests** ❌ 0% coverage
   - AuthContext
   - NotificationContext
   - WebSocketContext
   - ToastContext

5. **Frontend API Client Tests** ❌ 0% coverage
   - Request/response interceptors
   - Error handling
   - Token management

6. **Database Migration Tests** ❌ 0% coverage
   - Migration execution
   - Idempotency
   - Rollback capability

7. **Integration Tests - External Services** ⚠️ Partial
   - SendGrid email integration
   - Twilio SMS integration
   - n8n webhook integration
   - Stripe webhook idempotency

8. **Coverage Reporting** ⚠️ Needs setup
   - Coverage thresholds
   - CI/CD integration
   - Coverage tracking

---

**For detailed gap analysis, see: `TESTING_STRATEGY_GAPS_ANALYSIS.md`**
