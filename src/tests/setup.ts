// src/tests/setup.ts
// Test setup and configuration

import { beforeAll, afterAll } from "vitest";
import { pool } from "../db/client";

// Helper to retry database connection with exponential backoff
// Add a small random delay to prevent thundering herd when multiple test files start simultaneously
async function waitForDatabase(maxRetries = 5, delayMs = 1000): Promise<void> {
  // Add random jitter (0-1000ms) to stagger connection attempts across test files
  // This helps when tests run in parallel (though we're using singleFork now)
  const jitter = Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, jitter));
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use a simple query with a longer timeout (10 seconds per attempt)
      // Neon connections can be slow, especially on free tier
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout")), 10000)
        )
      ]);
      console.log("✓ Database connection established");
      return;
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error(`✗ Database connection failed after ${maxRetries} attempts`);
        console.error("Error:", error.message);
        console.error("Code:", error.code);
        // Don't throw - let individual tests handle connection errors
        // This allows tests to run even if DB is temporarily unavailable
        console.warn("⚠️  Continuing with tests - some may fail if DB is unavailable");
        return;
      }
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.warn(`⚠️  Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Increase timeout for integration tests
// Vitest default hook timeout is 30s, but we need more time for retries
// Note: This timeout should match or be less than the global hookTimeout in vitest.config.ts
beforeAll(async () => {
  // Wait for database connection with retries
  await waitForDatabase();
}, 120000); // 120 second timeout (matches global hookTimeout in vitest.config.ts)

afterAll(async () => {
  // Close database connection pool
  await pool.end();
  console.log("✓ Database connection pool closed");
});

// Global error handler for unhandled rejections in tests
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

