"use strict";
// src/services/reconciliationService.ts
// Payout reconciliation flags: detect and store mismatches for admin review
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertReconciliationFlag = upsertReconciliationFlag;
exports.getPayoutReconciliationFlags = getPayoutReconciliationFlags;
exports.resolvePayoutReconciliationFlag = resolvePayoutReconciliationFlag;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
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
async function upsertReconciliationFlag(params) {
    await (0, client_1.query)(ensureTable);
    await (0, client_1.query)(`
      INSERT INTO payout_reconciliation_flags (payout_id, cleaner_id, delta_cents, status)
      VALUES ($1, $2, $3, 'flagged')
      ON CONFLICT (payout_id) DO UPDATE
      SET delta_cents = EXCLUDED.delta_cents,
          status = 'flagged',
          flagged_at = NOW(),
          resolved_at = NULL,
          resolved_by = NULL,
          note = NULL
    `, [params.payoutId, params.cleanerId, params.deltaCents]);
}
async function getPayoutReconciliationFlags() {
    await (0, client_1.query)(ensureTable);
    const result = await (0, client_1.query)(`SELECT payout_id, cleaner_id, delta_cents, status, note
     FROM payout_reconciliation_flags
     WHERE status = 'flagged'`);
    return result.rows;
}
async function resolvePayoutReconciliationFlag(params) {
    await (0, client_1.query)(ensureTable);
    const result = await (0, client_1.query)(`
      UPDATE payout_reconciliation_flags
      SET status = $2,
          note = COALESCE($3, note),
          resolved_at = NOW(),
          resolved_by = $4
      WHERE payout_id = $1
    `, [params.payoutId, params.status, params.note || null, params.resolvedBy]);
    if (result.rowCount === 0) {
        throw new Error("Reconciliation flag not found");
    }
    await (0, client_1.query)(`
      INSERT INTO payout_reconciliation_flag_history (payout_id, status, note, actor_id)
      VALUES ($1, $2, $3, $4)
    `, [params.payoutId, params.status, params.note || null, params.resolvedBy]);
    logger_1.logger.info("payout_reconciliation_resolved", {
        payoutId: params.payoutId,
        status: params.status,
        resolvedBy: params.resolvedBy,
    });
}
