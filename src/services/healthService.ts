import { pool } from "../db/client";

export async function isDatabaseReady(): Promise<boolean> {
  const result = await pool.query("SELECT 1 as connected");
  return result.rows[0]?.connected === 1;
}
