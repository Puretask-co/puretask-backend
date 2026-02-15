// src/routes/credits.ts
// Credits purchase and wallet routes
// Matches 001_init.sql + 002_supplementary.sql schema

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import {
  requireAuth,
  requireRole,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import {
  getCreditPackages,
  createCreditCheckoutSession,
  getPurchaseHistory,
} from "../services/creditsPurchaseService";
import { getUserBalance, getCreditHistory } from "../services/creditsService";

const creditsRouter = Router();

/**
 * @swagger
 * /credits/packages:
 *   get:
 *     summary: Get available credit packages
 *     description: Get list of available credit packages. Public endpoint, no authentication required.
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of credit packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CreditPackage'
 */
creditsRouter.get("/packages", (req, res: Response) => {
  const packages = getCreditPackages();
  res.json({ packages });
});

creditsRouter.use(requireAuth);

/**
 * @swagger
 * /credits/balance:
 *   get:
 *     summary: Get current credit balance
 *     description: Get the current credit balance for the authenticated client.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current credit balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   description: Current credit balance
 *                   example: 150
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
creditsRouter.get(
  "/balance",
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const balance = await getUserBalance(req.user!.id);
      res.json({ balance });
    } catch (error) {
      logger.error("get_balance_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_BALANCE_FAILED", message: "Failed to get balance" },
      });
    }
  })
);

/**
 * @swagger
 * /credits/checkout:
 *   post:
 *     summary: Create checkout session for credit purchase
 *     description: Create a Stripe checkout session for purchasing credits.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *               - successUrl
 *               - cancelUrl
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: Credit package ID
 *                 example: "package_50"
 *               successUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect after successful payment
 *                 example: "https://app.puretask.com/payment/success"
 *               cancelUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect if payment is cancelled
 *                 example: "https://app.puretask.com/payment/cancel"
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                   description: Stripe checkout session ID
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Checkout URL to redirect user to
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
const checkoutSchema = z.object({
  packageId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

creditsRouter.post(
  "/checkout",
  requireRole("client"),
  validateBody(checkoutSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { packageId, successUrl, cancelUrl } = req.body;

      const session = await createCreditCheckoutSession({
        userId: req.user!.id,
        packageId,
        successUrl,
        cancelUrl,
      });

      res.json(session);
    } catch (error) {
      logger.error("checkout_creation_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });

      if ((error as Error).message === "Invalid credit package") {
        res.status(400).json({
          error: { code: "INVALID_PACKAGE", message: "Invalid credit package" },
        });
        return;
      }

      res.status(500).json({
        error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout" },
      });
    }
  })
);

/**
 * @swagger
 * /credits/history:
 *   get:
 *     summary: Get credit transaction history
 *     description: Get credit transaction history for the authenticated client.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Credit transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string', format: 'uuid' }
 *                       type: { type: 'string', enum: ['purchase', 'escrow', 'release', 'refund'] }
 *                       amount: { type: 'number' }
 *                       balance_after: { type: 'number' }
 *                       created_at: { type: 'string', format: 'date-time' }
 *       401:
 *         description: Unauthorized
 */
creditsRouter.get(
  "/history",
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const history = await getCreditHistory(req.user!.id, parseInt(limit as string, 10));
      res.json({ transactions: history });
    } catch (error) {
      logger.error("get_history_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_HISTORY_FAILED", message: "Failed to get history" },
      });
    }
  })
);

/**
 * @swagger
 * /credits/purchases:
 *   get:
 *     summary: Get credit purchase history
 *     description: Get history of credit purchases for the authenticated client.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of purchases to return
 *     responses:
 *       200:
 *         description: Credit purchase history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchases:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string', format: 'uuid' }
 *                       package_id: { type: 'string' }
 *                       credits: { type: 'number' }
 *                       amount_cents: { type: 'number' }
 *                       stripe_payment_intent_id: { type: 'string' }
 *                       created_at: { type: 'string', format: 'date-time' }
 *       401:
 *         description: Unauthorized
 */
creditsRouter.get(
  "/purchases",
  requireRole("client"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const purchases = await getPurchaseHistory(req.user!.id, parseInt(limit as string, 10));
      res.json({ purchases });
    } catch (error) {
      logger.error("get_purchases_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_PURCHASES_FAILED", message: "Failed to get purchases" },
      });
    }
  })
);

export default creditsRouter;
