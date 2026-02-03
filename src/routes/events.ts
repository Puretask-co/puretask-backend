// src/routes/events.ts
// n8n webhook events route with HMAC signature verification

import { Router, Response } from "express";
import { z } from "zod";
import { verifyN8nSignature } from "../lib/auth";
import { publishEvent } from "../lib/events";
import { logger } from "../lib/logger";

const eventsRouter = Router();

// ============================================
// Validation Schema
// ============================================

const eventSchema = z.object({
  jobId: z.string().uuid().optional(),
  actorType: z.enum(["client", "cleaner", "admin", "system"]).optional(),
  actorId: z.string().uuid().optional().nullable(),
  eventType: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

// ============================================
// Routes
// ============================================

/**
 * @swagger
 * /n8n/events:
 *   post:
 *     summary: Receive n8n webhook events
 *     description: Receive events from n8n workflows. Protected by HMAC signature verification.
 *     tags: [Events]
 *     parameters:
 *       - in: header
 *         name: x-n8n-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature of JSON body
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               jobId: { type: 'string', format: 'uuid' }
 *               actorType: { type: 'string', enum: ['client', 'cleaner', 'admin', 'system'] }
 *               actorId: { type: 'string', format: 'uuid' }
 *               eventType: { type: 'string' }
 *               payload: { type: 'object' }
 *     responses:
 *       204:
 *         description: Event received and processed
 *       400:
 *         description: Invalid signature or body
 */
eventsRouter.post(
  "/n8n/events",
  verifyN8nSignature,
  async (req, res: Response) => {
    try {
      const parsed = eventSchema.parse(req.body);

      await publishEvent({
        jobId: parsed.jobId,
        actorType: parsed.actorType,
        actorId: parsed.actorId,
        eventName: parsed.eventType,
        payload: parsed.payload,
      });

      logger.info("n8n_event_received", {
        eventType: parsed.eventType,
        jobId: parsed.jobId,
      });

      res.status(204).send();
    } catch (err) {
      const error = err as Error & { issues?: unknown };

      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid event body", details: error.issues },
        });
      }

      logger.error("n8n_event_failed", { error: error.message });
      res.status(500).json({
        error: { code: "EVENT_FAILED", message: error.message },
      });
    }
  }
);

/**
 * POST /events
 * Alternative endpoint without /n8n prefix
 * Also protected by HMAC signature verification
 */
eventsRouter.post(
  "/events",
  verifyN8nSignature,
  async (req, res: Response) => {
    try {
      const parsed = eventSchema.parse(req.body);

      await publishEvent({
        jobId: parsed.jobId,
        actorType: parsed.actorType,
        actorId: parsed.actorId,
        eventName: parsed.eventType,
        payload: parsed.payload,
      });

      res.status(204).send();
    } catch (err) {
      const error = err as Error & { issues?: unknown };

      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid event body" },
        });
      }

      logger.error("n8n_event_failed", { error: error.message });
      res.status(500).json({
        error: { code: "EVENT_FAILED", message: error.message },
      });
    }
  }
);

export default eventsRouter;
