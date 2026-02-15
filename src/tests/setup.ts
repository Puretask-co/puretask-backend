// src/tests/setup.ts
// Test setup and teardown - runs before all tests

import { config } from "dotenv";
config(); // Load .env before any modules that need it

import { beforeAll, afterAll, vi } from "vitest";

// Use test DB before any module loads db client
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Mock logger globally so modules that load early (e.g. rateLimitRedis) get a compliant logger
vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  generateRequestId: () => `test-req-${Math.random().toString(36).slice(2, 10)}`,
  withRequestContext: <T>(_ctx: object, fn: () => T) => fn(),
  enrichContext: vi.fn(),
  getRequestContext: () => undefined,
}));

beforeAll(async () => {
  // Ensure test config is set (in case setup runs after some imports)
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
});

afterAll(async () => {
  // Cleanup after all tests
});
