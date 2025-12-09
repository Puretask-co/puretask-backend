"use strict";
// src/routes/events.ts
// n8n webhook events route with HMAC signature verification
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../lib/auth");
const events_1 = require("../lib/events");
const logger_1 = require("../lib/logger");
const eventsRouter = (0, express_1.Router)();
// ============================================
// Validation Schema
// ============================================
const eventSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid().optional(),
    actorType: zod_1.z.enum(["client", "cleaner", "admin", "system"]).optional(),
    actorId: zod_1.z.string().uuid().optional().nullable(),
    eventType: zod_1.z.string().min(1),
    payload: zod_1.z.record(zod_1.z.unknown()).optional(),
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
eventsRouter.post("/n8n/events", auth_1.verifyN8nSignature, async (req, res) => {
    try {
        const parsed = eventSchema.parse(req.body);
        await (0, events_1.publishEvent)({
            jobId: parsed.jobId,
            actorType: parsed.actorType,
            actorId: parsed.actorId,
            eventName: parsed.eventType,
            payload: parsed.payload,
        });
        logger_1.logger.info("n8n_event_received", {
            eventType: parsed.eventType,
            jobId: parsed.jobId,
        });
        res.status(204).send();
    }
    catch (err) {
        const error = err;
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid event body", details: error.issues },
            });
        }
        logger_1.logger.error("n8n_event_failed", { error: error.message });
        res.status(500).json({
            error: { code: "EVENT_FAILED", message: error.message },
        });
    }
});
/**
 * POST /events
 * Alternative endpoint without /n8n prefix
 * Also protected by HMAC signature verification
 */
eventsRouter.post("/events", auth_1.verifyN8nSignature, async (req, res) => {
    try {
        const parsed = eventSchema.parse(req.body);
        await (0, events_1.publishEvent)({
            jobId: parsed.jobId,
            actorType: parsed.actorType,
            actorId: parsed.actorId,
            eventName: parsed.eventType,
            payload: parsed.payload,
        });
        res.status(204).send();
    }
    catch (err) {
        const error = err;
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid event body" },
            });
        }
        res.status(500).json({
            error: { code: "EVENT_FAILED", message: error.message },
        });
    }
});
exports.default = eventsRouter;
