"use strict";
// src/workers/stuckJobDetection.ts
// Worker to detect and alert on stuck jobs, payouts, and system issues
//
// Run every 15 minutes: node dist/workers/stuckJobDetection.js
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
exports.runStuckJobDetection = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const adminRepairService_1 = require("../services/adminRepairService");
const creditEconomyService_1 = require("../services/creditEconomyService");
// Thresholds for alerting
const ALERT_THRESHOLDS = {
    STUCK_JOBS: 5, // Alert if > 5 stuck jobs
    STUCK_PAYOUTS: 10, // Alert if > 10 stuck payouts
    LEDGER_ISSUES: 1, // Alert immediately on ledger issues
    FRAUD_ALERTS: 1, // Alert on any fraud alerts
    WEBHOOK_FAILURES: 20, // Alert if > 20 pending webhooks
};
/**
 * Send alert notification (placeholder - integrate with your alerting system)
 */
async function sendAlert(params) {
    const { level, title, message, details } = params;
    // Log the alert
    logger_1.logger.warn("system_alert", { level, title, message, details });
    // TODO: Integrate with your alerting system:
    // - Slack webhook
    // - Email to admin
    // - PagerDuty
    // - SMS via Twilio
    // Example Slack webhook:
    // await fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `🚨 [${level.toUpperCase()}] ${title}`,
    //     blocks: [
    //       { type: 'section', text: { type: 'mrkdwn', text: message } },
    //       { type: 'section', text: { type: 'mrkdwn', text: '```' + JSON.stringify(details, null, 2) + '```' } }
    //     ]
    //   })
    // });
}
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("stuck_job_detection_started");
    try {
        // Run health check
        const health = await (0, adminRepairService_1.runSystemHealthCheck)();
        logger_1.logger.info("system_health_snapshot", {
            stuckJobs: health.stuckJobs,
            stuckPayouts: health.stuckPayouts,
            ledgerInconsistencies: health.ledgerInconsistencies,
            pendingWebhooks: health.pendingWebhooks,
            openFraudAlerts: health.openFraudAlerts,
        });
        // Check stuck jobs
        if (health.stuckJobs > ALERT_THRESHOLDS.STUCK_JOBS) {
            await sendAlert({
                level: "warning",
                title: "High number of stuck jobs detected",
                message: `${health.stuckJobs} jobs are stuck in various states. Manual intervention may be required.`,
                details: {
                    count: health.stuckJobs,
                    jobs: health.details.stuckJobs.slice(0, 10),
                },
            });
        }
        // Check stuck payouts
        if (health.stuckPayouts > ALERT_THRESHOLDS.STUCK_PAYOUTS) {
            await sendAlert({
                level: "warning",
                title: "High number of stuck payouts detected",
                message: `${health.stuckPayouts} payouts have been pending for over 7 days.`,
                details: {
                    count: health.stuckPayouts,
                    payouts: health.details.stuckPayouts.slice(0, 10),
                },
            });
        }
        // Check ledger issues - these are critical
        if (health.ledgerInconsistencies >= ALERT_THRESHOLDS.LEDGER_ISSUES) {
            await sendAlert({
                level: "critical",
                title: "Credit ledger inconsistencies detected",
                message: `${health.ledgerInconsistencies} users have inconsistent credit balances. Immediate attention required.`,
                details: {
                    count: health.ledgerInconsistencies,
                    issues: health.details.ledgerInconsistencies,
                },
            });
        }
        // Check fraud alerts
        if (health.openFraudAlerts >= ALERT_THRESHOLDS.FRAUD_ALERTS) {
            const alerts = await (0, creditEconomyService_1.getOpenFraudAlerts)();
            const criticalAlerts = alerts.filter((a) => a.severity === "critical");
            if (criticalAlerts.length > 0) {
                await sendAlert({
                    level: "critical",
                    title: "Critical fraud alerts pending",
                    message: `${criticalAlerts.length} critical fraud alerts require immediate attention.`,
                    details: {
                        totalAlerts: health.openFraudAlerts,
                        criticalAlerts: criticalAlerts.map((a) => ({
                            id: a.id,
                            type: a.alert_type,
                            description: a.description,
                        })),
                    },
                });
            }
            else if (health.openFraudAlerts > 5) {
                await sendAlert({
                    level: "warning",
                    title: "Multiple fraud alerts pending",
                    message: `${health.openFraudAlerts} fraud alerts are awaiting review.`,
                    details: { count: health.openFraudAlerts },
                });
            }
        }
        // Check pending webhooks
        if (health.pendingWebhooks > ALERT_THRESHOLDS.WEBHOOK_FAILURES) {
            await sendAlert({
                level: "warning",
                title: "High number of pending webhook retries",
                message: `${health.pendingWebhooks} webhooks are pending retry. Check webhook processing.`,
                details: { count: health.pendingWebhooks },
            });
        }
        // Auto-handle some issues if configured
        await autoHandleStuckJobs(health.details.stuckJobs);
        logger_1.logger.info("stuck_job_detection_completed", {
            alertsSent: calculateAlertCount(health),
        });
    }
    catch (error) {
        logger_1.logger.error("stuck_job_detection_failed", {
            error: error.message,
            stack: error.stack,
        });
        // Send error alert
        await sendAlert({
            level: "error",
            title: "Stuck job detection worker failed",
            message: `The stuck job detection worker encountered an error: ${error.message}`,
            details: { error: error.message },
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
/**
 * Auto-handle certain types of stuck jobs
 */
async function autoHandleStuckJobs(stuckJobs) {
    for (const job of stuckJobs) {
        // Auto-approve jobs that have been awaiting approval for too long
        if (job.reason.includes("Awaiting approval for 7+ days") && job.hours_stuck > 24 * 7) {
            logger_1.logger.info("auto_approving_stuck_job", { jobId: job.id, hoursStuck: job.hours_stuck });
            // Import dynamically to avoid circular deps
            const { forceCompleteJob } = await Promise.resolve().then(() => __importStar(require("../services/adminRepairService")));
            try {
                await forceCompleteJob(job.id, "system", "Auto-approved after 7+ days awaiting approval");
            }
            catch (err) {
                logger_1.logger.error("auto_approve_failed", { jobId: job.id, error: err.message });
            }
        }
    }
}
/**
 * Calculate how many alerts would be sent
 */
function calculateAlertCount(health) {
    let count = 0;
    if (health.stuckJobs > ALERT_THRESHOLDS.STUCK_JOBS)
        count++;
    if (health.stuckPayouts > ALERT_THRESHOLDS.STUCK_PAYOUTS)
        count++;
    if (health.ledgerInconsistencies >= ALERT_THRESHOLDS.LEDGER_ISSUES)
        count++;
    if (health.openFraudAlerts >= ALERT_THRESHOLDS.FRAUD_ALERTS)
        count++;
    if (health.pendingWebhooks > ALERT_THRESHOLDS.WEBHOOK_FAILURES)
        count++;
    return count;
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Stuck job detection completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Stuck job detection failed:", error);
        process.exit(1);
    });
}
