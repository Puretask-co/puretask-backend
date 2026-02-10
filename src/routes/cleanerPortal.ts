// src/routes/cleanerPortal.ts
// Cleaner Portal: My Clients + Invoicing Routes

import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import {
  getCleanerClients,
  getCleanerClientProfile,
  getCleanerClientJobHistory,
  upsertCleanerClientNote,
  toggleClientFavorite,
} from "../services/cleanerClientsService";
import {
  createInvoice,
  sendInvoice,
  cancelInvoice,
  getCleanerInvoices,
  getInvoiceWithLineItems,
  getInvoiceStatusHistory,
  CreateInvoiceInput,
} from "../services/invoiceService";
import { logger } from "../lib/logger";

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const clientListSchema = z.object({
  sortBy: z.enum(["most_recent", "most_jobs", "highest_earnings", "favorites"]).optional(),
  search: z.string().optional(),
  favoriteOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
  offset: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

const updateNoteSchema = z.object({
  notes: z.string().optional(),
  preferences: z.string().optional(),
  is_favorite: z.boolean().optional(),
});

const createInvoiceSchema = z.object({
  job_id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  notes_to_client: z.string().max(2000).optional(),
  due_date: z.string().optional(),
  line_items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive(),
        unit_price_cents: z.number().int().positive(),
      })
    )
    .min(1)
    .max(50),
});

const invoiceListSchema = z.object({
  status: z.string().optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
  offset: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

// ============================================
// MY CLIENTS ENDPOINTS
// ============================================

/**
 * @swagger
 * /cleaner/clients:
 *   get:
 *     summary: List my clients
 *     description: List all clients this cleaner has worked with (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [most_recent, most_jobs, highest_earnings, favorites] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: favoriteOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: offset
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: data (clients), pagination
 *       403:
 *         description: Forbidden - cleaners only
 */
router.get(
  "/clients",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const filters = clientListSchema.parse(req.query);

      const result = await getCleanerClients(cleanerId, filters);

      res.json({
        success: true,
        data: result.clients,
        pagination: {
          total: result.total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        },
      });
    } catch (error) {
      logger.error("get_cleaner_clients_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get clients",
      });
    }
  }
));

/**
 * @swagger
 * /cleaner/clients/{clientId}:
 *   get:
 *     summary: Get client profile
 *     description: Get detailed profile of a client the cleaner has worked with (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Client profile
 *       404:
 *         description: Client not found
 *       403:
 *         description: Forbidden - cleaners only
 */
router.get(
  "/clients/:clientId",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { clientId } = req.params;

      const profile = await getCleanerClientProfile(cleanerId, clientId);

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
    } catch (error) {
      logger.error("get_cleaner_client_profile_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get client profile",
      });
    }
  }
));

/**
 * GET /cleaner/clients/:clientId/jobs
 * Get job history with a specific client
 */
router.get(
  "/clients/:clientId/jobs",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { clientId } = req.params;
      const limit = parseInt((req.query.limit as string) || "50", 10);
      const offset = parseInt((req.query.offset as string) || "0", 10);

      const result = await getCleanerClientJobHistory(cleanerId, clientId, limit, offset);

      res.json({
        success: true,
        data: result.jobs,
        pagination: {
          total: result.total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error("get_cleaner_client_jobs_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get job history",
      });
    }
  }
));

/**
 * @swagger
 * /cleaner/clients/{clientId}/notes:
 *   put:
 *     summary: Update client notes
 *     description: Update notes/preferences for a client (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string }
 *               preferences: { type: string }
 *               is_favorite: { type: boolean }
 *     responses:
 *       200:
 *         description: Note updated
 *       403:
 *         description: Forbidden - cleaners only
 */
router.put(
  "/clients/:clientId/notes",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { clientId } = req.params;
      const data = updateNoteSchema.parse(req.body);

      const note = await upsertCleanerClientNote(cleanerId, clientId, data);

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error("update_cleaner_client_note_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to update notes",
      });
    }
  }
));

/**
 * POST /cleaner/clients/:clientId/favorite
 * Toggle favorite status for a client
 */
router.post(
  "/clients/:clientId/favorite",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { clientId } = req.params;

      const isFavorite = await toggleClientFavorite(cleanerId, clientId);

      res.json({
        success: true,
        data: { is_favorite: isFavorite },
      });
    } catch (error) {
      logger.error("toggle_client_favorite_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to toggle favorite",
      });
    }
  }
));

// ============================================
// INVOICE ENDPOINTS (Cleaner)
// ============================================

/**
 * @swagger
 * /cleaner/clients/{clientId}/invoices:
 *   post:
 *     summary: Create invoice
 *     description: Create a new invoice for a client (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               job_id: { type: string, format: uuid }
 *               title: { type: string }
 *               description: { type: string }
 *               notes_to_client: { type: string }
 *               due_date: { type: string }
 *               line_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, quantity, unit_price_cents]
 *                   properties:
 *                     description: { type: string }
 *                     quantity: { type: number }
 *                     unit_price_cents: { type: integer }
 *     responses:
 *       201:
 *         description: Invoice created
 *       403:
 *         description: Forbidden - cleaners only
 */
router.post(
  "/clients/:clientId/invoices",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { clientId } = req.params;
      const body = createInvoiceSchema.parse(req.body);

      const input: CreateInvoiceInput = {
        client_id: clientId,
        job_id: body.job_id,
        title: body.title,
        description: body.description,
        notes_to_client: body.notes_to_client,
        due_date: body.due_date,
        line_items: body.line_items,
      };

      const invoice = await createInvoice(cleanerId, input);

      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error("create_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to create invoice",
      });
    }
  }
));

/**
 * GET /cleaner/invoices
 * List all invoices created by this cleaner
 */
router.get(
  "/invoices",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const filters = invoiceListSchema.parse(req.query);

      const result = await getCleanerInvoices(cleanerId, {
        status: filters.status as import("../services/invoiceService").InvoiceStatus | undefined,
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
    } catch (error) {
      logger.error("get_cleaner_invoices_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get invoices",
      });
    }
  }
));

/**
 * @swagger
 * /cleaner/invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice
 *     description: Get a specific invoice with line items and status history (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice with status_history
 *       404:
 *         description: Invoice not found
 *       403:
 *         description: Not your invoice / cleaners only
 */
router.get(
  "/invoices/:invoiceId",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { invoiceId } = req.params;

      const invoice = await getInvoiceWithLineItems(invoiceId);

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

      const history = await getInvoiceStatusHistory(invoiceId);

      res.json({
        success: true,
        data: {
          ...invoice,
          status_history: history,
        },
      });
    } catch (error) {
      logger.error("get_cleaner_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get invoice",
      });
    }
  }
));

/**
 * POST /cleaner/invoices/:invoiceId/send
 * Send an invoice to the client
 */
router.post(
  "/invoices/:invoiceId/send",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { invoiceId } = req.params;

      // Verify ownership
      const existing = await getInvoiceWithLineItems(invoiceId);
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

      const invoice = await sendInvoice(invoiceId, cleanerId, "cleaner");

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error("send_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to send invoice",
      });
    }
  }
));

/**
 * @swagger
 * /cleaner/invoices/{invoiceId}/cancel:
 *   post:
 *     summary: Cancel invoice
 *     description: Cancel an invoice (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Invoice cancelled
 *       403:
 *         description: Not your invoice / cleaners only
 */
router.post(
  "/invoices/:invoiceId/cancel",
  requireAuth,
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { invoiceId } = req.params;
      const { reason } = req.body;

      const invoice = await cancelInvoice(invoiceId, cleanerId, reason);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error("cancel_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to cancel invoice",
      });
    }
  }
));

export default router;

