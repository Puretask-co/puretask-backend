/**
 * Adapter for bundle-style withClient(cb) so bundle-derived code can use the backend DB.
 * Uses withTransaction so each callback runs in a transaction (BEGIN/COMMIT/ROLLBACK).
 * See: docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 1.
 */
import { withTransaction } from "./client";
import type { PoolClient } from "pg";

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(fn);
}
