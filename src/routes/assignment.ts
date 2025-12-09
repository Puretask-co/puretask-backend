// src/routes/assignment.ts
// Assignment engine endpoints (wave-based, voluntary accept)

import { Router } from "express";
import { authMiddleware, AuthedRequest } from "../middleware/auth";
import { getJob } from "../services/jobsService";
import { getWaveEligibleCleaners } from "../services/jobMatchingService";

const assignmentRouter = Router();

assignmentRouter.use(authMiddleware);

/**
 * GET /assignment/:jobId/wave
 * Query wave-based eligible cleaners (long-wave model)
 * Query params: wave (default 1), limit (default 20)
 */
assignmentRouter.get("/:jobId/wave", async (req: AuthedRequest, res) => {
  try {
    const { jobId } = req.params;
    const wave = req.query.wave ? Number(req.query.wave) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
    }

    const cleaners = await getWaveEligibleCleaners(job, { wave, limit });
    res.json({ jobId, wave, cleaners });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: { code: "ASSIGNMENT_ERROR", message: error.message } });
  }
});

export default assignmentRouter;

