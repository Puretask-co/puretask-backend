// src/routes/assignment.ts
// Assignment engine endpoints (wave-based, voluntary accept)

import { Router } from "express";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { requireOwnership } from "../lib/ownership";
import { getJob } from "../services/jobsService";
import { getWaveEligibleCleaners } from "../services/jobMatchingService";

const assignmentRouter = Router();

assignmentRouter.use(requireAuth);

/**
 * @swagger
 * /assignment/{jobId}/wave:
 *   get:
 *     summary: Get wave-based eligible cleaners
 *     description: Query wave-based eligible cleaners for job assignment (long-wave model).
 *     tags: [Assignment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: wave
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Eligible cleaners for wave
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId: { type: 'string' }
 *                 wave: { type: 'integer' }
 *                 cleaners: { type: 'array', items: { type: 'object' } }
 *       404:
 *         description: Job not found
 */
assignmentRouter.get(
  "/:jobId/wave",
  requireOwnership("job", "jobId"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const { jobId } = req.params;
      const wave = req.query.wave ? Number(req.query.wave) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const job = await getJob(jobId);
      if (!job) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
        return;
      }

      const cleaners = await getWaveEligibleCleaners(job, { wave, limit });
      res.json({ jobId, wave, cleaners });
    } catch (err: unknown) {
      const error = err as Error;
      res.status(400).json({ error: { code: "ASSIGNMENT_ERROR", message: error.message } });
    }
  })
);

export default assignmentRouter;
