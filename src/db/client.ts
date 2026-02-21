import { Pool, PoolClient } from "pg";
import { env } from "../config/env";
import { logger, getRequestContext } from "../lib/logger";

// Detect test environment
const isTestEnv =
  process.env.RUNNING_TESTS === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true";

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || "1000", 10);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Connection pool settings for better reliability
  max: isTestEnv ? 5 : 20, // Very few connections in test environment (Neon free tier limit)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  // Neon cold start can take 5–15s; use 20s in dev so login doesn't timeout
  connectionTimeoutMillis: isTestEnv ? 15000 : 20000,
  // Retry settings
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});

export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const durationMs = Date.now() - start;
  // Section 9: Slow query log (observability)
  if (durationMs >= SLOW_QUERY_MS) {
    logger.warn("slow_query", {
      durationMs,
      thresholdMs: SLOW_QUERY_MS,
      rowCount: res.rowCount,
      queryPreview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      ...(getRequestContext()?.requestId ? { requestId: getRequestContext()?.requestId } : {}),
    });
  }
  return res;
}

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Bundle-style adapter: use withTransaction so bundle-derived code can use the same DB. */
export { withClient } from "./bundleAdapter";
