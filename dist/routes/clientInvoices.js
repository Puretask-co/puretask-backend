"use strict";
// src/routes/clientInvoices.ts
// Client-side Invoice Routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const jwtAuth_1 = require("../middleware/jwtAuth");
const invoiceService_1 = require("../services/invoiceService");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
// ============================================
// Validation Schemas
// ============================================
const invoiceListSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    limit: zod_1.z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
    offset: zod_1.z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
});
const payInvoiceSchema = zod_1.z.object({
    payment_method: zod_1.z.enum(["credits", "card"]),
});
const declineInvoiceSchema = zod_1.z.object({
    reason: zod_1.z.string().max(1000).optional(),
});
// ============================================
// CLIENT INVOICE ENDPOINTS
// ============================================
/**
 * GET /client/invoices
 * List all invoices sent to this client
 */
router.get("/invoices", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const clientId = req.user.id;
        const filters = invoiceListSchema.parse(req.query);
        const result = await (0, invoiceService_1.getClientInvoices)(clientId, {
            status: filters.status,
            limit: filters.limit,
            offset: filters.offset,
        });
        res.json({
            success: true,
            data: result.invoices,
            pagination: {
                total: result.total,
                limit: filters.limit || 50,
                offset: filters.offset || 0,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_client_invoices_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get invoices",
        });
    }
});
/**
 * GET /client/invoices/:invoiceId
 * Get a specific invoice with line items
 */
router.get("/invoices/:invoiceId", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const clientId = req.user.id;
        const { invoiceId } = req.params;
        const invoice = await (0, invoiceService_1.getInvoiceWithLineItems)(invoiceId);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: "Invoice not found",
            });
        }
        if (invoice.client_id !== clientId) {
            return res.status(403).json({
                success: false,
                error: "This invoice is not for you",
            });
        }
        // Clients should only see sent, paid, declined, cancelled, expired invoices
        const hiddenStatuses = ["draft", "pending_approval"];
        if (hiddenStatuses.includes(invoice.status)) {
            return res.status(404).json({
                success: false,
                error: "Invoice not found",
            });
        }
        const history = await (0, invoiceService_1.getInvoiceStatusHistory)(invoiceId);
        res.json({
            success: true,
            data: {
                ...invoice,
                status_history: history,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_client_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get invoice",
        });
    }
});
/**
 * POST /client/invoices/:invoiceId/pay
 * Pay an invoice (with credits or card)
 */
router.post("/invoices/:invoiceId/pay", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const clientId = req.user.id;
        const { invoiceId } = req.params;
        const { payment_method } = payInvoiceSchema.parse(req.body);
        if (payment_method === "credits") {
            const invoice = await (0, invoiceService_1.payInvoiceWithCredits)(invoiceId, clientId);
            res.json({
                success: true,
                data: {
                    invoice,
                    payment_status: "completed",
                },
            });
        }
        else {
            // Card payment - returns client secret for frontend to complete
            const result = await (0, invoiceService_1.payInvoiceWithCard)(invoiceId, clientId);
            res.json({
                success: true,
                data: {
                    invoice: result.invoice,
                    payment_status: "pending",
                    client_secret: result.paymentIntentClientSecret,
                },
            });
        }
    }
    catch (error) {
        logger_1.logger.error("pay_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to pay invoice",
        });
    }
});
/**
 * POST /client/invoices/:invoiceId/decline
 * Decline an invoice
 */
router.post("/invoices/:invoiceId/decline", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("client"), async (req, res) => {
    try {
        const clientId = req.user.id;
        const { invoiceId } = req.params;
        const { reason } = declineInvoiceSchema.parse(req.body);
        const invoice = await (0, invoiceService_1.declineInvoice)(invoiceId, clientId, reason);
        res.json({
            success: true,
            data: invoice,
        });
    }
    catch (error) {
        logger_1.logger.error("decline_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to decline invoice",
        });
    }
});
exports.default = router;
