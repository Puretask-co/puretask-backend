"use strict";
// src/services/chargebackProcessor.ts
// Chargeback/dispute handling scaffold (freeze/flag/clawback to be implemented with domain policies)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processChargeDispute = processChargeDispute;
const logger_1 = require("../lib/logger");
const client_1 = require("../db/client");
const creditsService_1 = require("./creditsService");
/**
 * Process a charge dispute event.
 * Behavior:
 *  - On dispute.created: mark dispute_flag on payout if linked; no financial changes.
 *  - On dispute.closed (lost): refund credits to client if job/client known; clear flag; no cleaner clawback.
 *  - On dispute.closed (won): clear flag; no financial changes.
 */
async function processChargeDispute(ctx) {
    const { disputeId, paymentIntentId, jobId = null, clientId = null, amount, eventType } = ctx;
    // Try to find payout/cleaner for flagging (optional)
    if (jobId) {
        const payoutRow = await (0, client_1.query)(`
        SELECT p.id AS payout_id
        FROM payouts p
        JOIN earnings e ON e.payout_id = p.id
        WHERE e.job_id = $1
        LIMIT 1
      `, [jobId]);
        if (payoutRow.rows[0]?.payout_id) {
            if (eventType === "charge.dispute.created") {
                await (0, client_1.query)(`
            UPDATE payouts
            SET dispute_flag = true, updated_at = NOW()
            WHERE id = $1
          `, [payoutRow.rows[0].payout_id]);
            }
            else if (eventType === "charge.dispute.closed") {
                await (0, client_1.query)(`
            UPDATE payouts
            SET dispute_flag = false, updated_at = NOW()
            WHERE id = $1
          `, [payoutRow.rows[0].payout_id]);
            }
        }
    }
    // If closed and lost: refund credits to client; no cleaner clawback
    const isClosedLost = eventType === "charge.dispute.closed" && ctx.status === "lost";
    if (isClosedLost && clientId && amount > 0) {
        const { env } = await Promise.resolve().then(() => __importStar(require("../config/env")));
        const credits = env.CENTS_PER_CREDIT ? amount / env.CENTS_PER_CREDIT : 0;
        if (credits > 0) {
            await (0, creditsService_1.addLedgerEntry)({
                userId: clientId,
                jobId,
                deltaCredits: credits,
                reason: "refund",
            });
            if (jobId) {
                await (0, client_1.query)(`
            UPDATE jobs
            SET status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
          `, [jobId]);
            }
            logger_1.logger.info("chargeback_client_refund", {
                disputeId,
                paymentIntentId,
                jobId,
                clientId,
                credits,
            });
        }
    }
}
