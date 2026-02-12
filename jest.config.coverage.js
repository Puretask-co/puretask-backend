// jest.config.coverage.js
// Jest configuration with coverage settings

module.exports = {
  ...require('./jest.config.js'),
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/tests/**',
    '!src/__tests__/**',
    '!src/index.ts', // Entry point
    '!src/**/index.ts', // Barrel exports
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    // Stricter thresholds for critical files
    './src/lib/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/middleware/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
