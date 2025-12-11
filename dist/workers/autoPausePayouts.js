"use strict";
// src/workers/autoPausePayouts.ts
// Auto-pause payouts for cleaners with flagged reconciliation items
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
async function main() {
    logger_1.logger.info("auto_pause_payouts_started");
    try {
        await client_1.pool.query(`
      WITH flagged AS (
        SELECT DISTINCT cleaner_id
        FROM payout_reconciliation_flags
        WHERE status = 'flagged' AND cleaner_id IS NOT NULL
      )
      UPDATE cleaner_profiles cp
      SET payout_paused = true,
          payout_paused_at = NOW()
      FROM flagged f
      WHERE cp.user_id = f.cleaner_id
        AND cp.payout_paused = false
    `);
        logger_1.logger.info("auto_pause_payouts_completed");
    }
    catch (error) {
        logger_1.logger.error("auto_pause_payouts_failed", { error: error.message });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
if (require.main === module) {
    main().catch((err) => {
        logger_1.logger.error("auto_pause_payouts_unhandled", { error: err.message });
        process.exit(1);
    });
}
