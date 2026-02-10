# PureTask Testing Explanations

## 📚 Comprehensive Guide to All Test Types

This document provides detailed explanations of every test type used in the PureTask application, with examples and best practices.

---

## 1. Unit Tests

### What Are Unit Tests?

Unit tests verify that individual functions or components work correctly in isolation, without external dependencies like databases, APIs, or file systems.

### Why We Use Them

- **Fast execution**: Run in milliseconds
- **Isolated**: Don't depend on external systems
- **Reliable**: Deterministic results
- **Easy to debug**: Failures point to specific code

### Example: Backend Utility

```typescript
// src/lib/__tests__/tiers.test.ts
describe('tiers utilities', () => {
  it('converts legacy bronze to Developing', () => {
    expect(toCanonicalTier('bronze')).toBe('Developing');
  });
});
```

**What it tests**: A pure function that converts tier names.

**Why it's a unit test**: No database, no API calls, just function logic.

### Example: Frontend Hook

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

**What it tests**: A React hook that manages onboarding state.

**Why it's a unit test**: Mocks API calls, tests hook logic in isolation.

### Best Practices

1. **Test one thing**: Each test should verify one behavior
2. **Use descriptive names**: `it('should do X when Y')`
3. **Mock external dependencies**: Don't call real APIs or databases
4. **Test edge cases**: Null, undefined, empty strings, etc.

---

## 2. Integration Tests

### What Are Integration Tests?

Integration tests verify that multiple components or systems work together correctly. They test the "seams" between units.

### Why We Use Them

- **Verify interactions**: Ensure components work together
- **Catch integration bugs**: Issues that unit tests miss
- **Test real workflows**: End-to-end business logic
- **Validate APIs**: Ensure endpoints work correctly

### Example: API Endpoint

```typescript
// src/tests/integration/auth.test.ts
describe('Auth Flow Integration', () => {
  it('creates all required records for client signup', async () => {
    const res = await app.post('/auth/register').send({
      email: 'newclient@test.com',
      password: 'password123',
      role: 'client',
    });
    
    // Verify user created
    const user = await query('SELECT * FROM users WHERE email = $1', ['newclient@test.com']);
    expect(user.rows.length).toBe(1);
    
    // Verify client profile created
    const profile = await query('SELECT * FROM client_profiles WHERE user_id = $1', [user.rows[0].id]);
    expect(profile.rows.length).toBe(1);
  });
});
```

**What it tests**: Complete signup flow including database operations.

**Why it's an integration test**: Tests API + database + business logic together.

### Example: External Service

```typescript
// src/tests/integration/externalServices.test.ts
describe('SendGrid Email Integration', () => {
  it('sends onboarding reminder email via SendGrid', async () => {
    const result = await sendOnboardingReminder(mockCleaner);
    expect(result.success).toBe(true);
    expect(sgMail.send).toHaveBeenCalled();
  });
});
```

**What it tests**: Integration with SendGrid email service.

**Why it's an integration test**: Tests our code + external service interaction.

### Best Practices

1. **Use test database**: Don't pollute production data
2. **Clean up after tests**: Delete test data
3. **Test real workflows**: Simulate actual user scenarios
4. **Mock external services**: Use mocks for third-party APIs

---

## 3. End-to-End (E2E) Tests

### What Are E2E Tests?

E2E tests simulate real user interactions with the application in a browser. They test the complete system from UI to database.

### Why We Use Them

- **User perspective**: Test what users actually experience
- **Complete flows**: Verify entire user journeys
- **Browser testing**: Catch browser-specific issues
- **UI validation**: Ensure UI works correctly

### Example: Booking Flow

```typescript
// tests/e2e/booking-flow.spec.ts
test('complete booking flow from signup to confirmation', async ({ page }) => {
  // Step 1: Sign up
  await page.goto('/');
  await page.click('text=Sign Up');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button:has-text("Sign Up")');
  
  // Step 2: Navigate to booking
  await page.click('text=Book Cleaning');
  
  // Step 3: Complete booking
  await page.click('text=Regular Clean');
  // ... complete flow
  
  // Verify booking created
  await expect(page).toHaveURL(/\/booking\/confirm\//);
});
```

**What it tests**: Complete user journey from signup to booking confirmation.

**Why it's an E2E test**: Tests UI + API + database + business logic together.

### Best Practices

1. **Test critical paths**: Focus on important user flows
2. **Use data-testid**: Prefer stable selectors
3. **Wait for elements**: Use `waitFor` for async operations
4. **Keep tests independent**: Each test should be standalone

---

## 4. Service Tests

### What Are Service Tests?

Service tests verify backend services that contain business logic. They test services in isolation but may use real database connections.

### Why We Use Them

- **Business logic**: Test core application logic
- **Data transformations**: Verify data processing
- **Service integration**: Test service-to-service calls
- **Error handling**: Verify error scenarios

### Example: Phone Verification Service

```typescript
// src/services/__tests__/phoneVerificationService.test.ts
describe('phoneVerificationService', () => {
  it('sends OTP and stores in database', async () => {
    const result = await sendOTP('user-123', '+11234567890');
    
    expect(result.success).toBe(true);
    expect(mockQuery).toHaveBeenCalled();
    expect(twilioClient.messages.create).toHaveBeenCalled();
  });
});
```

**What it tests**: Phone verification service logic including database and Twilio.

**Why it's a service test**: Tests service layer with mocked dependencies.

### Best Practices

1. **Mock external APIs**: Don't call real Twilio/SendGrid
2. **Test error cases**: Verify error handling
3. **Test edge cases**: Invalid input, missing data, etc.
4. **Verify side effects**: Check database updates, API calls

---

## 5. Worker Tests

### What Are Worker Tests?

Worker tests verify background workers that run scheduled tasks. These workers process batches, send emails, generate reports, etc.

### Why We Use Them

- **Scheduled tasks**: Verify workers execute correctly
- **Batch processing**: Test bulk operations
- **Error handling**: Ensure workers handle failures
- **Logging**: Verify proper logging

### Example: Onboarding Reminder Worker

```typescript
// src/workers/__tests__/onboardingReminderWorker.test.ts
describe('onboardingReminderWorker', () => {
  it('sends reminders successfully', async () => {
    const result = await runOnboardingReminderWorker();
    
    expect(result.success).toBe(true);
    expect(result.count).toBe(5);
    expect(sendOnboardingReminders).toHaveBeenCalledWith(24);
  });
});
```

**What it tests**: Worker that sends reminder emails to abandoned cleaners.

**Why it's a worker test**: Tests scheduled task execution.

### Best Practices

1. **Mock service calls**: Don't actually send emails
2. **Test error scenarios**: Verify graceful failure handling
3. **Verify logging**: Check that events are logged
4. **Test batch processing**: Verify multiple items processed

---

## 6. Context Tests

### What Are Context Tests?

Context tests verify React contexts that manage global application state (authentication, notifications, WebSocket connections).

### Why We Use Them

- **Global state**: Test shared state management
- **Provider logic**: Verify context providers work
- **Hook integration**: Test context hooks
- **State updates**: Verify state changes correctly

### Example: Auth Context

```typescript
// src/contexts/__tests__/AuthContext.test.tsx
describe('AuthContext', () => {
  it('authenticates user and stores token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('test-token');
  });
});
```

**What it tests**: Authentication context that manages user state.

**Why it's a context test**: Tests React context and global state.

### Best Practices

1. **Wrap with providers**: Provide all required context providers
2. **Test state changes**: Verify state updates correctly
3. **Test side effects**: Check localStorage, API calls
4. **Test error cases**: Verify error handling

---

## 7. Hook Tests

### What Are Hook Tests?

Hook tests verify React hooks that encapsulate logic (data fetching, form handling, state management).

### Why We Use Them

- **Reusable logic**: Test hooks that are used across components
- **Data fetching**: Verify React Query hooks
- **State management**: Test custom state hooks
- **Form handling**: Test form validation hooks

### Example: Booking Hook

```typescript
// src/hooks/__tests__/useBookings.test.tsx
describe('useBookings', () => {
  it('fetches bookings', async () => {
    const { result } = renderHook(() => useBookings(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data?.data).toHaveLength(2);
  });
});
```

**What it tests**: Hook that fetches and manages booking data.

**Why it's a hook test**: Tests React hook logic with mocked API.

### Best Practices

1. **Use QueryClientProvider**: Wrap with React Query provider
2. **Wait for async**: Use `waitFor` for async operations
3. **Test loading states**: Verify loading/error states
4. **Test mutations**: Verify create/update/delete operations

---

## 8. Middleware Tests

### What Are Middleware Tests?

Middleware tests verify Express middleware functions that process requests (authentication, validation, rate limiting).

### Why We Use Them

- **Request processing**: Verify middleware logic
- **Security**: Test authentication/authorization
- **Validation**: Verify input validation
- **Error handling**: Test error responses

### Example: JWT Auth Middleware

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

**What it tests**: Middleware that validates JWT tokens and attaches user.

**Why it's a middleware test**: Tests Express middleware function.

### Best Practices

1. **Mock dependencies**: Mock JWT verification, database calls
2. **Test all paths**: Valid token, invalid token, missing token
3. **Verify responses**: Check status codes, error messages
4. **Test edge cases**: Expired tokens, malformed tokens

---

## 9. Component Tests

### What Are Component Tests?

Component tests verify React components render correctly and handle user interactions.

### Why We Use Them

- **UI rendering**: Verify components render
- **User interactions**: Test clicks, form inputs
- **Props handling**: Verify prop-based behavior
- **State updates**: Test component state changes

### Example: Button Component

```typescript
// src/components/__tests__/Button.test.tsx
describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

**What it tests**: Button component click handling.

**Why it's a component test**: Tests React component behavior.

### Best Practices

1. **Test user interactions**: Clicks, inputs, form submissions
2. **Test rendering**: Verify correct elements render
3. **Test props**: Verify prop-based behavior
4. **Use data-testid**: Prefer stable selectors

---

## 10. API Client Tests

### What Are API Client Tests?

API client tests verify the frontend API client (axios interceptors, request/response handling, error handling).

### Why We Use Them

- **Request interceptors**: Verify token injection
- **Response interceptors**: Test error handling, redirects
- **Error handling**: Verify 401 redirects, error messages
- **Request formatting**: Verify correct request format

### Example: API Interceptor

```typescript
// src/lib/__tests__/api.test.ts
describe('API Client', () => {
  it('adds auth token to requests', () => {
    localStorage.setItem('auth_token', 'test-token');
    
    apiClient.get('/test');
    
    expect(mockAxios.get).toHaveBeenCalledWith(
      '/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });
});
```

**What it tests**: API client request interceptor.

**Why it's an API client test**: Tests HTTP client configuration.

### Best Practices

1. **Mock axios**: Don't make real HTTP requests
2. **Test interceptors**: Verify request/response interceptors
3. **Test error handling**: Verify 401 redirects, error messages
4. **Test token management**: Verify token storage/retrieval

---

## Test Coverage Explained

### What Is Coverage?

Coverage measures how much of your code is executed by tests. It's expressed as a percentage.

### Coverage Types

1. **Line Coverage**: Percentage of lines executed
2. **Branch Coverage**: Percentage of branches (if/else) executed
3. **Function Coverage**: Percentage of functions called
4. **Statement Coverage**: Percentage of statements executed

### Our Coverage Goals

- **Global**: 70% branches, 75% functions, 80% lines
- **Critical Files**: 80% branches, 85% functions, 85% lines
- **Services**: 75% branches, 80% functions, 80% lines

### Why Coverage Matters

- **Find untested code**: Identify areas without tests
- **Quality metric**: Higher coverage = more confidence
- **Regression prevention**: More tests = fewer bugs

### Coverage Limitations

- **100% coverage ≠ 100% tested**: Coverage doesn't mean code is well-tested
- **Quality over quantity**: Better to have fewer, better tests
- **Focus on critical paths**: Test important code thoroughly

---

## Test Organization

### Directory Structure

```
src/
├── lib/
│   ├── __tests__/          # Unit tests for utilities
│   └── tiers.ts
├── services/
│   ├── __tests__/          # Service tests
│   └── authService.ts
├── middleware/
│   ├── __tests__/          # Middleware tests
│   └── jwtAuth.ts
├── workers/
│   ├── __tests__/          # Worker tests
│   └── onboardingReminderWorker.ts
└── tests/
    ├── integration/        # Integration tests
    ├── unit/               # Additional unit tests
    └── setup.ts            # Test setup
```

### Naming Conventions

- **Test files**: `*.test.ts` or `*.spec.ts`
- **Test directories**: `__tests__` or `tests`
- **Describe blocks**: Match file/function name
- **Test names**: `it('should do X when Y')`

---

## Mocking Explained

### What Is Mocking?

Mocking replaces real dependencies with fake implementations for testing.

### Why We Mock

- **Isolation**: Test code without external dependencies
- **Speed**: Mocks are faster than real APIs
- **Control**: Control mock behavior for different scenarios
- **Reliability**: Don't depend on external services

### What We Mock

1. **External APIs**: SendGrid, Twilio, Stripe
2. **Database**: Query results
3. **File system**: File operations
4. **Time**: Date/time functions
5. **Random**: Random number generation

### Example: Mocking Database

```typescript
vi.mock('../../db/client');
const mockQuery = query as any;
mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });
```

### Example: Mocking API

```typescript
vi.mock('@/lib/api');
const mockApiClient = apiClient as any;
mockApiClient.get.mockResolvedValueOnce({ data: mockUser });
```

---

## Best Practices Summary

### 1. Test Structure

- **Arrange**: Set up test data
- **Act**: Execute the code being tested
- **Assert**: Verify the results

### 2. Test Independence

- Each test should be independent
- Don't rely on test execution order
- Clean up after each test

### 3. Test Naming

- Use descriptive names
- Follow pattern: `it('should do X when Y')`
- Group related tests with `describe`

### 4. Test Data

- Use factories for test data
- Keep test data minimal
- Clean up test data

### 5. Async Testing

- Always await async operations
- Use `waitFor` for React hooks
- Handle promises correctly

### 6. Error Testing

- Test both success and error cases
- Verify error messages
- Test error handling

---

**Last Updated**: Based on current implementation
**Status**: ✅ Complete Testing Explanations Guide
