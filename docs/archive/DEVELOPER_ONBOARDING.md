# 🚀 PureTask Developer Onboarding Guide

## Welcome!

This guide will help you get started with the PureTask codebase, run tests, and contribute effectively.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 20+ installed
- **PostgreSQL** 15+ installed and running
- **Git** installed
- **npm** or **yarn** package manager
- Code editor (VS Code recommended)

---

## 🏗️ Local Environment Setup

### **1. Clone the Repository**

```bash
git clone <repository-url>
cd puretask-backend
```

### **2. Install Dependencies**

```bash
# Backend
npm install

# Frontend (in separate terminal)
cd ../puretask-frontend
npm install
```

### **3. Set Up Environment Variables**

**Backend** (`.env`):
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/puretask_dev
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your-key
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
STRIPE_SECRET_KEY=your-key
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### **4. Set Up Database**

```bash
# Run migrations
npm run migrate

# Or manually
psql -U postgres -d puretask_dev -f DB/migrations/001_init.sql
```

### **5. Start Development Servers**

```bash
# Backend (Terminal 1)
npm run dev

# Frontend (Terminal 2)
cd ../puretask-frontend
npm run dev
```

---

## 🧪 Running Tests

### **Backend Tests**

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### **Frontend Tests**

```bash
cd ../puretask-frontend

# All tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

### **Running Specific Tests**

```bash
# Backend: Run tests matching pattern
npm run test -- --testPathPatterns="auth"

# Frontend: Run specific test file
npm test -- Header.test.tsx
```

---

## ✍️ Writing New Tests

### **Backend Test Structure**

```typescript
// src/services/__tests__/myService.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { myService } from '../myService';

describe('myService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', async () => {
    const result = await myService.doSomething();
    expect(result).toBeDefined();
  });
});
```

### **Frontend Test Structure**

```typescript
// src/components/__tests__/MyComponent.test.tsx
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### **Using Test Fixtures**

```typescript
import { createTestClient, createTestCleaner } from '../fixtures/users';
import { createTestJob } from '../fixtures/bookings';

const client = await createTestClient();
const job = await createTestJob({ client_id: client.id });
```

### **Using Mocks**

```typescript
import { createMockPaymentIntent } from '../mocks/stripe';
import { createMockSendGridSuccess } from '../mocks/sendgrid';

const mockPayment = createMockPaymentIntent({ amount: 10000 });
```

---

## 🎯 Testing Best Practices

### **1. Test Structure**

- **Arrange**: Set up test data
- **Act**: Execute the code being tested
- **Assert**: Verify the results

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(30);
});
```

### **2. Test Naming**

- Use descriptive names: `it('should return user when valid ID provided')`
- Group related tests: `describe('UserService', () => { ... })`

### **3. Test Isolation**

- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/cleanup
- Don't rely on test execution order

### **4. Mocking External Services**

- Always mock external APIs (Stripe, SendGrid, Twilio)
- Use test fixtures for database data
- Clean up after tests

### **5. Coverage Goals**

- Aim for 80%+ coverage
- Focus on critical paths first
- Don't test implementation details

---

## 🐛 Common Issues & Solutions

### **Issue: Tests fail with database connection error**

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

### **Issue: Frontend tests fail with module not found**

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

### **Issue: Tests timeout**

**Solution**:
- Increase timeout in test: `jest.setTimeout(10000)`
- Check for hanging promises
- Verify mocks are set up correctly

### **Issue: Coverage not generating**

**Solution**:
```bash
# Use coverage config
npm run test:coverage

# Check jest.config.coverage.js exists
```

---

## 📚 Resources

### **Documentation**

- **Testing Master Guide**: `PURETASK_COMPLETE_TESTING_MASTER_GUIDE.md`
- **Testing Strategy**: `TESTING_STRATEGY_COMPLETE.md`
- **Gap Analysis**: `TESTING_STRATEGY_GAPS_ANALYSIS.md`

### **External Resources**

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev)

---

## 🚀 Quick Start Checklist

- [ ] Clone repository
- [ ] Install dependencies (backend & frontend)
- [ ] Set up environment variables
- [ ] Set up database
- [ ] Run migrations
- [ ] Start development servers
- [ ] Run tests to verify setup
- [ ] Read testing master guide
- [ ] Write your first test!

---

## 💡 Tips

1. **Run tests frequently** - Catch issues early
2. **Use watch mode** - Tests run automatically on file changes
3. **Check coverage** - Aim for high coverage on critical paths
4. **Read existing tests** - Learn patterns from existing code
5. **Ask questions** - Don't hesitate to ask for help

---

## 🎉 You're Ready!

You now have everything you need to start contributing to PureTask. Happy coding!

**Questions?** Check the testing master guide or ask the team.
