// src/services/reconciliationService.ts
// Payout reconciliation flags: detect and store mismatches for admin review

import { query } from "../db/client";
import { logger } from "../lib/logger";

const ensureTable = `
  CREATE TABLE IF NOT EXISTS payout_reconciliation_flags (
    payout_id UUID PRIMARY KEY,
    cleaner_id UUID,
    delta_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'flagged', -- flagged | resolved | ignored
    note TEXT,
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID
  );
`;

export async function upsertReconciliationFlag(params: {
  payoutId: string;
  cleanerId: string | null;
  deltaCents: number;
}): Promise<void> {
  await query(ensureTable);
  await query(
    `
      INSERT INTO payout_reconciliation_flags (payout_id, cleaner_id, delta_cents, status)
      VALUES ($1, $2, $3, 'flagged')
      ON CONFLICT (payout_id) DO UPDATE
      SET delta_cents = EXCLUDED.delta_cents,
          status = 'flagged',
          flagged_at = NOW(),
          resolved_at = NULL,
          resolved_by = NULL,
          note = NULL
    `,
    [params.payoutId, params.cleanerId, params.deltaCents]
  );
}

export async function getPayoutReconciliationFlags(): Promise<
  Array<{ payout_id: string; cleaner_id: string | null; delta_cents: number; status: string; note: string | null }>
> {
  await query(ensureTable);
  const result = await query<{
    payout_id: string;
    cleaner_id: string | null;
    delta_cents: number;
    status: string;
    note: string | null;
  }>(
    `SELECT payout_id, cleaner_id, delta_cents, status, note
     FROM payout_reconciliation_flags
     WHERE status = 'flagged'`
  );
  return result.rows;
}

export async function resolvePayoutReconciliationFlag(params: {
  payoutId: string;
  status: "resolved" | "ignored";
  note?: string;
  resolvedBy: string;
}): Promise<void> {
  await query(ensureTable);
  const result = await query(
    `
      UPDATE payout_reconciliation_flags
      SET status = $2,
          note = COALESCE($3, note),
          resolved_at = NOW(),
          resolved_by = $4
      WHERE payout_id = $1
    `,
    [params.payoutId, params.status, params.note || null, params.resolvedBy]
  );
  if (result.rowCount === 0) {
    throw new Error("Reconciliation flag not found");
  }

  await query(
    `
      INSERT INTO payout_reconciliation_flag_history (payout_id, status, note, actor_id)
      VALUES ($1, $2, $3, $4)
    `,
    [params.payoutId, params.status, params.note || null, params.resolvedBy]
  );

  logger.info("payout_reconciliation_resolved", {
    payoutId: params.payoutId,
    status: params.status,
    resolvedBy: params.resolvedBy,
  });
}

