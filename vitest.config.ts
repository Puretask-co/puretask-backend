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
    hookTimeout: 30000,
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

