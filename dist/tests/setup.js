"use strict";
// src/tests/setup.ts
// Test setup and configuration
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("../db/client");
// Increase timeout for integration tests
(0, vitest_1.beforeAll)(async () => {
    // Wait for database connection
    try {
        await client_1.pool.query("SELECT 1");
        console.log("✓ Database connection established");
    }
    catch (error) {
        console.error("✗ Database connection failed:", error);
        throw error;
    }
});
(0, vitest_1.afterAll)(async () => {
    // Close database connection pool
    await client_1.pool.end();
    console.log("✓ Database connection pool closed");
});
// Global error handler for unhandled rejections in tests
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
