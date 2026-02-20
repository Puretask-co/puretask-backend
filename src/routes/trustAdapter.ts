// src/routes/trustAdapter.ts
// Trust-Fintech API adapter — exposes Trust contract at /api/credits, /api/billing, /api/appointments
// Maps PureTask services to the frontend Trust hooks contract (useCreditsTrust, useBillingTrust, useLiveAppointmentTrust)

import { Router, Response } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireRole,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { requireOwnership } from "../lib/ownership";
import { validateQuery, validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { getUserBalance, getCreditLedgerFiltered } from "../services/creditsService";
import { createCreditCheckoutSession } from "../services/creditsPurchaseService";
import {
  getClientInvoices,
  getInvoiceWithLineItems,
  payInvoiceWithCredits,
  payInvoiceWithCard,
  type InvoiceStatus,
} from "../services/invoiceService";
import { getCleanerReliabilityInfo } from "../services/reliabilityService";
import { query } from "../db/client";
import type { CreditReason } from "../types/db";

const router = Router();

// ============================================
// Helpers: map PureTask → Trust contract
// ============================================

const reasonToTrustType: Record<CreditReason, string> = {
  purchase: "deposit",
  subscription_credit: "deposit",
  job_escrow: "spend",
  job_release: "credit",
  refund: "deposit",
  adjustment: "adjustment",
  invoice_payment: "spend",
};

const jobStatusToTrustState: Record<string, string> = {
  requested: "scheduled",
  accepted: "scheduled",
  on_my_way: "en_route",
  in_progress: "checked_in",
  awaiting_approval: "checked_in",
  completed: "completed",
  disputed: "checked_in",
  cancelled: "cancelled",
};

// ============================================
// TRUST CREDITS
// ============================================

/**
 * GET /api/credits/balance
 * Trust contract: { balance, currency, lastUpdatedISO }
 */
router.get(
  "/credits/balance",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const balance = await getUserBalance(req.user!.id);
      const lastRow = await query<{ created_at: string }>(
        `SELECT created_at FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.user!.id]
      );
      res.json({
        balance,
        currency: "USD",
        lastUpdatedISO: lastRow.rows[0]?.created_at ?? new Date().toISOString(),
      });
    } catch (error) {
      logger.error("trust_credits_balance_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to get balance" });
    }
  })
);

const ledgerQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
});

/**
 * GET /api/credits/ledger
 * Trust contract: { entries: [...] }
 */
router.get(
  "/credits/ledger",
  requireAuth,
  requireRole("client"),
  validateQuery(ledgerQuerySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const limit = q.limit ? Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50)) : 50;
      const rows = await getCreditLedgerFiltered(req.user!.id, {
        from: q.from,
        to: q.to,
        type: q.type,
        status: q.status,
        search: q.search,
        limit,
      });

      const entries = rows.map((r) => ({
        id: r.id,
        createdAtISO: r.created_at,
        type: reasonToTrustType[r.reason] ?? "adjustment",
        amount: r.delta_credits,
        currency: "USD",
        description: describeLedgerReason(r.reason, r.job_id),
        status: "posted" as const,
        invoiceId: r.reason === "invoice_payment" ? r.job_id : undefined,
        relatedBookingId: r.reason === "job_escrow" || r.reason === "job_release" || r.reason === "refund" ? r.job_id : undefined,
      }));

      res.json({ entries });
    } catch (error) {
      logger.error("trust_credits_ledger_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to get ledger" });
    }
  })
);

function describeLedgerReason(reason: CreditReason, jobId: string | null): string {
  const jobRef = jobId ? ` #${jobId.slice(0, 8)}` : "";
  switch (reason) {
    case "purchase":
      return "Credits top-up";
    case "subscription_credit":
      return "Subscription credit";
    case "job_escrow":
      return `Booking escrow${jobRef}`;
    case "job_release":
      return `Earnings released${jobRef}`;
    case "refund":
      return `Refund${jobRef}`;
    case "adjustment":
      return "Adjustment";
    case "invoice_payment":
      return `Invoice payment${jobRef}`;
    default:
      return reason;
  }
}

/** Trust contract: POST /credits/checkout → { checkoutUrl } (spec: not under /api; we expose under /api for consistency) */
const checkoutBodySchema = z.object({
  packageId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post(
  "/credits/checkout",
  requireAuth,
  requireRole("client"),
  validateBody(checkoutBodySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { packageId, successUrl, cancelUrl } = req.body;
      const session = await createCreditCheckoutSession({
        userId: req.user!.id,
        packageId,
        successUrl,
        cancelUrl,
      });
      res.json({ checkoutUrl: session.url });
    } catch (error) {
      logger.error("trust_credits_checkout_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      if ((error as Error).message === "Invalid credit package") {
        res.status(400).json({ message: "Invalid credit package" });
        return;
      }
      res.status(500).json({ message: "Failed to create checkout" });
    }
  })
);

// ============================================
// TRUST BILLING (client invoices)
// ============================================

/**
 * GET /api/billing/invoices
 * Trust contract: { invoices: [...] }
 */
router.get(
  "/billing/invoices",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const result = await getClientInvoices(req.user!.id, {
        limit: 100,
        offset: 0,
      });

      const ids = result.invoices.map((inv) => inv.id);
      const lineItemsByInvoice: Record<string, { id: string; label: string; amount: number }[]> = {};
      if (ids.length > 0) {
        const items = await query<{ invoice_id: string; id: string; description: string; total_cents: number }>(
          `SELECT invoice_id, id, description, total_cents FROM invoice_line_items WHERE invoice_id = ANY($1)`,
          [ids]
        );
        for (const row of items.rows) {
          if (!lineItemsByInvoice[row.invoice_id]) lineItemsByInvoice[row.invoice_id] = [];
          lineItemsByInvoice[row.invoice_id].push({
            id: row.id,
            label: row.description,
            amount: row.total_cents / 100,
          });
        }
      }

      const invoices = result.invoices.map((inv) => ({
        id: inv.id,
        createdAtISO: inv.created_at,
        status: inv.status,
        subtotal: inv.subtotal_cents / 100,
        tax: inv.tax_cents / 100,
        total: inv.total_cents / 100,
        currency: "USD",
        bookingId: inv.job_id ?? undefined,
        receiptUrl: "",
        lineItems: lineItemsByInvoice[inv.id] ?? [],
        paymentMethodSummary: inv.paid_via ? `${inv.paid_via} ••••` : undefined,
      }));

      res.json({ invoices });
    } catch (error) {
      logger.error("trust_billing_invoices_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to get invoices" });
    }
  })
);

/**
 * GET /api/billing/invoices/:id
 * Trust contract: single invoice with lineItems
 */
router.get(
  "/billing/invoices/:id",
  requireAuth,
  requireRole("client"),
  requireOwnership("invoice", "id"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const invoice = await getInvoiceWithLineItems(id);

      if (!invoice || invoice.client_id !== req.user!.id) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const hiddenStatuses: InvoiceStatus[] = ["draft", "pending_approval"];
      if (hiddenStatuses.includes(invoice.status)) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json({
        id: invoice.id,
        createdAtISO: invoice.created_at,
        status: invoice.status,
        subtotal: invoice.subtotal_cents / 100,
        tax: invoice.tax_cents / 100,
        total: invoice.total_cents / 100,
        currency: "USD",
        bookingId: invoice.job_id ?? undefined,
        receiptUrl: "",
        lineItems: (invoice.line_items ?? []).map((li) => ({
          id: li.id,
          label: li.description,
          amount: li.total_cents / 100,
        })),
        paymentMethodSummary: invoice.paid_via ? `${invoice.paid_via} ••••` : undefined,
      });
    } catch (error) {
      logger.error("trust_billing_invoice_detail_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to get invoice" });
    }
  })
);

/** Trust contract: POST /client/invoices/:id/pay → { ok: true } */
const payInvoiceBodySchema = z.object({
  payment_method: z.enum(["credits", "card"]),
});

router.post(
  "/client/invoices/:id/pay",
  requireAuth,
  requireRole("client"),
  requireOwnership("invoice", "id"),
  validateBody(payInvoiceBodySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { payment_method } = req.body;
      const clientId = req.user!.id;

      if (payment_method === "credits") {
        await payInvoiceWithCredits(id, clientId);
      } else {
        await payInvoiceWithCard(id, clientId);
      }
      res.json({ ok: true });
    } catch (error) {
      logger.error("trust_invoice_pay_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
        invoiceId: req.params.id,
      });
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode ?? 500).json({ message: err.message ?? "Failed to pay invoice" });
    }
  })
);

// ============================================
// TRUST LIVE APPOINTMENT (job = booking)
// ============================================

/**
 * GET /api/appointments/:bookingId/live
 * Trust contract: { bookingId, state, etaISO?, gps[], photos[], checklist[], events[] }
 */
router.get(
  "/appointments/:bookingId/live",
  requireAuth,
  requireOwnership("job", "bookingId"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;
      const role = req.user!.role;

      const jobResult = await query<{
        id: string;
        status: string;
        scheduled_start_at: string;
        client_id: string;
        cleaner_id: string | null;
      }>(
        `SELECT id, status, scheduled_start_at, client_id, cleaner_id FROM jobs WHERE id = $1 AND (client_id = $2 OR cleaner_id = $2)`,
        [bookingId, userId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const job = jobResult.rows[0];
      const state = jobStatusToTrustState[job.status] ?? "scheduled";

      const eventsResult = await query<{
        id: string;
        event_type: string;
        payload: Record<string, unknown>;
        created_at: string;
        actor_type: string;
      }>(
        `SELECT id, event_type, payload, created_at, actor_type FROM job_events WHERE job_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [bookingId]
      );

      const gps: { id: string; event: string; atISO: string; lat: number; lng: number; accuracyM?: number; source: string }[] = [];
      const events = eventsResult.rows.map((e) => {
        if (e.event_type === "cleaner.location_updated" && e.payload && typeof e.payload === "object") {
          const p = e.payload as { latitude?: number; longitude?: number; accuracy?: number };
          if (typeof p.latitude === "number" && typeof p.longitude === "number") {
            gps.push({
              id: e.id,
              event: "location",
              atISO: e.created_at,
              lat: p.latitude,
              lng: p.longitude,
              accuracyM: typeof p.accuracy === "number" ? p.accuracy : undefined,
              source: "device",
            });
          }
        }
        return {
          id: e.id,
          atISO: e.created_at,
          type: e.event_type === "cleaner.location_updated" ? "gps" : "state_change",
          summary: e.event_type.replace(/_/g, " "),
          metadata: e.payload ?? {},
        };
      });

      const photosResult = await query<{
        id: string;
        type: string;
        url: string;
        created_at: string;
      }>(`SELECT id, type, url, created_at FROM job_photos WHERE job_id = $1 ORDER BY created_at ASC`, [
        bookingId,
      ]);

      const photos = photosResult.rows.map((p) => ({
        id: p.id,
        type: p.type,
        url: p.url,
        atISO: p.created_at,
      }));

      const checklist = [
        { id: "c1", label: "Kitchen", completed: photos.some((p) => p.type === "after") },
        { id: "c2", label: "Bathrooms", completed: false },
        { id: "c3", label: "Floors", completed: false },
      ];

      const etaISO =
        role === "client" && job.cleaner_id && (job.status === "on_my_way" || job.status === "in_progress")
          ? new Date(Date.now() + 15 * 60000).toISOString()
          : undefined;

      res.json({
        bookingId,
        state,
        etaISO,
        gps,
        photos,
        checklist,
        events,
      });
    } catch (error) {
      logger.error("trust_live_appointment_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to get live appointment" });
    }
  })
);

const appointmentEventSchema = z.object({
  type: z.enum(["en_route", "arrived", "check_in", "check_out", "note"]),
  note: z.string().optional(),
  gps: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracyM: z.number().optional(),
    })
    .optional(),
  source: z.enum(["device", "manual_override"]).optional(),
});

/**
 * POST /api/appointments/:bookingId/events
 * Trust contract: { ok: true }
 * Delegates to existing tracking service (startEnRoute, markArrived, checkIn, checkOut)
 */
router.post(
  "/appointments/:bookingId/events",
  requireAuth,
  requireOwnership("job", "bookingId"),
  validateBody(appointmentEventSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { bookingId } = req.params;
      const { type, note, gps } = req.body;
      const userId = req.user!.id;

      if (req.user!.role !== "cleaner") {
        return res.status(403).json({ message: "Cleaners only" });
      }

      const location = gps
        ? { latitude: gps.lat, longitude: gps.lng, accuracy: gps.accuracyM }
        : { latitude: 0, longitude: 0 };

      const {
        startEnRoute,
        markArrived,
        updateCleanerLocation,
      } = await import("../services/jobTrackingService");
      const { publishEvent } = await import("../lib/events");

      switch (type) {
        case "en_route":
          await startEnRoute(bookingId, userId, location);
          break;
        case "arrived":
          await markArrived(bookingId, userId, location);
          break;
        case "check_in":
        case "check_out":
          return res.status(501).json({
            message: "Use POST /tracking/:jobId/check-in and /tracking/:jobId/check-out with beforePhotos/afterPhotos",
          });
        case "note":
          await publishEvent({
            jobId: bookingId,
            actorType: "cleaner",
            actorId: userId,
            eventName: "job.note",
            payload: { note: note ?? "" },
          });
          break;
        default:
          return res.status(400).json({ message: "Unknown event type" });
      }

      if (gps && (type === "en_route" || type === "arrived")) {
        await updateCleanerLocation(bookingId, userId, {
          latitude: gps.lat,
          longitude: gps.lng,
          accuracy: gps.accuracyM,
        });
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error("trust_appointment_event_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to record event" });
    }
  })
);

// ============================================
// TRUST RELIABILITY (client views cleaner)
// ============================================

/**
 * GET /api/cleaners/:cleanerId/reliability
 * Trust contract: { reliability: { score, tier, breakdown?, explainers? } }
 */
router.get(
  "/cleaners/:cleanerId/reliability",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { cleanerId } = req.params;
      const info = await getCleanerReliabilityInfo(cleanerId);
      const explainers: string[] = [
        `Score: ${info.score}%`,
        `Tier: ${info.tier}`,
        `Completed jobs (90d): ${info.stats.completed_jobs}`,
        `Total jobs (90d): ${info.stats.total_jobs}`,
      ];
      if (info.stats.avg_rating != null) {
        explainers.push(`Average rating: ${info.stats.avg_rating.toFixed(1)}`);
      }
      res.json({
        reliability: {
          score: info.score,
          tier: info.tier,
          breakdown: info.stats,
          explainers,
        },
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      if (err.statusCode === 404) {
        return res.status(404).json({ message: "Cleaner not found" });
      }
      logger.error("trust_reliability_failed", {
        error: (err as Error).message,
        userId: req.user?.id,
        cleanerId: req.params.cleanerId,
      });
      res.status(500).json({ message: "Failed to get reliability" });
    }
  })
);

// ============================================
// Trust root routes (spec exact paths, no /api prefix)
// POST /credits/checkout → { checkoutUrl }
// GET /cleaners/:cleanerId/reliability → { reliability }
// ============================================
export const trustRootRouter = Router();

trustRootRouter.post(
  "/credits/checkout",
  requireAuth,
  requireRole("client"),
  validateBody(checkoutBodySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { packageId, successUrl, cancelUrl } = req.body;
      const session = await createCreditCheckoutSession({
        userId: req.user!.id,
        packageId,
        successUrl,
        cancelUrl,
      });
      res.json({ checkoutUrl: session.url });
    } catch (error) {
      logger.error("trust_credits_checkout_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      if ((error as Error).message === "Invalid credit package") {
        res.status(400).json({ message: "Invalid credit package" });
        return;
      }
      res.status(500).json({ message: "Failed to create checkout" });
    }
  })
);

trustRootRouter.get(
  "/cleaners/:cleanerId/reliability",
  requireAuth,
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { cleanerId } = req.params;
      const info = await getCleanerReliabilityInfo(cleanerId);
      const explainers: string[] = [
        `Score: ${info.score}%`,
        `Tier: ${info.tier}`,
        `Completed jobs (90d): ${info.stats.completed_jobs}`,
        `Total jobs (90d): ${info.stats.total_jobs}`,
      ];
      if (info.stats.avg_rating != null) {
        explainers.push(`Average rating: ${info.stats.avg_rating.toFixed(1)}`);
      }
      res.json({
        reliability: {
          score: info.score,
          tier: info.tier,
          breakdown: info.stats,
          explainers,
        },
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      if (err.statusCode === 404) {
        return res.status(404).json({ message: "Cleaner not found" });
      }
      logger.error("trust_reliability_failed", {
        error: (err as Error).message,
        userId: req.user?.id,
        cleanerId: req.params.cleanerId,
      });
      res.status(500).json({ message: "Failed to get reliability" });
    }
  })
);

export default router;
