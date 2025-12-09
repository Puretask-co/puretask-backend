// src/services/chargebackProcessor.ts
// Chargeback/dispute handling scaffold (freeze/flag/clawback to be implemented with domain policies)

import { logger } from "../lib/logger";
import { query } from "../db/client";
import { addLedgerEntry } from "./creditsService";

type ChargebackContext = {
  disputeId: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  jobId?: string | null;
  clientId?: string | null;
  amount: number;
  currency: string;
  status: string;
  eventType: string;
  reason?: string | null;
};

/**
 * Process a charge dispute event.
 * Behavior:
 *  - On dispute.created: mark dispute_flag on payout if linked; no financial changes.
 *  - On dispute.closed (lost): refund credits to client if job/client known; clear flag; no cleaner clawback.
 *  - On dispute.closed (won): clear flag; no financial changes.
 */
export async function processChargeDispute(ctx: ChargebackContext): Promise<void> {
  const { disputeId, paymentIntentId, jobId = null, clientId = null, amount, eventType } = ctx;

  // Try to find payout/cleaner for flagging (optional)
  if (jobId) {
    const payoutRow = await query<{ payout_id: string | null }>(
      `
        SELECT p.id AS payout_id
        FROM payouts p
        JOIN earnings e ON e.payout_id = p.id
        WHERE e.job_id = $1
        LIMIT 1
      `,
      [jobId]
    );
    if (payoutRow.rows[0]?.payout_id) {
      if (eventType === "charge.dispute.created") {
        await query(
          `
            UPDATE payouts
            SET dispute_flag = true, updated_at = NOW()
            WHERE id = $1
          `,
          [payoutRow.rows[0].payout_id]
        );
      } else if (eventType === "charge.dispute.closed") {
        await query(
          `
            UPDATE payouts
            SET dispute_flag = false, updated_at = NOW()
            WHERE id = $1
          `,
          [payoutRow.rows[0].payout_id]
        );
      }
    }
  }

  // If closed and lost: refund credits to client; no cleaner clawback
  const isClosedLost = eventType === "charge.dispute.closed" && ctx.status === "lost";
  if (isClosedLost && clientId && amount > 0) {
    const { env } = await import("../config/env");
    const credits = env.CENTS_PER_CREDIT ? amount / env.CENTS_PER_CREDIT : 0;
    if (credits > 0) {
      await addLedgerEntry({
        userId: clientId,
        jobId,
        deltaCredits: credits,
        reason: "refund",
      });
      if (jobId) {
        await query(
          `
            UPDATE jobs
            SET status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
          `,
          [jobId]
        );
      }
      logger.info("chargeback_client_refund", {
        disputeId,
        paymentIntentId,
        jobId,
        clientId,
        credits,
      });
    }
  }
}

