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
 * POST /n8n/events
 * Receive events from n8n workflows
 * Protected by HMAC signature verification
 *
 * Headers required:
 *   x-n8n-signature: HMAC-SHA256 signature of JSON body
 *
 * Body:
 *   {
 *     "jobId": "uuid" (optional),
 *     "actorType": "client" | "cleaner" | "admin" | "system",
 *     "actorId": "uuid" (optional),
 *     "eventType": "string",
 *     "payload": {} (optional)
 *   }
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

      res.status(500).json({
        error: { code: "EVENT_FAILED", message: error.message },
      });
    }
  }
);

export default eventsRouter;
