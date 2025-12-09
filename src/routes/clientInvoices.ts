// src/routes/clientInvoices.ts
// Client-side Invoice Routes

import { Router, Response } from "express";
import { z } from "zod";
import { jwtAuth, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
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
 * GET /client/invoices
 * List all invoices sent to this client
 */
router.get(
  "/invoices",
  jwtAuth,
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

/**
 * GET /client/invoices/:invoiceId
 * Get a specific invoice with line items
 */
router.get(
  "/invoices/:invoiceId",
  jwtAuth,
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { invoiceId } = req.params;

      const invoice = await getInvoiceWithLineItems(invoiceId);

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
      const hiddenStatuses: InvoiceStatus[] = ["draft", "pending_approval"];
      if (hiddenStatuses.includes(invoice.status)) {
        return res.status(404).json({
          success: false,
          error: "Invoice not found",
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
      logger.error("get_client_invoice_error", { error });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || "Failed to get invoice",
      });
    }
  }
);

/**
 * POST /client/invoices/:invoiceId/pay
 * Pay an invoice (with credits or card)
 */
router.post(
  "/invoices/:invoiceId/pay",
  jwtAuth,
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

/**
 * POST /client/invoices/:invoiceId/decline
 * Decline an invoice
 */
router.post(
  "/invoices/:invoiceId/decline",
  jwtAuth,
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

export default router;

