# 🧪 PureTask Testing

## Quick Start

```bash
# Backend tests
npm run test

# Frontend tests
cd ../puretask-frontend && npm test

# Coverage
npm run test:coverage
```

## Test Coverage

[![Coverage](https://codecov.io/gh/your-org/puretask/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/puretask)

## Documentation

- **Master Guide**: `PURETASK_COMPLETE_TESTING_MASTER_GUIDE.md`
- **Developer Onboarding**: `DEVELOPER_ONBOARDING.md`
- **Testing Strategy**: `TESTING_STRATEGY_COMPLETE.md`

## Test Structure

```
src/
├── tests/
│   ├── mocks/          # External service mocks
│   ├── helpers/        # Test utilities
│   ├── fixtures/       # Test data
│   ├── performance/    # Performance tests
│   └── integration/    # Integration tests
```
