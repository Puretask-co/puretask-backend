import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

// Detect test environment
const isTestEnv = process.env.RUNNING_TESTS === 'true' || 
                  process.env.NODE_ENV === 'test' ||
                  process.env.VITEST === 'true';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Connection pool settings for better reliability
  max: isTestEnv ? 5 : 20, // Very few connections in test environment (Neon free tier limit)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: isTestEnv ? 15000 : 10000, // Longer timeout in tests (Neon can be slow)
  // Retry settings
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});

export async function query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const res = await pool.query<T>(text, params);
  return res;
}

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
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
