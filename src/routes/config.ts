// src/routes/config.ts
// Public config endpoints for frontend/n8n (canonical job status, etc.)

import { Router } from "express";
import { JOB_STATUS_CANONICAL } from "../constants/jobStatus";
import { sendSuccess } from "../lib/response";

const router = Router();

/**
 * GET /config/job-status
 * Returns canonical job statuses, events, transitions, and event permissions.
 * No auth required so frontend and n8n can consume the same source of truth.
 */
router.get("/job-status", (_req, res) => {
  sendSuccess(res, JOB_STATUS_CANONICAL);
});

export default router;
