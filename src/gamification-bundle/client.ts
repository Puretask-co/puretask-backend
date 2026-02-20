import { Pool } from "pg";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}
