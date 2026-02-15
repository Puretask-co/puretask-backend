// src/routes/admin/jobs.ts
// Section 6 & 11: Durable job dead-letter viewer and manual retry

import { Router, Response } from "express";
import { getDeadJobs, retryDeadJob, countDeadJobs } from "../../services/durableJobService";
import {
  requireAuth,
  requireAdmin,
  AuthedRequest,
  authedHandler,
} from "../../middleware/authCanonical";
import { requireAuditReason } from "../../middleware/requireAuditReason";
import { z } from "zod";
import { validateParams, validateQuery } from "../../lib/validation";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * @swagger
 * /admin/jobs/dead:
 *   get:
 *     summary: List dead-letter jobs (Section 6)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/dead",
  validateQuery(listSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = req.query as unknown as z.infer<typeof listSchema>;
    const limit = parsed?.limit ?? 50;
    const jobs = await getDeadJobs(limit);
    const total = await countDeadJobs();
    res.json({ data: jobs, total });
  })
);

const retrySchema = z.object({ jobId: z.string().uuid() });

/**
 * @swagger
 * /admin/jobs/dead/{jobId}/retry:
 *   post:
 *     summary: Retry a dead job (requires audit reason)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Audit-Reason
 *         required: true
 *         schema:
 *           type: string
 */
router.post(
  "/dead/:jobId/retry",
  requireAuditReason,
  validateParams(retrySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { jobId } = req.params;
    const ok = await retryDeadJob(jobId);
    if (!ok) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Job not found or not in dead state" },
      });
      return;
    }
    res.json({ message: "Job queued for retry", jobId });
  })
);

export default router;
