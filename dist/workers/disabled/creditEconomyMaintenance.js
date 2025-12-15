"use strict";
// src/workers/creditEconomyMaintenance.ts
// Worker for credit economy maintenance tasks
//
// Run daily: node dist/workers/creditEconomyMaintenance.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCreditEconomyMaintenance = main;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
const creditEconomyService_1 = require("../../services/creditEconomyService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("credit_economy_maintenance_started");
    try {
        // 1. Apply reliability decay for inactive cleaners
        const decayResult = await (0, creditEconomyService_1.applyReliabilityDecay)();
        logger_1.logger.info("reliability_decay_completed", decayResult);
        // 2. Cleanup expired tier locks
        const expiredLocks = await (0, creditEconomyService_1.cleanupExpiredTierLocks)();
        logger_1.logger.info("tier_locks_cleaned", { expiredLocks });
        // 3. Check for open fraud alerts (alert admins if critical)
        const alerts = await (0, creditEconomyService_1.getOpenFraudAlerts)();
        const criticalAlerts = alerts.filter((a) => a.severity === "critical");
        if (criticalAlerts.length > 0) {
            logger_1.logger.warn("critical_fraud_alerts_pending", {
                count: criticalAlerts.length,
                alerts: criticalAlerts.map((a) => ({
                    id: a.id,
                    type: a.alert_type,
                    description: a.description,
                })),
            });
            // TODO: Send notification to admin
        }
        logger_1.logger.info("credit_economy_maintenance_completed", {
            decayed: decayResult.decayed,
            expiredLocks,
            openAlerts: alerts.length,
            criticalAlerts: criticalAlerts.length,
        });
    }
    catch (error) {
        logger_1.logger.error("credit_economy_maintenance_failed", {
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
        console.log("Credit economy maintenance completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Credit economy maintenance failed:", error);
        process.exit(1);
    });
}
