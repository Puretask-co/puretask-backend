// src/tests/setup.ts
// Test setup and configuration

import { beforeAll, afterAll } from "vitest";
import { pool } from "../db/client";

// Increase timeout for integration tests
beforeAll(async () => {
  // Wait for database connection
  try {
    await pool.query("SELECT 1");
    console.log("✓ Database connection established");
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error;
  }
});

afterAll(async () => {
  // Close database connection pool
  await pool.end();
  console.log("✓ Database connection pool closed");
});

// Global error handler for unhandled rejections in tests
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

