"use strict";
// src/workers/backupDaily.ts
// Daily worker to create logical backup snapshots
//
// Run on a schedule (e.g., daily at 02:00 UTC):
// node dist/workers/backupDaily.js
//
// Cron example: 0 2 * * * node /app/dist/workers/backupDaily.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackupDaily = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const backupService_1 = require("../services/backupService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("backup_daily_worker_started", {
        timestamp: new Date().toISOString(),
    });
    try {
        // Get previous backup for comparison (optional)
        const previousBackup = await (0, backupService_1.getLatestBackup)();
        // Create new daily backup
        const snapshot = await (0, backupService_1.runBackupJob)("daily-summary");
        // Log comparison if we have a previous backup
        if (previousBackup) {
            const comparison = (0, backupService_1.compareBackups)(previousBackup, snapshot);
            logger_1.logger.info("backup_comparison", {
                previous_date: previousBackup.created_at,
                current_date: snapshot.created_at,
                user_change: comparison.user_count?.change || 0,
                job_change: comparison.job_count?.change || 0,
                credit_supply_change: comparison.total_credit_supply?.change || 0,
            });
        }
        // Cleanup old backups (keep last 30 per label)
        const deletedCount = await (0, backupService_1.cleanupOldBackups)(30);
        logger_1.logger.info("backup_daily_worker_completed", {
            backup_id: snapshot.id,
            label: snapshot.label,
            created_at: snapshot.created_at,
            user_count: snapshot.data.user_count,
            job_count: snapshot.data.job_count,
            total_credit_supply: snapshot.data.total_credit_supply,
            pending_payouts: snapshot.data.pending_payouts,
            open_disputes: snapshot.data.open_disputes,
            old_backups_deleted: deletedCount,
        });
    }
    catch (error) {
        logger_1.logger.error("backup_daily_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        // Close database connection pool
        await client_1.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Backup daily worker completed successfully");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Backup daily worker failed:", error);
        process.exit(1);
    });
}
