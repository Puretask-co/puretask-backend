"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.withTransaction = withTransaction;
const pg_1 = require("pg");
const env_1 = require("../config/env");
// Detect test environment
const isTestEnv = process.env.RUNNING_TESTS === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true';
exports.pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL,
    // Connection pool settings for better reliability
    max: isTestEnv ? 5 : 20, // Very few connections in test environment (Neon free tier limit)
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: isTestEnv ? 15000 : 10000, // Longer timeout in tests (Neon can be slow)
    // Retry settings
    allowExitOnIdle: true, // Allow process to exit when pool is idle
});
async function query(text, params) {
    const res = await exports.pool.query(text, params);
    return res;
}
/**
 * Execute a function within a database transaction
 */
async function withTransaction(callback) {
    const client = await exports.pool.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
