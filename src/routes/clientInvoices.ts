// src/routes/clientInvoices.ts
// Client-side Invoice Routes

import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import {
  getClientInvoices,
  getInvoiceWithLineItems,
  payInvoiceWithCredits,
  payInvoiceWithCard,
  declineInvoice,
  getInvoiceStatusHistory,
  InvoiceStatus,
} from "../services/invoiceService";
import { logger } from "../lib/logger";

const router = Router();

// ============================================
// Validation Schemas
// ============================================

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

const payInvoiceSchema = z.object({
  payment_method: z.enum(["credits", "card"]),
});

const declineInvoiceSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ============================================
// CLIENT INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /client/invoices:
 *   get:
 *     summary: Get client invoices
 *     description: List all invoices sent to this client.
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of invoices
 *       403:
 *         description: Forbidden - clients only
 */
router.get(
  "/invoices",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const filters = invoiceListSchema.parse(req.query);

      const result = await getClientInvoices(clientId, {
        status: filters.status as InvoiceStatus | undefined,
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
      logger.error("get_client_invoices_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get invoices",
      });
    }
  })
);

/**
 * @swagger
 * /client/invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice by ID
 *     description: Get a specific invoice with line items.
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice details
 *       404:
 *         description: Not found
 *       403:
 *         description: Forbidden - clients only
 */
router.get(
  "/invoices/:invoiceId",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { invoiceId } = req.params;

      const invoice = await getInvoiceWithLineItems(invoiceId);

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: "Invoice not found",
        });
        return;
      }

      if (invoice.client_id !== clientId) {
        res.status(403).json({
          success: false,
          error: "This invoice is not for you",
        });
        return;
      }

      // Clients should only see sent, paid, declined, cancelled, expired invoices
      const hiddenStatuses: InvoiceStatus[] = ["draft", "pending_approval"];
      if (hiddenStatuses.includes(invoice.status)) {
        res.status(404).json({
          success: false,
          error: "Invoice not found",
        });
        return;
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
      logger.error("get_client_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get invoice",
      });
    }
  })
);

/**
 * @swagger
 * /client/invoices/{invoiceId}/pay:
 *   post:
 *     summary: Pay invoice
 *     description: Pay an invoice with credits or card.
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_method
 *             properties:
 *               payment_method:
 *                 type: string
 *                 enum: [credits, card]
 *     responses:
 *       200:
 *         description: Payment initiated or completed
 *       403:
 *         description: Forbidden - clients only
 */
router.post(
  "/invoices/:invoiceId/pay",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { invoiceId } = req.params;
      const { payment_method } = payInvoiceSchema.parse(req.body);

      if (payment_method === "credits") {
        const invoice = await payInvoiceWithCredits(invoiceId, clientId);

        res.json({
          success: true,
          data: {
            invoice,
            payment_status: "completed",
          },
        });
      } else {
        // Card payment - returns client secret for frontend to complete
        const result = await payInvoiceWithCard(invoiceId, clientId);

        res.json({
          success: true,
          data: {
            invoice: result.invoice,
            payment_status: "pending",
            client_secret: result.paymentIntentClientSecret,
          },
        });
      }
    } catch (error) {
      logger.error("pay_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to pay invoice",
      });
    }
  })
);

/**
 * @swagger
 * /client/invoices/{invoiceId}/decline:
 *   post:
 *     summary: Decline invoice
 *     description: Decline an invoice.
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Invoice declined
 *       403:
 *         description: Forbidden - clients only
 */
router.post(
  "/invoices/:invoiceId/decline",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { invoiceId } = req.params;
      const { reason } = declineInvoiceSchema.parse(req.body);

      const invoice = await declineInvoice(invoiceId, clientId, reason);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error("decline_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to decline invoice",
      });
    }
  })
);

export default router;

