# PureTask Testing Campaigns

## 📋 Overview

This document outlines comprehensive testing campaigns for the PureTask application. Each campaign is designed to verify specific aspects of the system.

---

## Campaign 1: Pre-Release Testing

### Objective
Ensure all critical functionality works correctly before production release.

### Scope
- ✅ All unit tests
- ✅ All integration tests
- ✅ All E2E tests
- ✅ Security tests
- ✅ Performance tests

### Execution

**Backend**:
```bash
# Run all backend tests
npm run test

# Generate coverage report
npm run test:coverage

# Verify coverage thresholds
npm run test:coverage:report
```

**Frontend**:
```bash
# Run all frontend tests
npm test

# Run E2E tests
npm run test:e2e

# Generate coverage
npm run test:coverage
```

### Success Criteria
- ✅ All tests pass
- ✅ Coverage meets thresholds (80% for critical files)
- ✅ No critical bugs found
- ✅ Performance metrics within targets

### Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Coverage reports generated
- [ ] Security tests pass
- [ ] Performance tests pass
- [ ] Manual testing completed
- [ ] Cross-browser testing completed

---

## Campaign 2: Regression Testing

### Objective
Verify existing functionality after code changes.

### Scope
- ✅ Integration tests
- ✅ Critical E2E flows
- ✅ API endpoint tests
- ✅ Database migration tests

### Execution

```bash
# Run integration tests
npm run test:integration

# Run critical E2E flows
npm run test:e2e -- --grep "critical"

# Run API tests
npm run test -- --testPathPattern=integration.*api
```

### Success Criteria
- ✅ All integration tests pass
- ✅ Critical E2E flows work
- ✅ No regressions found

### Critical Flows to Test
1. User registration and login
2. Client booking flow
3. Cleaner onboarding
4. Payment processing
5. Job lifecycle (request → complete → payment)

---

## Campaign 3: New Feature Testing

### Objective
Verify new features work correctly before merging.

### Scope
- ✅ Unit tests for new code
- ✅ Integration tests for new endpoints
- ✅ E2E tests for new user flows
- ✅ Documentation updates

### Execution

```bash
# Run tests for specific feature
npm run test -- --testPathPattern=onboarding

# Run with coverage for new code
npm run test:coverage -- --testPathPattern=onboarding
```

### Success Criteria
- ✅ All new tests pass
- ✅ Coverage for new code > 80%
- ✅ Integration with existing features works
- ✅ Documentation updated

### Checklist
- [ ] Unit tests created for new code
- [ ] Integration tests created for new endpoints
- [ ] E2E tests created for new flows
- [ ] Existing tests still pass
- [ ] Documentation updated

---

## Campaign 4: Security Testing

### Objective
Verify security measures are working correctly.

### Scope
- ✅ Authentication tests
- ✅ Authorization tests (RBAC)
- ✅ Input sanitization tests
- ✅ CSRF protection tests
- ✅ SQL injection tests
- ✅ XSS prevention tests

### Execution

```bash
# Run security tests
npm run test:security

# Run authentication tests
npm run test -- --testPathPattern=auth

# Run middleware security tests
npm run test -- --testPathPattern=middleware.*security
```

### Success Criteria
- ✅ All security tests pass
- ✅ No vulnerabilities found
- ✅ RBAC working correctly
- ✅ Input sanitization working

### Security Areas to Test
1. **Authentication**
   - Login/logout
   - Token validation
   - Session management

2. **Authorization**
   - Role-based access control
   - Data isolation
   - Permission checks

3. **Input Validation**
   - XSS prevention
   - SQL injection prevention
   - CSRF protection

---

## Campaign 5: Performance Testing

### Objective
Verify application performance meets targets.

### Scope
- ✅ API response times
- ✅ Database query performance
- ✅ Frontend load times
- ✅ Worker execution times

### Execution

```bash
# Run performance tests
npm run test -- --testPathPattern=performance

# Run with performance profiling
npm run test -- --testPathPattern=performance --coverage=false
```

### Success Criteria
- ✅ API responses < 500ms
- ✅ Database queries < 100ms
- ✅ Page loads < 2s
- ✅ Workers complete in reasonable time

### Performance Targets
- **API Endpoints**: < 500ms (p95)
- **Database Queries**: < 100ms (p95)
- **Frontend Pages**: < 2s (First Contentful Paint)
- **Workers**: Complete within scheduled window

---

## Campaign 6: External Service Integration Testing

### Objective
Verify integrations with external services work correctly.

### Scope
- ✅ SendGrid email integration
- ✅ Twilio SMS integration
- ✅ n8n webhook integration
- ✅ Stripe payment integration

### Execution

```bash
# Run external service tests
npm run test -- --testPathPattern=externalServices

# Run with mocks (no actual API calls)
npm run test:integration -- --testPathPattern=externalServices
```

### Success Criteria
- ✅ All external service tests pass
- ✅ Error handling works correctly
- ✅ Retry logic works
- ✅ Rate limiting respected

### Services to Test
1. **SendGrid**
   - Email sending
   - Template rendering
   - Error handling

2. **Twilio**
   - SMS sending
   - OTP generation
   - Error handling

3. **n8n**
   - Workflow triggering
   - Webhook processing
   - Error handling

4. **Stripe**
   - Payment processing
   - Webhook handling
   - Idempotency

---

## Campaign 7: Worker Testing

### Objective
Verify background workers execute correctly.

### Scope
- ✅ Onboarding reminder worker
- ✅ Auto-cancel jobs worker
- ✅ Payout workers
- ✅ Analytics workers

### Execution

```bash
# Run worker tests
npm run test -- --testPathPattern=workers

# Test specific worker
npm run test -- --testPathPattern=onboardingReminderWorker
```

### Success Criteria
- ✅ All worker tests pass
- ✅ Workers handle errors gracefully
- ✅ Workers complete successfully
- ✅ Logging works correctly

### Workers to Test
1. **onboardingReminderWorker**: Sends reminders to abandoned cleaners
2. **autoCancelJobs**: Cancels jobs past deadline
3. **payoutWeekly**: Processes weekly payouts
4. **kpiDailySnapshot**: Generates daily analytics

---

## Campaign 8: Mobile Testing

### Objective
Verify application works correctly on mobile devices.

### Scope
- ✅ Responsive design
- ✅ Touch interactions
- ✅ Mobile navigation
- ✅ Mobile-specific features

### Execution

```bash
# Run E2E tests with mobile viewport
npm run test:e2e -- --project=mobile

# Or use Playwright mobile emulation
npx playwright test --project=mobile
```

### Success Criteria
- ✅ All mobile tests pass
- ✅ UI is responsive
- ✅ Touch targets are adequate
- ✅ Navigation works on mobile

---

## Campaign 9: Accessibility Testing

### Objective
Verify application is accessible to all users.

### Scope
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ ARIA labels
- ✅ Color contrast

### Execution

```bash
# Run accessibility tests
npm run test -- --testPathPattern=accessibility

# Use axe-core for automated testing
npm run test:a11y
```

### Success Criteria
- ✅ All accessibility tests pass
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation works
- ✅ Screen reader compatible

---

## Campaign 10: Cross-Browser Testing

### Objective
Verify application works across different browsers.

### Scope
- ✅ Chrome
- ✅ Firefox
- ✅ Safari
- ✅ Edge

### Execution

```bash
# Run E2E tests on all browsers
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit
```

### Success Criteria
- ✅ All tests pass on all browsers
- ✅ No browser-specific bugs
- ✅ Consistent behavior across browsers

---

## Running All Campaigns

### Complete Test Suite

```bash
# Backend: Run all tests
npm run test && npm run test:coverage

# Frontend: Run all tests
npm test && npm run test:e2e

# Generate combined coverage report
npm run test:coverage:report
```

### Continuous Integration

These campaigns should be run automatically in CI/CD:
- Pre-merge: Campaign 3 (New Feature Testing)
- Pre-release: Campaign 1 (Pre-Release Testing)
- Weekly: Campaign 2 (Regression Testing)
- Monthly: Campaign 4 (Security Testing)

---

## Test Results Tracking

### Metrics to Track
- Test pass rate
- Coverage percentage
- Test execution time
- Flaky test rate
- Bug detection rate

### Reporting
- Generate coverage reports after each campaign
- Track test metrics over time
- Identify and fix flaky tests
- Update test documentation

---

**Last Updated**: Based on current implementation
**Status**: ✅ Complete Testing Campaigns Guide
