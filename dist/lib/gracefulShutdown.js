"use strict";
// src/lib/gracefulShutdown.ts
// Graceful shutdown handler
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGracefulShutdown = setupGracefulShutdown;
exports.isShuttingDown = isShuttingDown;
const logger_1 = require("./logger");
const client_1 = require("../db/client");
let shuttingDown = false;
/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        if (shuttingDown) {
            logger_1.logger.warn("shutdown_already_in_progress", { signal });
            return;
        }
        shuttingDown = true;
        logger_1.logger.info("shutdown_initiated", { signal });
        // Stop accepting new connections
        server.close(async (err) => {
            if (err) {
                logger_1.logger.error("server_close_error", { error: err.message });
                process.exit(1);
            }
            logger_1.logger.info("server_closed", { message: "No longer accepting connections" });
            try {
                // Close database pool
                await client_1.pool.end();
                logger_1.logger.info("database_pool_closed");
                logger_1.logger.info("shutdown_complete");
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error("shutdown_error", { error: error.message });
                process.exit(1);
            }
        });
        // Force shutdown after timeout
        setTimeout(() => {
            logger_1.logger.error("shutdown_timeout", { message: "Forcing shutdown after timeout" });
            process.exit(1);
        }, 30000); // 30 second timeout
    };
    // Handle various shutdown signals
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
        logger_1.logger.error("uncaught_exception", {
            error: error.message,
            stack: error.stack,
        });
        shutdown("uncaughtException");
    });
    // Handle unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
        logger_1.logger.error("unhandled_rejection", {
            reason: String(reason),
        });
    });
}
/**
 * Check if server is shutting down
 */
function isShuttingDown() {
    return shuttingDown;
}
