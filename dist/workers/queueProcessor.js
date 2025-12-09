"use strict";
// src/workers/queueProcessor.ts
// Generic queue processor for background jobs
//
// Run continuously: node dist/workers/queueProcessor.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQueueProcessor = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const queue_1 = require("../lib/queue");
const calendarService_1 = require("../services/calendarService");
const aiService_1 = require("../services/aiService");
// ============================================
// Register Queue Handlers
// ============================================
// Calendar sync handler
queue_1.queueService.registerHandler(queue_1.QUEUE_NAMES.CALENDAR_SYNC, async (payload) => {
    await (0, calendarService_1.syncJobToCalendar)(payload.userId, payload.jobId, {
        summary: payload.eventData.summary,
        description: payload.eventData.description,
        start: new Date(payload.eventData.start),
        end: new Date(payload.eventData.end),
        location: payload.eventData.location,
    });
});
// AI checklist handler
queue_1.queueService.registerHandler(queue_1.QUEUE_NAMES.AI_CHECKLIST, async (payload) => {
    const checklist = await (0, aiService_1.generateChecklist)(payload.input);
    logger_1.logger.info("ai_checklist_processed", { jobId: payload.jobId, steps: checklist.steps.length });
    // Could store result in job_metadata or send notification
});
// AI dispute handler
queue_1.queueService.registerHandler(queue_1.QUEUE_NAMES.AI_DISPUTE, async (payload) => {
    const suggestion = await (0, aiService_1.generateDisputeSuggestion)(payload.input);
    logger_1.logger.info("ai_dispute_processed", { disputeId: payload.disputeId, action: suggestion.recommended_action });
    // Could store result in dispute metadata
});
// ============================================
// Main Processing Loop
// ============================================
const POLL_INTERVAL_MS = 5000; // 5 seconds
async function processAllQueues() {
    const queues = Object.values(queue_1.QUEUE_NAMES);
    for (const queueName of queues) {
        try {
            const result = await (0, queue_1.processQueue)(queueName, 10);
            if (result.processed > 0) {
                logger_1.logger.debug("queue_batch_processed", { queueName, ...result });
            }
        }
        catch (err) {
            logger_1.logger.error("queue_processing_error", { queueName, error: err.message });
        }
    }
}
async function main() {
    logger_1.logger.info("queue_processor_started");
    // Process loop
    const runLoop = async () => {
        while (true) {
            try {
                await processAllQueues();
            }
            catch (err) {
                logger_1.logger.error("queue_loop_error", { error: err.message });
            }
            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    };
    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
        logger_1.logger.info("queue_processor_shutting_down");
        await client_1.pool.end();
        process.exit(0);
    });
    process.on("SIGINT", async () => {
        logger_1.logger.info("queue_processor_interrupted");
        await client_1.pool.end();
        process.exit(0);
    });
    await runLoop();
}
// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error("Queue processor failed:", error);
        process.exit(1);
    });
}
