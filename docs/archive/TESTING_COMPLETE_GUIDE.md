# PureTask Complete Testing Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Testing Strategy](#testing-strategy)
3. [Test Types & Explanations](#test-types--explanations)
4. [Running Tests](#running-tests)
5. [Coverage Reporting](#coverage-reporting)
6. [Test Campaigns](#test-campaigns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides a comprehensive overview of testing in the PureTask application, covering both backend (Node.js/Express) and frontend (Next.js/React) codebases.

### Scope
- ✅ **Backend**: API endpoints, services, middleware, workers, utilities
- ✅ **Frontend**: Components, hooks, contexts, pages, API clients

### Testing Infrastructure
- **Backend**: Jest, ts-jest, supertest
- **Frontend**: Jest, React Testing Library, Playwright
- **Coverage**: Jest coverage reports (text, HTML, LCOV)

---

## Testing Strategy

### 8-Phase Testing Approach

#### **Phase 1: Testing Infrastructure Setup**
- Jest configuration for backend and frontend
- Test utilities and helpers
- Mock setup for external services
- Coverage reporting configuration

#### **Phase 2: Unit Tests**
- **Backend**: Utility functions, services, middleware
- **Frontend**: Hooks, contexts, utility functions
- **Goal**: 80% coverage for utilities, 75% for services

#### **Phase 3: Integration Tests**
- API endpoint tests
- Database integration
- External service integration (SendGrid, Twilio, n8n)
- **Goal**: 90% coverage for critical flows

#### **Phase 4: End-to-End (E2E) Tests**
- Complete user flows (Playwright)
- Critical paths: Booking, Onboarding, Payments
- **Goal**: 70% coverage for critical flows

#### **Phase 5: API Endpoint Tests**
- Authentication and authorization
- Request validation
- Error handling
- **Goal**: 90% coverage for all endpoints

#### **Phase 6: Security & Authorization Tests**
- Role-based access control (RBAC)
- Data isolation
- Input sanitization
- CSRF protection
- **Goal**: 100% coverage for security-critical code

#### **Phase 7: Manual Testing Protocol**
- Pre-release checklist
- Cross-browser testing
- Mobile device testing
- User acceptance testing

#### **Phase 8: Performance Tests**
- API response times
- Database query performance
- Frontend load times
- **Goal**: All APIs < 500ms, pages < 2s

---

## Test Types & Explanations

### 1. Unit Tests

**What They Are**: Tests for individual functions/components in isolation.

**Backend Example**:
```typescript
// src/lib/__tests__/tiers.test.ts
describe('tiers utilities', () => {
  it('converts legacy bronze to Developing', () => {
    expect(toCanonicalTier('bronze')).toBe('Developing');
  });
});
```

**Frontend Example**:
```typescript
// src/hooks/__tests__/useCleanerOnboarding.test.tsx
describe('useCleanerOnboarding', () => {
  it('loads saved step from progress', async () => {
    const { result } = renderHook(() => useCleanerOnboarding(), { wrapper });
    await waitFor(() => {
      expect(result.current.currentStep).toBe('phone-verification');
    });
  });
});
```

**When to Use**: Test pure functions, utilities, hooks, and components without external dependencies.

---

### 2. Integration Tests

**What They Are**: Tests that verify multiple components/systems work together.

**Backend Example**:
```typescript
// src/tests/integration/auth.test.ts
describe('Auth Flow Integration', () => {
  it('creates all required records for client signup', async () => {
    const res = await app.post('/auth/register').send({
      email: 'newclient@test.com',
      password: 'password123',
      role: 'client',
    });
    
    // Verify user, profile, and credit account created
    expect(res.status).toBe(201);
  });
});
```

**Frontend Example**:
```typescript
// Integration test for booking flow
describe('Booking Integration', () => {
  it('creates booking and updates UI', async () => {
    // Test complete booking flow with API calls
  });
});
```

**When to Use**: Test API endpoints, database interactions, and service integrations.

---

### 3. E2E Tests

**What They Are**: Tests that simulate real user interactions in a browser.

**Example**:
```typescript
// tests/e2e/booking-flow.spec.ts
test('complete booking flow from signup to confirmation', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Sign Up');
  // ... complete user flow
  await expect(page).toHaveURL(/\/booking\/confirm\//);
});
```

**When to Use**: Test complete user journeys, critical flows, and UI interactions.

---

### 4. Service Tests

**What They Are**: Tests for backend services that handle business logic.

**Example**:
```typescript
// src/services/__tests__/phoneVerificationService.test.ts
describe('phoneVerificationService', () => {
  it('sends OTP and stores in database', async () => {
    const result = await sendOTP('user-123', '+11234567890');
    expect(result.success).toBe(true);
    expect(mockQuery).toHaveBeenCalled();
  });
});
```

**When to Use**: Test business logic, data transformations, and service integrations.

---

### 5. Worker Tests

**What They Are**: Tests for background workers that run scheduled tasks.

**Example**:
```typescript
// src/workers/__tests__/onboardingReminderWorker.test.ts
describe('onboardingReminderWorker', () => {
  it('sends reminders successfully', async () => {
    const result = await runOnboardingReminderWorker();
    expect(result.count).toBe(5);
  });
});
```

**When to Use**: Test scheduled tasks, batch processing, and automated workflows.

---

### 6. Context Tests

**What They Are**: Tests for React contexts that manage global state.

**Example**:
```typescript
// src/contexts/__tests__/AuthContext.test.tsx
describe('AuthContext', () => {
  it('authenticates user and stores token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'pass' });
    });
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

**When to Use**: Test global state management, authentication, and shared context.

---

### 7. Hook Tests

**What They Are**: Tests for React hooks that encapsulate logic.

**Example**:
```typescript
// src/hooks/__tests__/useBookings.test.tsx
describe('useBookings', () => {
  it('fetches bookings', async () => {
    const { result } = renderHook(() => useBookings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
```

**When to Use**: Test custom hooks, data fetching, and state management hooks.

---

### 8. Middleware Tests

**What They Are**: Tests for Express middleware functions.

**Example**:
```typescript
// src/middleware/__tests__/jwtAuth.test.ts
describe('jwtAuthMiddleware', () => {
  it('attaches user to request with valid token', () => {
    req.headers = { authorization: 'Bearer valid-token' };
    jwtAuthMiddleware(req, res, next);
    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

**When to Use**: Test authentication, authorization, validation, and request processing.

---

## Running Tests

### Backend Tests

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Frontend Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Specific Test Files

```bash
# Backend: Run specific test file
npm run test -- src/lib/__tests__/tiers.test.ts

# Frontend: Run specific test file
npm test -- src/hooks/__tests__/useCleanerOnboarding.test.tsx
```

---

## Coverage Reporting

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report (backend)
npm run test:coverage:html

# View summary (backend)
npm run test:coverage:report
```

### Coverage Thresholds

- **Global**: 70% branches, 75% functions, 80% lines
- **Critical Files** (lib, middleware): 80% branches, 85% functions, 85% lines
- **Services**: 75% branches, 80% functions, 80% lines

### Coverage Reports Location

- **Backend**: `coverage/` directory
- **Frontend**: `coverage/` directory
- **HTML Report**: `coverage/index.html`

---

## Test Campaigns

### Campaign 1: Pre-Release Testing

**Objective**: Ensure all critical functionality works before release.

**Tests to Run**:
1. ✅ All unit tests
2. ✅ All integration tests
3. ✅ All E2E tests
4. ✅ Security tests
5. ✅ Performance tests

**Command**:
```bash
# Backend
npm run test && npm run test:coverage

# Frontend
npm test && npm run test:e2e
```

---

### Campaign 2: Regression Testing

**Objective**: Verify existing functionality after changes.

**Tests to Run**:
1. ✅ All integration tests
2. ✅ Critical E2E flows
3. ✅ API endpoint tests

**Command**:
```bash
npm run test:integration && npm run test:e2e
```

---

### Campaign 3: New Feature Testing

**Objective**: Verify new features work correctly.

**Tests to Run**:
1. ✅ Unit tests for new code
2. ✅ Integration tests for new endpoints
3. ✅ E2E tests for new user flows

**Command**:
```bash
# Run tests for specific feature
npm run test -- --testPathPattern=onboarding
```

---

### Campaign 4: Security Testing

**Objective**: Verify security measures are working.

**Tests to Run**:
1. ✅ RBAC tests
2. ✅ Input sanitization tests
3. ✅ CSRF protection tests
4. ✅ Authentication tests

**Command**:
```bash
npm run test:security
```

---

## Best Practices

### 1. Test Organization

- **Unit tests**: Co-locate with source files (`__tests__` directory)
- **Integration tests**: `src/tests/integration/`
- **E2E tests**: `tests/e2e/`

### 2. Test Naming

- Use descriptive test names: `it('should do X when Y')`
- Group related tests with `describe` blocks
- Use clear describe hierarchy

### 3. Test Isolation

- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/cleanup
- Mock external dependencies

### 4. Test Data

- Use test fixtures for consistent data
- Clean up test data after tests
- Use factories for generating test data

### 5. Assertions

- Use specific assertions: `expect(x).toBe(y)` not `expect(x).toBeTruthy()`
- Test both success and error cases
- Verify side effects (database updates, API calls)

### 6. Async Testing

- Always await async operations
- Use `waitFor` for React Query hooks
- Handle promises correctly

---

## Troubleshooting

### Common Issues

#### 1. Tests Timeout

**Problem**: Tests take too long or timeout.

**Solution**:
- Increase timeout: `jest.setTimeout(10000)`
- Check for hanging promises
- Verify mocks are properly set up

#### 2. Mock Not Working

**Problem**: Mocked function not being called.

**Solution**:
- Verify mock is set up before import
- Check mock path matches import path
- Use `vi.mock()` at top of file

#### 3. Database Connection Issues

**Problem**: Tests fail with database errors.

**Solution**:
- Use test database
- Clean up test data
- Use transactions for isolation

#### 4. Frontend Tests Fail

**Problem**: React component tests fail.

**Solution**:
- Verify test setup file is correct
- Check for missing providers (QueryClient, AuthProvider)
- Ensure mocks are properly configured

---

## Additional Resources

- **Testing Strategy**: `TESTING_STRATEGY_COMPLETE.md`
- **Gap Analysis**: `TESTING_STRATEGY_GAPS_ANALYSIS.md`
- **Implementation Status**: `TESTING_IMPLEMENTATION_STATUS.md`
- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Playwright Documentation**: https://playwright.dev/docs/intro

---

**Last Updated**: Based on current implementation
**Status**: ✅ Complete Testing Guide
