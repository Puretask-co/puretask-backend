// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 120000, // 120 seconds for database connection retries (increased for Neon free tier)
    // Run tests sequentially to avoid overwhelming database connection pool
    // Neon free tier has connection limits that can be hit with parallel tests
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially (one file at a time)
      },
    },
    env: {
      // Set flag so server doesn't start during tests
      RUNNING_TESTS: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**", "src/types/**"],
    },
  },
});

