// src/workers/queueProcessor.ts
// Generic queue processor for background jobs
//
// Run continuously: node dist/workers/queueProcessor.js

import { pool } from "../../db/client";
import { logger } from "../../lib/logger";
import { queueService, QUEUE_NAMES, HANDLED_QUEUE_NAMES, processQueue } from "../../lib/queue";
import { syncJobToCalendar } from "../../services/calendarService";
import { generateChecklist, generateDisputeSuggestion } from "../../services/aiService";

// ============================================
// Register Queue Handlers
// ============================================

// Calendar sync handler
queueService.registerHandler(
  QUEUE_NAMES.CALENDAR_SYNC,
  async (payload: {
    userId: string;
    jobId: string;
    eventData: {
      summary: string;
      description: string;
      start: string;
      end: string;
      location?: string;
    };
  }) => {
    await syncJobToCalendar(payload.userId, payload.jobId, {
      summary: payload.eventData.summary,
      description: payload.eventData.description,
      start: new Date(payload.eventData.start),
      end: new Date(payload.eventData.end),
      location: payload.eventData.location,
    });
  }
);

// AI checklist handler
queueService.registerHandler(
  QUEUE_NAMES.AI_CHECKLIST,
  async (payload: { jobId: string; input: Parameters<typeof generateChecklist>[0] }) => {
    const checklist = await generateChecklist(payload.input);
    logger.info("ai_checklist_processed", { jobId: payload.jobId, steps: checklist.steps.length });
    // Could store result in job_metadata or send notification
  }
);

// AI dispute handler
queueService.registerHandler(
  QUEUE_NAMES.AI_DISPUTE,
  async (payload: {
    disputeId: string;
    input: Parameters<typeof generateDisputeSuggestion>[0];
  }) => {
    const suggestion = await generateDisputeSuggestion(payload.input);
    logger.info("ai_dispute_processed", {
      disputeId: payload.disputeId,
      action: suggestion.recommended_action,
    });
    // Could store result in dispute metadata
  }
);

// ============================================
// Main Processing Loop
// ============================================

const POLL_INTERVAL_MS = 5000; // 5 seconds

async function processAllQueues(): Promise<void> {
  for (const queueName of HANDLED_QUEUE_NAMES) {
    try {
      const result = await processQueue(queueName, 10);
      if (result.processed > 0) {
        logger.debug("queue_batch_processed", { queueName, ...result });
      }
    } catch (err) {
      logger.error("queue_processing_error", { queueName, error: (err as Error).message });
    }
  }
}

async function main(): Promise<void> {
  logger.info("queue_processor_started");

  // Process loop
  const runLoop = async () => {
    while (true) {
      try {
        await processAllQueues();
      } catch (err) {
        logger.error("queue_loop_error", { error: (err as Error).message });
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  };

  // Handle graceful shutdown
  process.on("SIGTERM", () => {
    void (async () => {
      logger.info("queue_processor_shutting_down");
      await pool.end();
      process.exit(0);
    })();
  });

  process.on("SIGINT", () => {
    void (async () => {
      logger.info("queue_processor_interrupted");
      await pool.end();
      process.exit(0);
    })();
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

export { main as runQueueProcessor };
