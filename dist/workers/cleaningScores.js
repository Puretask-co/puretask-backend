"use strict";
// src/workers/cleaningScores.ts
// Recalculate cleaning scores for all properties
//
// Run daily: node dist/workers/cleaningScores.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCleaningScores = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const propertiesService_1 = require("../services/propertiesService");
async function main() {
    logger_1.logger.info("cleaning_scores_worker_started");
    try {
        const updated = await (0, propertiesService_1.recalculateAllScores)();
        logger_1.logger.info("cleaning_scores_worker_completed", { propertiesUpdated: updated });
    }
    catch (error) {
        logger_1.logger.error("cleaning_scores_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
if (require.main === module) {
    main()
        .then(() => {
        console.log("Cleaning scores worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Cleaning scores worker failed:", error);
        process.exit(1);
    });
}
