"use strict";
// src/tests/helpers/testUtils.ts
// Test utilities for creating test users, jobs, and common operations
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestClient = createTestClient;
exports.createTestCleaner = createTestCleaner;
exports.createTestAdmin = createTestAdmin;
exports.createTestJob = createTestJob;
exports.addCreditsToUser = addCreditsToUser;
exports.getUserBalance = getUserBalance;
exports.transitionJobTo = transitionJobTo;
exports.cleanupTestData = cleanupTestData;
exports.assertJobStatus = assertJobStatus;
exports.assertCreditLedgerEntry = assertCreditLedgerEntry;
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../../index"));
const client_1 = require("../../db/client");
// ============================================
// Unique ID Generator
// ============================================
let uniqueCounter = 0;
function uniqueEmail(prefix) {
    uniqueCounter += 1;
    return `${prefix}+${Date.now()}_${uniqueCounter}@test.puretask.com`;
}
// ============================================
// User Creation
// ============================================
/**
 * Create a test client user
 */
async function createTestClient() {
    const email = uniqueEmail("client");
    const password = "testpassword123";
    const res = await (0, supertest_1.default)(index_1.default)
        .post("/auth/register")
        .send({
        email,
        password,
        role: "client",
    });
    if (res.status !== 201) {
        throw new Error(`Failed to create test client: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        id: res.body.user.id,
        email: res.body.user.email,
        role: res.body.user.role,
        token: res.body.token,
    };
}
/**
 * Create a test cleaner user
 */
async function createTestCleaner() {
    const email = uniqueEmail("cleaner");
    const password = "testpassword123";
    const res = await (0, supertest_1.default)(index_1.default)
        .post("/auth/register")
        .send({
        email,
        password,
        role: "cleaner",
    });
    if (res.status !== 201) {
        throw new Error(`Failed to create test cleaner: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        id: res.body.user.id,
        email: res.body.user.email,
        role: res.body.user.role,
        token: res.body.token,
    };
}
/**
 * Create a test admin user (directly in DB since admin can't self-register)
 */
async function createTestAdmin() {
    const email = uniqueEmail("admin");
    // Note: In real tests, you'd hash the password properly
    // For simplicity, we'll create via DB and then login
    const bcrypt = await Promise.resolve().then(() => __importStar(require("bcryptjs")));
    const passwordHash = await bcrypt.hash("adminpassword123", 10);
    const result = await (0, client_1.query)(`
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'admin')
      RETURNING id, email, role
    `, [email, passwordHash]);
    const user = result.rows[0];
    // Login to get token
    const loginRes = await (0, supertest_1.default)(index_1.default)
        .post("/auth/login")
        .send({ email, password: "adminpassword123" });
    if (loginRes.status !== 200) {
        throw new Error(`Failed to login test admin: ${loginRes.status}`);
    }
    return {
        id: user.id,
        email: user.email,
        role: "admin",
        token: loginRes.body.token,
    };
}
// ============================================
// Job Creation
// ============================================
/**
 * Create a test job for a client
 */
async function createTestJob(client, options) {
    const now = new Date();
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    const res = await (0, supertest_1.default)(index_1.default)
        .post("/jobs")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
        scheduled_start_at: now.toISOString(),
        scheduled_end_at: endTime.toISOString(),
        address: options?.address || "123 Test Street, Test City",
        credit_amount: options?.creditAmount || 100,
    });
    if (res.status !== 201) {
        throw new Error(`Failed to create test job: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        id: res.body.job.id,
        client_id: res.body.job.client_id,
        cleaner_id: res.body.job.cleaner_id,
        status: res.body.job.status,
        credit_amount: res.body.job.credit_amount,
    };
}
// ============================================
// Credit Operations
// ============================================
/**
 * Add credits to a user's account (directly in DB)
 */
async function addCreditsToUser(userId, amount) {
    await (0, client_1.query)(`
      INSERT INTO credit_ledger (user_id, delta_credits, reason)
      VALUES ($1, $2, 'purchase')
    `, [userId, amount]);
}
/**
 * Get user's credit balance
 */
async function getUserBalance(userId) {
    const result = await (0, client_1.query)(`SELECT COALESCE(SUM(delta_credits), 0) as balance FROM credit_ledger WHERE user_id = $1`, [userId]);
    return Number(result.rows[0]?.balance || 0);
}
// ============================================
// Job State Transitions (for test setup)
// ============================================
/**
 * Transition a job through states for testing
 */
async function transitionJobTo(jobId, targetStatus, cleanerId) {
    const updates = [`status = '${targetStatus}'`, `updated_at = NOW()`];
    if (cleanerId) {
        updates.push(`cleaner_id = '${cleanerId}'`);
    }
    await (0, client_1.query)(`UPDATE jobs SET ${updates.join(", ")} WHERE id = $1`, [jobId]);
}
// ============================================
// Cleanup
// ============================================
/**
 * Clean up test data (call in afterAll or afterEach)
 */
async function cleanupTestData() {
    // Delete in order of dependencies
    await (0, client_1.query)(`DELETE FROM notification_failures WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM credit_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM payouts WHERE cleaner_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM disputes WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com'))`);
    await (0, client_1.query)(`DELETE FROM jobs WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM cleaner_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM client_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
    await (0, client_1.query)(`DELETE FROM users WHERE email LIKE '%@test.puretask.com'`);
}
// ============================================
// Assertion Helpers
// ============================================
/**
 * Assert job is in expected status
 */
async function assertJobStatus(jobId, expectedStatus) {
    const result = await (0, client_1.query)(`SELECT status FROM jobs WHERE id = $1`, [jobId]);
    if (result.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
    }
    if (result.rows[0].status !== expectedStatus) {
        throw new Error(`Expected job status '${expectedStatus}', got '${result.rows[0].status}'`);
    }
}
/**
 * Assert credit ledger has expected entry
 */
async function assertCreditLedgerEntry(userId, jobId, expectedReason, expectedAmount) {
    const result = await (0, client_1.query)(`
      SELECT delta_credits, reason
      FROM credit_ledger
      WHERE user_id = $1 AND job_id = $2 AND reason = $3
    `, [userId, jobId, expectedReason]);
    if (result.rows.length === 0) {
        throw new Error(`Credit ledger entry not found for user ${userId}, job ${jobId}, reason ${expectedReason}`);
    }
    if (expectedAmount !== undefined && result.rows[0].delta_credits !== expectedAmount) {
        throw new Error(`Expected credit amount ${expectedAmount}, got ${result.rows[0].delta_credits}`);
    }
}
