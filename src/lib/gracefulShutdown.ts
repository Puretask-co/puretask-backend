// src/lib/gracefulShutdown.ts
// Graceful shutdown handler

import { Server } from "http";
import { logger } from "./logger";
import { pool } from "../db/client";

let shuttingDown = false;

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      logger.warn("shutdown_already_in_progress", { signal });
      return;
    }

    shuttingDown = true;
    logger.info("shutdown_initiated", { signal });

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error("server_close_error", { error: err.message });
        process.exit(1);
      }

      logger.info("server_closed", { message: "No longer accepting connections" });

      try {
        // Close database pool
        await pool.end();
        logger.info("database_pool_closed");

        logger.info("shutdown_complete");
        process.exit(0);
      } catch (error) {
        logger.error("shutdown_error", { error: (error as Error).message });
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error("shutdown_timeout", { message: "Forcing shutdown after timeout" });
      process.exit(1);
    }, 30000); // 30 second timeout
  };

  // Handle various shutdown signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("uncaught_exception", {
      error: error.message,
      stack: error.stack,
    });
    shutdown("uncaughtException");
  });

  // Handle unhandled rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("unhandled_rejection", {
      reason: String(reason),
    });
  });
}

/**
 * Check if server is shutting down
 */
export function isShuttingDown(): boolean {
  return shuttingDown;
}
