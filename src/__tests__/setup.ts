// src/__tests__/setup.ts
// Global test setup and teardown

import { vi } from "vitest";
import { pool } from "../db/client";

// Setup runs once before all tests
beforeAll(async () => {
  // Connect to test database
  console.log("🧪 Connecting to test database...");

  // Set test environment
  process.env.NODE_ENV = "test";
});

// Teardown runs once after all tests
afterAll(async () => {
  // Close database connections
  console.log("🧹 Cleaning up test environment...");
  await pool.end();
});

// Reset database state before each test
beforeEach(async () => {
  // Clear test data (optional - uncomment if needed)
  // await pool.query('TRUNCATE TABLE users CASCADE');
});

// Clean up after each test
afterEach(async () => {
  // Clear mocks
  vi.clearAllMocks();
});

// Custom Vitest matchers (toBeValidUUID, toBeValidEmail, toBeValidJWT)

expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`,
    };
  },

  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid JWT`
          : `Expected ${received} to be a valid JWT`,
    };
  },
});
