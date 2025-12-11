"use strict";
// src/workers/payoutReconciliation.ts
// Scheduled job to auto-flag payout/earnings mismatches and optionally pause payouts
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const adminRepairService_1 = require("../services/adminRepairService");
const reconciliationService_1 = require("../services/reconciliationService");
const alerting_1 = require("../lib/alerting");
async function main() {
    logger_1.logger.info("payout_reconciliation_worker_started");
    try {
        const mismatches = await (0, adminRepairService_1.findPayoutEarningMismatches)();
        for (const m of mismatches) {
            await (0, reconciliationService_1.upsertReconciliationFlag)({
                payoutId: m.payout_id,
                cleanerId: m.cleaner_id,
                deltaCents: m.delta_cents,
            });
        }
        if (mismatches.length > 0) {
            await (0, alerting_1.sendAlert)({
                level: "warning",
                title: "Payout reconciliation mismatches",
                message: `${mismatches.length} payouts differ from summed earnings.`,
                details: { mismatches: mismatches.slice(0, 10) },
            });
        }
        logger_1.logger.info("payout_reconciliation_worker_completed", {
            mismatches: mismatches.length,
        });
    }
    catch (error) {
        logger_1.logger.error("payout_reconciliation_worker_failed", {
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
    main().catch((err) => {
        logger_1.logger.error("payout_reconciliation_worker_unhandled", { error: err.message });
        process.exit(1);
    });
}
