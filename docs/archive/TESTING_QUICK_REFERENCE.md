# PureTask Testing - Quick Reference

## 🚀 Quick Commands

### Backend Tests
```bash
npm run test                    # Run all tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:coverage          # With coverage
npm run test:coverage:html     # Open HTML report
npm run test:watch             # Watch mode
```

### Frontend Tests
```bash
npm test                       # Run all tests
npm run test:coverage          # With coverage
npm run test:e2e               # E2E tests
npm run test:watch             # Watch mode
```

---

## 📁 Test File Locations

### Backend
```
src/lib/__tests__/             # Utility tests
src/services/__tests__/        # Service tests
src/middleware/__tests__/      # Middleware tests
src/workers/__tests__/         # Worker tests
src/tests/integration/         # Integration tests
src/tests/unit/                # Additional unit tests
```

### Frontend
```
src/contexts/__tests__/        # Context tests
src/hooks/__tests__/           # Hook tests
src/components/__tests__/      # Component tests
tests/e2e/                     # E2E tests
```

---

## 📊 Coverage Targets

- **Global**: 70% branches, 75% functions, 80% lines
- **Critical Files**: 80% branches, 85% functions, 85% lines
- **Services**: 75% branches, 80% functions, 80% lines

---

## 🎯 Test Types

1. **Unit Tests** - Individual functions/components
2. **Integration Tests** - Multiple systems together
3. **E2E Tests** - Complete user flows
4. **Service Tests** - Backend business logic
5. **Worker Tests** - Background tasks
6. **Context Tests** - React global state
7. **Hook Tests** - React custom hooks
8. **Middleware Tests** - Express middleware
9. **Component Tests** - React components
10. **API Client Tests** - HTTP client

---

## 📚 Documentation

- **Master Guide**: `PURETASK_COMPLETE_TESTING_MASTER_GUIDE.md`
- **Strategy**: `TESTING_STRATEGY_COMPLETE.md`
- **Gap Analysis**: `TESTING_STRATEGY_GAPS_ANALYSIS.md`
- **Campaigns**: `TESTING_CAMPAIGNS.md`
- **Explanations**: `TESTING_EXPLANATIONS.md`

---

**For complete details, see `PURETASK_COMPLETE_TESTING_MASTER_GUIDE.md`**
