// src/routes/admin/webhooks.ts
// Section 11: Webhook & delivery log viewer (replay-safe)

import { Router, Response } from "express";
import { query } from "../../db/client";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../../middleware/authCanonical";
import { z } from "zod";
import { validateQuery } from "../../lib/validation";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const listSchema = z.object({
  provider: z.enum(["stripe", "n8n"]).optional(),
  status: z.enum(["pending", "processing", "done", "failed"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * @swagger
 * /admin/webhooks/events:
 *   get:
 *     summary: List webhook events (replay-safe viewer)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/events",
  validateQuery(listSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const q = req.query as unknown as z.infer<typeof listSchema>;
    const provider = q?.provider;
    const status = q?.status;
    const limit = q?.limit ?? 50;
    const offset = q?.offset ?? 0;

    let sql = `
      SELECT id, provider, event_id, event_type, received_at, signature_verified,
             processing_status, attempt_count, last_error, processed_at
      FROM webhook_events
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let p = 1;
    if (provider) {
      sql += ` AND provider = $${p++}`;
      params.push(provider);
    }
    if (status) {
      sql += ` AND processing_status = $${p++}`;
      params.push(status);
    }
    sql += ` ORDER BY received_at DESC LIMIT $${p++} OFFSET $${p}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*)::text as count FROM webhook_events WHERE 1=1`;
    const countParams: (string | number)[] = [];
    let cp = 1;
    if (provider) {
      countSql += ` AND provider = $${cp++}`;
      countParams.push(provider);
    }
    if (status) {
      countSql += ` AND processing_status = $${cp++}`;
      countParams.push(status);
    }
    const countResult = await query<{ count: string }>(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    res.json({
      data: result.rows,
      pagination: { limit, offset, total },
    });
  })
);

/**
 * @swagger
 * /admin/webhooks/events/{id}:
 *   get:
 *     summary: Get webhook event details (no payload replay)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/events/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const result = await query(
      `SELECT id, provider, event_id, event_type, received_at, signature_verified,
              processing_status, attempt_count, last_error, processed_at
       FROM webhook_events WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook event not found" } });
      return;
    }
    res.json(result.rows[0]);
  })
);

export default router;
