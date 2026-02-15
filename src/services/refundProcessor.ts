// src/services/refundProcessor.ts
// Central refund processing (idempotent, branching by context)

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { addLedgerEntry } from "./creditsService";

type RefundContext = {
  chargeId: string;
  paymentIntentId: string;
  jobId?: string | null;
  clientId?: string | null;
  purpose?: string | null;
  amount: number; // in smallest currency units (Stripe charge.amount_refunded)
  currency: string;
};

/**
 * Process a refund coming from Stripe (charge.refunded)
 * This is a scaffold that no-ops if it cannot map context safely.
 */
export async function processStripeRefund(ctx: RefundContext): Promise<void> {
  const { chargeId, paymentIntentId, jobId = null, clientId = null, purpose = null, amount } = ctx;

  // Determine credits from amount if possible (using env.CENTS_PER_CREDIT)
  const { env } = await import("../config/env");
  const credits = env.CENTS_PER_CREDIT ? amount / env.CENTS_PER_CREDIT : 0;

  if (!credits || Number.isNaN(credits) || credits <= 0) {
    logger.warn("refund_processor_invalid_credits_calc", {
      chargeId,
      paymentIntentId,
      amount,
      credits,
    });
    return;
  }

  if (clientId && !jobId) {
    // Purchase/subscription refund: return credits to client wallet
    await addLedgerEntry({
      userId: clientId,
      jobId: null,
      deltaCredits: credits,
      reason: "refund",
    });
    logger.info("refund_processor_client_refund", { chargeId, paymentIntentId, clientId, credits });
    return;
  }

  if (clientId && jobId) {
    // Job refund: return credits to client wallet and mark job cancelled/refunded
    await addLedgerEntry({
      userId: clientId,
      jobId,
      deltaCredits: credits,
      reason: "refund",
    });

    await query(
      `
        UPDATE jobs
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
      `,
      [jobId]
    );

    logger.info("refund_processor_job_refund", {
      chargeId,
      paymentIntentId,
      jobId,
      clientId,
      purpose,
      credits,
    });
    return;
  }

  logger.warn("refund_processor_unmapped_context", {
    chargeId,
    paymentIntentId,
    jobId,
    clientId,
    purpose,
    credits,
  });
}
