import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    hookTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    pool: "forks", // helps with DB connection limits on Neon free tier
    poolOptions: {
      forks: {
        singleFork: true, // run tests sequentially to avoid Neon connection limits
      },
    },
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
