// src/routes/credits.ts
// Credits purchase and wallet routes
// Matches 001_init.sql + 002_supplementary.sql schema

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
import {
  getCreditPackages,
  createCreditCheckoutSession,
  getPurchaseHistory,
} from "../services/creditsPurchaseService";
import {
  getUserBalance,
  getCreditHistory,
} from "../services/creditsService";

const creditsRouter = Router();

/**
 * GET /credits/packages
 * Get available credit packages (public, no auth required)
 */
creditsRouter.get("/packages", (req, res: Response) => {
  const packages = getCreditPackages();
  res.json({ packages });
});

// All other routes require authentication
creditsRouter.use(jwtAuthMiddleware);

/**
 * GET /credits/balance
 * Get current credit balance
 */
creditsRouter.get(
  "/balance",
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

/**
 * POST /credits/checkout
 * Create checkout session for credit purchase
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
  async (req: JWTAuthedRequest, res: Response) => {
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
        return res.status(400).json({
          error: { code: "INVALID_PACKAGE", message: "Invalid credit package" },
        });
      }

      res.status(500).json({
        error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout" },
      });
    }
  }
);

/**
 * GET /credits/history
 * Get credit transaction history
 */
creditsRouter.get(
  "/history",
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const history = await getCreditHistory(
        req.user!.id,
        parseInt(limit as string, 10)
      );
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
  }
);

/**
 * GET /credits/purchases
 * Get credit purchase history
 */
creditsRouter.get(
  "/purchases",
  requireRole("client"),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const purchases = await getPurchaseHistory(
        req.user!.id,
        parseInt(limit as string, 10)
      );
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
  }
);

export default creditsRouter;
