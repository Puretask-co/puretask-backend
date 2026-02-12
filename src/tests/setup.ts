// src/tests/setup.ts
// Test setup and teardown

import { beforeAll, afterAll } from "@jest/globals";

// Global test setup
beforeAll(async () => {
  // Setup test database connection if needed
  // Mock external services
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-key";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
});

afterAll(async () => {
  // Cleanup after all tests
});
