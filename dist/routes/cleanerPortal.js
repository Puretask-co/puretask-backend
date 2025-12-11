"use strict";
// src/routes/cleanerPortal.ts
// Cleaner Portal: My Clients + Invoicing Routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const jwtAuth_1 = require("../middleware/jwtAuth");
const cleanerClientsService_1 = require("../services/cleanerClientsService");
const invoiceService_1 = require("../services/invoiceService");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
// ============================================
// Validation Schemas
// ============================================
const clientListSchema = zod_1.z.object({
    sortBy: zod_1.z.enum(["most_recent", "most_jobs", "highest_earnings", "favorites"]).optional(),
    search: zod_1.z.string().optional(),
    favoriteOnly: zod_1.z
        .string()
        .transform((v) => v === "true")
        .optional(),
    limit: zod_1.z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
    offset: zod_1.z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
});
const updateNoteSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
    preferences: zod_1.z.string().optional(),
    is_favorite: zod_1.z.boolean().optional(),
});
const createInvoiceSchema = zod_1.z.object({
    job_id: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string().max(200).optional(),
    description: zod_1.z.string().max(2000).optional(),
    notes_to_client: zod_1.z.string().max(2000).optional(),
    due_date: zod_1.z.string().optional(),
    line_items: zod_1.z
        .array(zod_1.z.object({
        description: zod_1.z.string().min(1).max(500),
        quantity: zod_1.z.number().positive(),
        unit_price_cents: zod_1.z.number().int().positive(),
    }))
        .min(1)
        .max(50),
});
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
// ============================================
// MY CLIENTS ENDPOINTS
// ============================================
/**
 * GET /cleaner/clients
 * List all clients this cleaner has worked with
 */
router.get("/clients", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const filters = clientListSchema.parse(req.query);
        const result = await (0, cleanerClientsService_1.getCleanerClients)(cleanerId, filters);
        res.json({
            success: true,
            data: result.clients,
            pagination: {
                total: result.total,
                limit: filters.limit || 50,
                offset: filters.offset || 0,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_cleaner_clients_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get clients",
        });
    }
});
/**
 * GET /cleaner/clients/:clientId
 * Get detailed profile of a specific client
 */
router.get("/clients/:clientId", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { clientId } = req.params;
        const profile = await (0, cleanerClientsService_1.getCleanerClientProfile)(cleanerId, clientId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: "Client not found or you have not worked with them",
            });
        }
        res.json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        logger_1.logger.error("get_cleaner_client_profile_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get client profile",
        });
    }
});
/**
 * GET /cleaner/clients/:clientId/jobs
 * Get job history with a specific client
 */
router.get("/clients/:clientId/jobs", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { clientId } = req.params;
        const limit = parseInt(req.query.limit || "50", 10);
        const offset = parseInt(req.query.offset || "0", 10);
        const result = await (0, cleanerClientsService_1.getCleanerClientJobHistory)(cleanerId, clientId, limit, offset);
        res.json({
            success: true,
            data: result.jobs,
            pagination: {
                total: result.total,
                limit,
                offset,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_cleaner_client_jobs_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get job history",
        });
    }
});
/**
 * PUT /cleaner/clients/:clientId/notes
 * Update notes/preferences for a client
 */
router.put("/clients/:clientId/notes", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { clientId } = req.params;
        const data = updateNoteSchema.parse(req.body);
        const note = await (0, cleanerClientsService_1.upsertCleanerClientNote)(cleanerId, clientId, data);
        res.json({
            success: true,
            data: note,
        });
    }
    catch (error) {
        logger_1.logger.error("update_cleaner_client_note_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to update notes",
        });
    }
});
/**
 * POST /cleaner/clients/:clientId/favorite
 * Toggle favorite status for a client
 */
router.post("/clients/:clientId/favorite", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { clientId } = req.params;
        const isFavorite = await (0, cleanerClientsService_1.toggleClientFavorite)(cleanerId, clientId);
        res.json({
            success: true,
            data: { is_favorite: isFavorite },
        });
    }
    catch (error) {
        logger_1.logger.error("toggle_client_favorite_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to toggle favorite",
        });
    }
});
// ============================================
// INVOICE ENDPOINTS (Cleaner)
// ============================================
/**
 * POST /cleaner/clients/:clientId/invoices
 * Create a new invoice for a client
 */
router.post("/clients/:clientId/invoices", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { clientId } = req.params;
        const body = createInvoiceSchema.parse(req.body);
        const input = {
            client_id: clientId,
            job_id: body.job_id,
            title: body.title,
            description: body.description,
            notes_to_client: body.notes_to_client,
            due_date: body.due_date,
            line_items: body.line_items,
        };
        const invoice = await (0, invoiceService_1.createInvoice)(cleanerId, input);
        res.status(201).json({
            success: true,
            data: invoice,
        });
    }
    catch (error) {
        logger_1.logger.error("create_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to create invoice",
        });
    }
});
/**
 * GET /cleaner/invoices
 * List all invoices created by this cleaner
 */
router.get("/invoices", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const filters = invoiceListSchema.parse(req.query);
        const result = await (0, invoiceService_1.getCleanerInvoices)(cleanerId, {
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
        logger_1.logger.error("get_cleaner_invoices_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get invoices",
        });
    }
});
/**
 * GET /cleaner/invoices/:invoiceId
 * Get a specific invoice with line items
 */
router.get("/invoices/:invoiceId", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { invoiceId } = req.params;
        const invoice = await (0, invoiceService_1.getInvoiceWithLineItems)(invoiceId);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: "Invoice not found",
            });
        }
        if (invoice.cleaner_id !== cleanerId) {
            return res.status(403).json({
                success: false,
                error: "This is not your invoice",
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
        logger_1.logger.error("get_cleaner_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to get invoice",
        });
    }
});
/**
 * POST /cleaner/invoices/:invoiceId/send
 * Send an invoice to the client
 */
router.post("/invoices/:invoiceId/send", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { invoiceId } = req.params;
        // Verify ownership
        const existing = await (0, invoiceService_1.getInvoiceWithLineItems)(invoiceId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: "Invoice not found",
            });
        }
        if (existing.cleaner_id !== cleanerId) {
            return res.status(403).json({
                success: false,
                error: "This is not your invoice",
            });
        }
        const invoice = await (0, invoiceService_1.sendInvoice)(invoiceId, cleanerId, "cleaner");
        res.json({
            success: true,
            data: invoice,
        });
    }
    catch (error) {
        logger_1.logger.error("send_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to send invoice",
        });
    }
});
/**
 * POST /cleaner/invoices/:invoiceId/cancel
 * Cancel an invoice
 */
router.post("/invoices/:invoiceId/cancel", jwtAuth_1.jwtAuthMiddleware, (0, jwtAuth_1.requireRole)("cleaner"), async (req, res) => {
    try {
        const cleanerId = req.user.id;
        const { invoiceId } = req.params;
        const { reason } = req.body;
        const invoice = await (0, invoiceService_1.cancelInvoice)(invoiceId, cleanerId, reason);
        res.json({
            success: true,
            data: invoice,
        });
    }
    catch (error) {
        logger_1.logger.error("cancel_invoice_error", { error });
        const err = error;
        res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || "Failed to cancel invoice",
        });
    }
});
exports.default = router;
