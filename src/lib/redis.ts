// src/lib/redis.ts
// Redis client for production rate limiting and caching

import { createClient, RedisClientType } from "redis";
import { env } from "../config/env";
import { logger } from "./logger";

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis connection
 * Only connects if REDIS_URL is configured
 */
export async function initRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    logger.info("redis_disabled", { reason: "REDIS_URL not configured" });
    return;
  }

  try {
    redisClient = createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error("redis_reconnect_failed", { retries });
            return new Error("Redis reconnect limit reached");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on("error", (err) => {
      logger.error("redis_error", { error: err.message });
    });

    redisClient.on("connect", () => {
      logger.info("redis_connected");
    });

    redisClient.on("reconnecting", () => {
      logger.warn("redis_reconnecting");
    });

    await redisClient.connect();
    logger.info("redis_initialized");
  } catch (error) {
    logger.error("redis_init_failed", {
      error: (error as Error).message,
    });
    // Don't throw - fall back to in-memory rate limiting
    redisClient = null;
  }
}

/**
 * Get Redis client (may be null if not connected)
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("redis_closed");
    } catch (error) {
      logger.error("redis_close_failed", {
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Check if Redis is available and connected
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isOpen;
}
