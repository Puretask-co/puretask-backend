"use strict";
// src/workers/expireBoosts.ts
// Worker to expire old cleaner boosts
//
// Run hourly: node dist/workers/expireBoosts.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runExpireBoosts = main;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
const premiumService_1 = require("../../services/premiumService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("expire_boosts_worker_started");
    try {
        const expiredCount = await (0, premiumService_1.expireOldBoosts)();
        logger_1.logger.info("expire_boosts_worker_completed", { expiredCount });
    }
    catch (error) {
        logger_1.logger.error("expire_boosts_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Expire boosts worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Expire boosts worker failed:", error);
        process.exit(1);
    });
}
