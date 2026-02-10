// src/routes/userData.ts
// GDPR compliance routes: data export, deletion, consent management

import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/authCanonical";
import { asyncHandler, sendError } from "../lib/errors";
import {
  exportUserData,
  anonymizeUserData,
  recordConsent,
  getUserConsent,
} from "../services/gdprService";
import { logger } from "../lib/logger";

const userDataRouter = Router();

// All routes require authentication
userDataRouter.use(requireAuth);

// ============================================
// Validation Schemas
// ============================================

const consentSchema = z.object({
  type: z.enum(["privacy_policy", "terms_of_service", "marketing"]),
  accepted: z.boolean(),
  version: z.string().optional(),
});

// ============================================
// Data Export (GDPR Right to Access)
// ============================================

/**
 * @swagger
 * /user/data/export:
 *   get:
 *     summary: Export user data (GDPR)
 *     tags: [User Data]
 *     security:
 *       - bearerAuth: []
 *     description: Export all user data in JSON format for GDPR compliance
 *     responses:
 *       200:
 *         description: User data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                 jobs:
 *                   type: array
 *                 payments:
 *                   type: array
 *                 creditTransactions:
 *                   type: array
 *                 messages:
 *                   type: array
 *                 consentHistory:
 *                   type: array
 *       401:
 *         description: Unauthorized
 */
userDataRouter.get(
  "/export",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      const userData = await exportUserData(userId);

      logger.info("gdpr_data_export_requested", { userId });

      res.status(200).json({
        success: true,
        data: userData,
        message: "User data exported successfully",
      });
    } catch (error) {
      logger.error("gdpr_data_export_failed", {
        userId,
        error: (error as Error).message,
      });
      return sendError(res, error as Error);
    }
  })
);

// ============================================
// Data Deletion (GDPR Right to be Forgotten)
// ============================================

/**
 * @swagger
 * /user/data:
 *   delete:
 *     summary: Delete user data (GDPR)
 *     tags: [User Data]
 *     security:
 *       - bearerAuth: []
 *     description: Anonymize all user data for GDPR right to be forgotten. This action cannot be undone.
 *     responses:
 *       200:
 *         description: User data anonymized successfully
 *       401:
 *         description: Unauthorized
 */
userDataRouter.delete(
  "/",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;

    try {
      await anonymizeUserData(userId);

      logger.info("gdpr_data_deletion_requested", { userId });

      res.status(200).json({
        success: true,
        message: "User data anonymized successfully",
      });
    } catch (error) {
      logger.error("gdpr_data_deletion_failed", {
        userId,
        error: (error as Error).message,
      });
      return sendError(res, error as Error);
    }
  })
);

// ============================================
// Consent Management
// ============================================

/**
 * @swagger
 * /user/consent:
 *   post:
 *     summary: Record user consent
 *     tags: [User Data]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, accepted]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [privacy_policy, terms_of_service, marketing]
 *               accepted:
 *                 type: boolean
 *               version:
 *                 type: string
 *     responses:
 *       200:
 *         description: Consent recorded successfully
 *       400:
 *         description: Invalid input
 */
userDataRouter.post(
  "/consent",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const parsed = consentSchema.parse(req.body);

    try {
      await recordConsent(userId, parsed.type, parsed.accepted, parsed.version);

      logger.info("gdpr_consent_recorded", {
        userId,
        type: parsed.type,
        accepted: parsed.accepted,
      });

      res.status(200).json({
        success: true,
        message: "Consent recorded successfully",
      });
    } catch (error) {
      logger.error("gdpr_consent_failed", {
        userId,
        error: (error as Error).message,
      });
      return sendError(res, error as Error);
    }
  })
);

/**
 * @swagger
 * /user/consent/{type}:
 *   get:
 *     summary: Get user consent status
 *     tags: [User Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [privacy_policy, terms_of_service, marketing]
 *     responses:
 *       200:
 *         description: Consent status retrieved
 *       404:
 *         description: Consent not found
 */
userDataRouter.get(
  "/consent/:type",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const type = req.params.type as "privacy_policy" | "terms_of_service" | "marketing";

    if (!["privacy_policy", "terms_of_service", "marketing"].includes(type)) {
      return sendError(res, new Error("Invalid consent type"), 400);
    }

    try {
      const consent = await getUserConsent(userId, type);

      if (!consent) {
        return res.status(200).json({
          success: true,
          data: { accepted: false, message: "No consent recorded" },
        });
      }

      return res.status(200).json({
        success: true,
        data: consent,
      });
    } catch (error) {
      logger.error("gdpr_consent_get_failed", {
        userId,
        type,
        error: (error as Error).message,
      });
      return sendError(res, error as Error);
    }
  })
);

export default userDataRouter;
