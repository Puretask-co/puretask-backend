"use strict";
// src/routes/assignment.ts
// Assignment engine endpoints (wave-based, voluntary accept)
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const jobsService_1 = require("../services/jobsService");
const jobMatchingService_1 = require("../services/jobMatchingService");
const assignmentRouter = (0, express_1.Router)();
assignmentRouter.use(auth_1.authMiddleware);
/**
 * GET /assignment/:jobId/wave
 * Query wave-based eligible cleaners (long-wave model)
 * Query params: wave (default 1), limit (default 20)
 */
assignmentRouter.get("/:jobId/wave", async (req, res) => {
    try {
        const { jobId } = req.params;
        const wave = req.query.wave ? Number(req.query.wave) : 1;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const job = await (0, jobsService_1.getJob)(jobId);
        if (!job) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
        }
        const cleaners = await (0, jobMatchingService_1.getWaveEligibleCleaners)(job, { wave, limit });
        res.json({ jobId, wave, cleaners });
    }
    catch (err) {
        const error = err;
        res.status(400).json({ error: { code: "ASSIGNMENT_ERROR", message: error.message } });
    }
});
exports.default = assignmentRouter;
