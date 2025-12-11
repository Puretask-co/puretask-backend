"use strict";
// src/workers/metricsSnapshot.ts
// Periodic operational metrics logging worker
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../lib/logger");
const operationalMetricsService_1 = require("../services/operationalMetricsService");
const log = (0, logger_1.workerLogger)("metricsSnapshot");
const INTERVAL_MS = 60 * 60 * 1000; // Every hour
async function main() {
    log.info("metrics_snapshot_worker_started");
    // Run immediately on start
    await runSnapshot();
    // Then run periodically
    setInterval(runSnapshot, INTERVAL_MS);
}
async function runSnapshot() {
    try {
        await (0, operationalMetricsService_1.logOperationalSnapshot)();
        log.info("metrics_snapshot_completed");
    }
    catch (error) {
        log.error("metrics_snapshot_failed", { error });
    }
}
main().catch((error) => {
    log.error("metrics_snapshot_worker_fatal", { error });
    process.exit(1);
});
