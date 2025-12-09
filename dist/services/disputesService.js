"use strict";
// src/services/disputesService.ts
// Disputes service matching 001_init.sql schema
// Per Damage & Claims Policy: Disputes must be filed within 48 hours
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDispute = createDispute;
exports.getDisputeByJobId = getDisputeByJobId;
exports.getDisputesForClient = getDisputesForClient;
exports.getOpenDisputesCount = getOpenDisputesCount;
exports.updateDisputeNotes = updateDisputeNotes;
exports.getDisputeById = getDisputeById;
exports.getOpenDisputes = getOpenDisputes;
exports.resolveDisputeWithRefund = resolveDisputeWithRefund;
exports.resolveDisputeWithoutRefund = resolveDisputeWithoutRefund;
exports.resolveDispute = resolveDispute;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const env_1 = require("../config/env");
/**
 * Create a dispute for a job
 * Per Damage & Claims Policy: Disputes must be filed within 48 hours of job completion
 */
async function createDispute(options) {
    const { jobId, clientId, clientNotes } = options;
    // Verify job exists and is in awaiting_approval status
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw new Error("Job not found");
    }
    const job = jobResult.rows[0];
    if (job.client_id !== clientId) {
        throw new Error("Not authorized to dispute this job");
    }
    if (job.status !== "awaiting_approval") {
        throw new Error("Job is not in a state that can be disputed");
    }
    // Per policy: Check 48-hour dispute window
    const disputeWindowHours = env_1.env.DISPUTE_WINDOW_HOURS;
    let withinWindow = true;
    if (job.actual_end_at) {
        const completedAt = new Date(job.actual_end_at);
        const now = new Date();
        const hoursSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCompletion > disputeWindowHours) {
            withinWindow = false;
            throw Object.assign(new Error(`Dispute window has expired. Disputes must be filed within ${disputeWindowHours} hours of job completion. This job was completed ${Math.round(hoursSinceCompletion)} hours ago.`), { statusCode: 400, code: "DISPUTE_WINDOW_EXPIRED" });
        }
    }
    // Create dispute with window tracking
    const result = await (0, client_1.query)(`
      INSERT INTO disputes (
        job_id,
        client_id,
        client_notes,
        status,
        job_completed_at,
        within_window
      )
      VALUES ($1, $2, $3, 'open', $4, $5)
      RETURNING *
    `, [jobId, clientId, clientNotes, job.actual_end_at, withinWindow]);
    const dispute = result.rows[0];
    // Update job status to disputed
    await (0, client_1.query)(`UPDATE jobs SET status = 'disputed', updated_at = NOW() WHERE id = $1`, [jobId]);
    // Publish event
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "client",
        actorId: clientId,
        eventName: "client_disputed",
        payload: {
            disputeId: dispute.id,
            clientNotes,
            withinWindow,
        },
    });
    logger_1.logger.info("dispute_created", {
        disputeId: dispute.id,
        jobId,
        clientId,
        withinWindow,
    });
    return dispute;
}
/**
 * Get dispute by job ID
 */
async function getDisputeByJobId(jobId) {
    const result = await (0, client_1.query)(`SELECT * FROM disputes WHERE job_id = $1`, [jobId]);
    return result.rows[0] ?? null;
}
/**
 * Get disputes for a client
 */
async function getDisputesForClient(clientId, limit = 50) {
    const result = await (0, client_1.query)(`
      SELECT d.*, j.address, j.credit_amount, j.scheduled_start_at
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      WHERE d.client_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2
    `, [clientId, limit]);
    return result.rows;
}
/**
 * Get open disputes count (for admin dashboard)
 */
async function getOpenDisputesCount() {
    const result = await (0, client_1.query)(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`);
    return parseInt(result.rows[0]?.count || "0", 10);
}
/**
 * Update dispute notes
 */
async function updateDisputeNotes(disputeId, clientNotes, clientId) {
    const result = await (0, client_1.query)(`
      UPDATE disputes
      SET client_notes = $2,
          updated_at = NOW()
      WHERE id = $1 AND client_id = $3 AND status = 'open'
      RETURNING *
    `, [disputeId, clientNotes, clientId]);
    if (result.rows.length === 0) {
        throw new Error("Dispute not found or cannot be updated");
    }
    return result.rows[0];
}
/**
 * Get dispute by ID
 */
async function getDisputeById(disputeId) {
    const result = await (0, client_1.query)(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
    return result.rows[0] ?? null;
}
/**
 * Get all open disputes (for admin)
 */
async function getOpenDisputes() {
    const result = await (0, client_1.query)(`
      SELECT d.*, 
             row_to_json(j.*) as job
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      WHERE d.status = 'open'
      ORDER BY d.created_at ASC
    `);
    return result.rows;
}
/**
 * Resolve dispute with refund
 * - Marks dispute as resolved_refund
 * - Refunds credits to client
 * - Updates job status to cancelled
 */
async function resolveDisputeWithRefund(disputeId, adminNotes) {
    // Import here to avoid circular dependency
    const { refundJobCreditsToClient } = await Promise.resolve().then(() => __importStar(require("./creditsService")));
    // Get dispute
    const dispute = await getDisputeById(disputeId);
    if (!dispute) {
        throw Object.assign(new Error("Dispute not found"), { statusCode: 404 });
    }
    if (dispute.status !== "open") {
        throw Object.assign(new Error("Dispute is already resolved"), { statusCode: 400 });
    }
    // Get job
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [dispute.job_id]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    // Refund credits to client
    await refundJobCreditsToClient(dispute.client_id, job.id, job.credit_amount);
    // Update dispute status
    const result = await (0, client_1.query)(`
      UPDATE disputes
      SET status = 'resolved_refund',
          admin_notes = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [disputeId, adminNotes]);
    // Update job status to cancelled
    await (0, client_1.query)(`UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [job.id]);
    // Publish event
    await (0, events_1.publishEvent)({
        jobId: job.id,
        actorType: "admin",
        actorId: null,
        eventName: "dispute_resolved_refund",
        payload: {
            disputeId,
            adminNotes,
            refundAmount: job.credit_amount,
        },
    });
    logger_1.logger.info("dispute_resolved_with_refund", {
        disputeId,
        jobId: job.id,
        clientId: dispute.client_id,
        refundAmount: job.credit_amount,
    });
    // Update cleaner reliability (dispute affects their score)
    if (job.cleaner_id) {
        try {
            const { updateCleanerReliability } = await Promise.resolve().then(() => __importStar(require("./reliabilityService")));
            await updateCleanerReliability(job.cleaner_id);
        }
        catch (err) {
            logger_1.logger.error("reliability_update_on_dispute_failed", {
                cleanerId: job.cleaner_id,
                error: err.message,
            });
        }
    }
    return result.rows[0];
}
/**
 * Resolve dispute without refund
 * - Marks dispute as resolved_no_refund
 * - Cleaner gets paid (if not already)
 * - Updates job status to completed
 */
async function resolveDisputeWithoutRefund(disputeId, adminNotes) {
    // Import here to avoid circular dependency
    const { releaseJobCreditsToCleaner } = await Promise.resolve().then(() => __importStar(require("./creditsService")));
    const { recordEarningsForCompletedJob } = await Promise.resolve().then(() => __importStar(require("./payoutsService")));
    // Get dispute
    const dispute = await getDisputeById(disputeId);
    if (!dispute) {
        throw Object.assign(new Error("Dispute not found"), { statusCode: 404 });
    }
    if (dispute.status !== "open") {
        throw Object.assign(new Error("Dispute is already resolved"), { statusCode: 400 });
    }
    // Get job
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [dispute.job_id]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    // Release credits to cleaner (if cleaner assigned)
    if (job.cleaner_id) {
        await releaseJobCreditsToCleaner(job.cleaner_id, job.id, job.credit_amount);
        await recordEarningsForCompletedJob(job);
    }
    // Update dispute status
    const result = await (0, client_1.query)(`
      UPDATE disputes
      SET status = 'resolved_no_refund',
          admin_notes = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [disputeId, adminNotes]);
    // Update job status to completed
    await (0, client_1.query)(`UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`, [job.id]);
    // Publish event
    await (0, events_1.publishEvent)({
        jobId: job.id,
        actorType: "admin",
        actorId: null,
        eventName: "dispute_resolved_no_refund",
        payload: {
            disputeId,
            adminNotes,
        },
    });
    logger_1.logger.info("dispute_resolved_without_refund", {
        disputeId,
        jobId: job.id,
        cleanerId: job.cleaner_id,
    });
    // Update cleaner reliability (even no-refund resolution affects metrics)
    if (job.cleaner_id) {
        try {
            const { updateCleanerReliability } = await Promise.resolve().then(() => __importStar(require("./reliabilityService")));
            await updateCleanerReliability(job.cleaner_id);
        }
        catch (err) {
            logger_1.logger.error("reliability_update_on_dispute_failed", {
                cleanerId: job.cleaner_id,
                error: err.message,
            });
        }
    }
    return result.rows[0];
}
/**
 * Generic resolve dispute function
 */
async function resolveDispute(disputeId, resolution, adminNotes) {
    if (resolution === "resolved_refund") {
        return resolveDisputeWithRefund(disputeId, adminNotes);
    }
    else {
        return resolveDisputeWithoutRefund(disputeId, adminNotes);
    }
}
