"use strict";
// src/lib/workerUtils.ts
// V1 HARDENING: Reusable utilities for worker concurrency guards and observability
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorkerWithLock = runWorkerWithLock;
exports.getWorkerLockId = getWorkerLockId;
const client_1 = require("../db/client");
const logger_1 = require("./logger");
/**
 * V1 HARDENING: Execute a worker function with advisory lock and run tracking
 *
 * @param workerName - Unique name for the worker (e.g., "payouts", "auto-cancel")
 * @param lockId - Unique PostgreSQL advisory lock ID (must be unique per worker)
 * @param workerFn - The actual worker function to execute
 * @returns Worker result or null if lock was already held
 */
async function runWorkerWithLock(workerName, lockId, workerFn) {
    const client = await client_1.pool.connect();
    let workerRunId = null;
    try {
        // Try to acquire advisory lock (non-blocking)
        const lockResult = await client.query(`SELECT pg_try_advisory_lock($1) as pg_try_advisory_lock`, [lockId]);
        if (!lockResult.rows[0]?.pg_try_advisory_lock) {
            logger_1.logger.warn("worker_locked", {
                workerName,
                lockId,
                message: `Another ${workerName} worker is already running. Skipping this run.`,
            });
            return null;
        }
        // Record worker run start
        const runResult = await client.query(`
        INSERT INTO worker_runs (worker_name, status, started_at)
        VALUES ($1, 'running', NOW())
        RETURNING id
      `, [workerName]);
        workerRunId = runResult.rows[0]?.id || null;
        logger_1.logger.info("worker_started", {
            workerName,
            workerRunId,
        });
        // Execute the worker function
        const result = await workerFn();
        // Update worker run as successful
        if (workerRunId) {
            await client.query(`
          UPDATE worker_runs
          SET status = 'success',
              finished_at = NOW(),
              processed = $1,
              failed = $2,
              metadata = $3::jsonb
          WHERE id = $4
        `, [
                result.processed || 0,
                result.failed || 0,
                JSON.stringify(result),
                workerRunId,
            ]);
        }
        logger_1.logger.info("worker_completed", {
            workerName,
            workerRunId,
            ...result,
        });
        return result;
    }
    catch (error) {
        // Update worker run as failed
        if (workerRunId) {
            await client.query(`
          UPDATE worker_runs
          SET status = 'failed',
              finished_at = NOW(),
              error_message = $1
          WHERE id = $2
        `, [error.message, workerRunId]).catch((updateError) => {
                logger_1.logger.error("worker_run_update_failed", {
                    workerName,
                    workerRunId,
                    error: updateError.message,
                });
            });
        }
        logger_1.logger.error("worker_failed", {
            workerName,
            workerRunId,
            error: error.message,
        });
        throw error;
    }
    finally {
        // Release advisory lock
        await client.query(`SELECT pg_advisory_unlock($1)`, [lockId]).catch((unlockError) => {
            logger_1.logger.error("worker_unlock_failed", {
                workerName,
                lockId,
                error: unlockError.message,
            });
        });
        client.release();
    }
}
/**
 * Get unique lock ID for a worker name (deterministic hash)
 * This ensures each worker gets a unique lock ID
 */
function getWorkerLockId(workerName) {
    // Simple hash function to convert worker name to a number
    // Using a range that avoids conflicts with manual lock IDs (1000+)
    let hash = 0;
    for (let i = 0; i < workerName.length; i++) {
        const char = workerName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Return positive number in range 2000-9999
    return Math.abs(hash % 8000) + 2000;
}
