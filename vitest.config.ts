import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    hookTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    // Run tests sequentially in a single worker to avoid Neon connection limits.
    // Vitest 4 migration: replaces `pool: "forks"` + `poolOptions.forks.singleFork`.
    maxWorkers: 1,
    isolate: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
