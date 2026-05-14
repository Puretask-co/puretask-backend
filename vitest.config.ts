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
      // Floor calibrated to the deterministic CI slice (test:ci:coverage) on
      // 2026-05-13: stmts 95.43, branch 91.55, funcs 98.21, lines 95.22.
      // Ratchet upward by ~2 points per quarter; never lower.
      thresholds: {
        statements: 93,
        branches: 89,
        functions: 96,
        lines: 93,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
