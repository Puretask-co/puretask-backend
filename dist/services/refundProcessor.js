"use strict";
// src/services/refundProcessor.ts
// Central refund processing (idempotent, branching by context)
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
exports.processStripeRefund = processStripeRefund;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const creditsService_1 = require("./creditsService");
/**
 * Process a refund coming from Stripe (charge.refunded)
 * This is a scaffold that no-ops if it cannot map context safely.
 */
async function processStripeRefund(ctx) {
    const { chargeId, paymentIntentId, jobId = null, clientId = null, purpose = null, amount } = ctx;
    // Determine credits from amount if possible (using env.CENTS_PER_CREDIT)
    const { env } = await Promise.resolve().then(() => __importStar(require("../config/env")));
    const credits = env.CENTS_PER_CREDIT ? amount / env.CENTS_PER_CREDIT : 0;
    if (!credits || Number.isNaN(credits) || credits <= 0) {
        logger_1.logger.warn("refund_processor_invalid_credits_calc", { chargeId, paymentIntentId, amount, credits });
        return;
    }
    if (clientId && !jobId) {
        // Purchase/subscription refund: return credits to client wallet
        await (0, creditsService_1.addLedgerEntry)({
            userId: clientId,
            jobId: null,
            deltaCredits: credits,
            reason: "refund",
        });
        logger_1.logger.info("refund_processor_client_refund", { chargeId, paymentIntentId, clientId, credits });
        return;
    }
    if (clientId && jobId) {
        // Job refund: return credits to client wallet and mark job cancelled/refunded
        await (0, creditsService_1.addLedgerEntry)({
            userId: clientId,
            jobId,
            deltaCredits: credits,
            reason: "refund",
        });
        await (0, client_1.query)(`
        UPDATE jobs
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = $1
      `, [jobId]);
        logger_1.logger.info("refund_processor_job_refund", {
            chargeId,
            paymentIntentId,
            jobId,
            clientId,
            purpose,
            credits,
        });
        return;
    }
    logger_1.logger.warn("refund_processor_unmapped_context", {
        chargeId,
        paymentIntentId,
        jobId,
        clientId,
        purpose,
        credits,
    });
}
