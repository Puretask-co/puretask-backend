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
    server.close((err) => {
      void (async (closeErr: Error | undefined) => {
        if (closeErr) {
          logger.error("server_close_error", { error: closeErr.message });
          process.exit(1);
        }

        logger.info("server_closed", { message: "No longer accepting connections" });

        try {
          await pool.end();
          logger.info("database_pool_closed");
          logger.info("shutdown_complete");
          process.exit(0);
        } catch (error) {
          logger.error("shutdown_error", { error: (error as Error).message });
          process.exit(1);
        }
      })(err);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error("shutdown_timeout", { message: "Forcing shutdown after timeout" });
      process.exit(1);
    }, 30000); // 30 second timeout
  };

  // Handle various shutdown signals
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("uncaught_exception", {
      error: error.message,
      stack: error.stack,
    });
    void shutdown("uncaughtException");
  });

  // Handle unhandled rejections
  process.on("unhandledRejection", (reason, _promise) => {
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
