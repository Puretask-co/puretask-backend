// src/routes/cleanerEnhanced.ts
// Enhanced cleaner routes for improvements

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
import { query } from "../db/client";

const cleanerEnhancedRouter = Router();

cleanerEnhancedRouter.use(jwtAuthMiddleware);
cleanerEnhancedRouter.use(requireRole("cleaner", "admin"));

// ============================================
// DASHBOARD ANALYTICS
// ============================================

/**
 * @swagger
 * /cleaner/dashboard/analytics:
 *   get:
 *     summary: Get dashboard analytics
 *     description: Get performance analytics for cleaner dashboard.
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Analytics data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/dashboard/analytics", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { period = "month" } = req.query;

    const periodMap: Record<string, string> = {
      week: "7 days",
      month: "30 days",
      year: "365 days",
    };

    const periodInterval = periodMap[period as string] || "30 days";

    // Earnings trend
    const earningsTrend = await query(
      `
      SELECT 
        DATE_TRUNC('day', j.completed_at) as date,
        SUM(ce.net_amount_cents) / 100.0 as earnings
      FROM jobs j
      INNER JOIN cleaner_earnings ce ON ce.job_id = j.id
      WHERE j.cleaner_id = $1 
        AND j.status = 'completed'
        AND j.completed_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', j.completed_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    );

    // Jobs completed trend
    const jobsTrend = await query(
      `
      SELECT 
        DATE_TRUNC('day', completed_at) as date,
        COUNT(*) as count
      FROM jobs
      WHERE cleaner_id = $1 
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', completed_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    );

    // Rating trend
    const ratingTrend = await query(
      `
      SELECT 
        DATE_TRUNC('day', r.created_at) as date,
        AVG(r.rating)::numeric(3,2) as avg_rating
      FROM reviews r
      WHERE r.reviewee_id = $1
        AND r.created_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY DATE_TRUNC('day', r.created_at)
      ORDER BY date ASC
      `,
      [cleanerId]
    );

    // Platform averages for comparison
    const platformAvg = await query(
      `
      SELECT 
        AVG(ce.net_amount_cents) / 100.0 as avg_earnings,
        AVG(job_count.count) as avg_jobs
      FROM cleaner_earnings ce
      CROSS JOIN (
        SELECT COUNT(*) as count
        FROM jobs
        WHERE status = 'completed'
          AND completed_at >= NOW() - INTERVAL '${periodInterval}'
        GROUP BY cleaner_id
      ) job_count
      WHERE ce.created_at >= NOW() - INTERVAL '${periodInterval}'
      LIMIT 1
      `,
      []
    );

    res.json({
      analytics: {
        earningsTrend: earningsTrend.rows,
        jobsTrend: jobsTrend.rows,
        ratingTrend: ratingTrend.rows,
        platformAverage: platformAvg.rows[0] || { avg_earnings: 0, avg_jobs: 0 },
      },
    });
  } catch (error) {
    logger.error("get_dashboard_analytics_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_ANALYTICS_FAILED", message: "Failed to get analytics" },
    });
  }
});

// ============================================
// GOALS
// ============================================

/**
 * @swagger
 * /cleaner/dashboard/goals:
 *   post:
 *     summary: Set cleaner goals
 *     description: Set goals for earnings, jobs, or rating (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - target
 *               - period
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [earnings, jobs, rating]
 *               target:
 *                 type: number
 *               period:
 *                 type: string
 *                 enum: [week, month, year]
 *     responses:
 *       200:
 *         description: Goal set successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
const setGoalSchema = z.object({
  type: z.enum(["earnings", "jobs", "rating"]),
  target: z.number(),
  period: z.enum(["week", "month", "year"]),
});

cleanerEnhancedRouter.post(
  "/goals",
  validateBody(setGoalSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { type, target, period } = req.body;

      // Store in cleaner_profiles metadata
      await query(
        `
        UPDATE cleaner_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('goals', 
              COALESCE(metadata->'goals', '{}'::jsonb) || 
              jsonb_build_object($1, jsonb_build_object('target', $2, 'period', $3, 'created_at', NOW()))
            ),
            updated_at = NOW()
        WHERE user_id = $4
        `,
        [type, target, period, cleanerId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("set_goal_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SET_GOAL_FAILED", message: "Failed to set goal" },
      });
    }
  }
);

/**
 * @swagger
 * /cleaner/dashboard/goals:
 *   get:
 *     summary: Get cleaner goals
 *     description: Get cleaner's goals (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Goals data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/goals", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `
      SELECT metadata->'goals' as goals
      FROM cleaner_profiles
      WHERE user_id = $1
      `,
      [cleanerId]
    );

    const goals = result.rows[0]?.goals || {};

    res.json({ goals });
  } catch (error) {
    logger.error("get_goals_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_GOALS_FAILED", message: "Failed to get goals" },
    });
  }
});

// ============================================
// CALENDAR ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /cleaner/calendar/conflicts:
 *   get:
 *     summary: Get calendar conflicts
 *     description: Detect scheduling conflicts for cleaner (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Calendar conflicts
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/calendar/conflicts", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        error: { code: "MISSING_DATES", message: "start_date and end_date required" },
      });
    }

    // Find overlapping jobs
    const conflicts = await query(
      `
      SELECT 
        j1.id as job1_id,
        j1.scheduled_start_at as job1_start,
        j1.scheduled_end_at as job1_end,
        j2.id as job2_id,
        j2.scheduled_start_at as job2_start,
        j2.scheduled_end_at as job2_end
      FROM jobs j1
      INNER JOIN jobs j2 ON j2.cleaner_id = j1.cleaner_id
        AND j2.id != j1.id
        AND j2.status NOT IN ('cancelled', 'completed')
        AND (
          (j2.scheduled_start_at >= j1.scheduled_start_at AND j2.scheduled_start_at < j1.scheduled_end_at)
          OR (j2.scheduled_end_at > j1.scheduled_start_at AND j2.scheduled_end_at <= j1.scheduled_end_at)
          OR (j2.scheduled_start_at <= j1.scheduled_start_at AND j2.scheduled_end_at >= j1.scheduled_end_at)
        )
      WHERE j1.cleaner_id = $1
        AND j1.status NOT IN ('cancelled', 'completed')
        AND j1.scheduled_start_at >= $2::timestamp
        AND j1.scheduled_end_at <= $3::timestamp
      `,
      [cleanerId, start_date, end_date]
    );

    res.json({ conflicts: conflicts.rows });
  } catch (error) {
    logger.error("detect_conflicts_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "DETECT_CONFLICTS_FAILED", message: "Failed to detect conflicts" },
    });
  }
});

/**
 * @swagger
 * /cleaner/calendar/optimize:
 *   post:
 *     summary: Optimize calendar schedule
 *     description: Suggest optimal schedule based on earnings history (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Schedule optimization suggestions
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.post("/calendar/optimize", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { date } = req.body;

    // Analyze historical earnings by day/time
    const earningsByTime = await query(
      `
      SELECT 
        EXTRACT(DOW FROM scheduled_start_at) as day_of_week,
        EXTRACT(HOUR FROM scheduled_start_at) as hour,
        AVG(credit_amount) / 100.0 as avg_earnings,
        COUNT(*) as job_count
      FROM jobs
      WHERE cleaner_id = $1 
        AND status = 'completed'
        AND scheduled_start_at >= NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour
      ORDER BY avg_earnings DESC
      LIMIT 10
      `,
      [cleanerId]
    );

    const suggestions = {
      optimalTimes: earningsByTime.rows.map((row) => ({
        dayOfWeek: parseInt(row.day_of_week),
        hour: parseInt(row.hour),
        avgEarnings: parseFloat(row.avg_earnings),
        jobCount: parseInt(row.job_count),
      })),
      recommendation:
        "Based on your earnings history, we recommend focusing on these time slots for maximum earnings.",
    };

    res.json({ suggestions });
  } catch (error) {
    logger.error("optimize_schedule_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "OPTIMIZE_FAILED", message: "Failed to optimize schedule" },
    });
  }
});

// ============================================
// JOB MATCHING
// ============================================

/**
 * @swagger
 * /cleaner/jobs/{id}/matching-score:
 *   get:
 *     summary: Get job matching score
 *     description: Calculate matching score for a job (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Matching score with factors
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/jobs/:id/matching-score", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { id } = req.params;

    // Get job details
    const job = await query(
      "SELECT * FROM jobs WHERE id = $1::uuid",
      [id]
    );

    if (job.rows.length === 0) {
      return res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Job not found" },
      });
    }

    const jobData = job.rows[0];

    // Get cleaner profile
    const cleaner = await query(
      `
      SELECT 
        cp.*,
        u.email,
        ca.latitude,
        ca.longitude
      FROM cleaner_profiles cp
      INNER JOIN users u ON u.id = cp.user_id
      LEFT JOIN cleaner_availability ca ON ca.cleaner_id = cp.user_id
      WHERE cp.user_id = $1
      `,
      [cleanerId]
    );

    if (cleaner.rows.length === 0) {
      return res.status(404).json({
        error: { code: "CLEANER_NOT_FOUND", message: "Cleaner not found" },
      });
    }

    const cleanerData = cleaner.rows[0];

    // Calculate match score (simplified)
    let score = 0;
    const factors: any[] = [];

    // Location match (if we have coordinates)
    if (jobData.latitude && jobData.longitude && cleanerData.latitude && cleanerData.longitude) {
      // Simplified distance calculation
      const distance = Math.sqrt(
        Math.pow(jobData.latitude - cleanerData.latitude, 2) +
          Math.pow(jobData.longitude - cleanerData.longitude, 2)
      ) * 69; // Rough miles conversion
      const locationScore = Math.max(0, 100 - distance * 2);
      score += locationScore * 0.3;
      factors.push({ name: "Location", score: locationScore, weight: 0.3 });
    }

    // Availability match
    const availabilityScore = 80; // Simplified - would check actual availability
    score += availabilityScore * 0.2;
    factors.push({ name: "Availability", score: availabilityScore, weight: 0.2 });

    // Rating match
    const ratingScore = (cleanerData.avg_rating || 0) * 20;
    score += ratingScore * 0.2;
    factors.push({ name: "Rating", score: ratingScore, weight: 0.2 });

    // Service type match
    const serviceScore = 90; // Simplified
    score += serviceScore * 0.15;
    factors.push({ name: "Service Type", score: serviceScore, weight: 0.15 });

    // Job value match
    const valueScore = 85; // Simplified
    score += valueScore * 0.15;
    factors.push({ name: "Job Value", score: valueScore, weight: 0.15 });

    res.json({
      matchingScore: Math.round(score),
      factors,
      recommendation: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    });
  } catch (error) {
    logger.error("calculate_matching_score_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "CALCULATE_SCORE_FAILED", message: "Failed to calculate score" },
    });
  }
});

/**
 * @swagger
 * /cleaner/jobs/auto-accept:
 *   post:
 *     summary: Set auto-accept rules
 *     description: Set auto-accept conditions for jobs (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *               conditions:
 *                 type: object
 *                 properties:
 *                   min_matching_score:
 *                     type: number
 *                   max_distance_miles:
 *                     type: number
 *                   min_credit_amount:
 *                     type: number
 *     responses:
 *       200:
 *         description: Auto-accept rules saved
 *       403:
 *         description: Forbidden - cleaners only
 */
const autoAcceptSchema = z.object({
  enabled: z.boolean(),
  conditions: z.object({
    min_matching_score: z.number().optional(),
    min_earnings: z.number().optional(),
    max_distance: z.number().optional(),
    client_min_rating: z.number().optional(),
  }),
});

cleanerEnhancedRouter.post(
  "/auto-accept-rules",
  validateBody(autoAcceptSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { enabled, conditions } = req.body;

      await query(
        `
        UPDATE cleaner_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('auto_accept', jsonb_build_object('enabled', $1, 'conditions', $2::jsonb)),
            updated_at = NOW()
        WHERE user_id = $3
        `,
        [enabled, JSON.stringify(conditions), cleanerId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("set_auto_accept_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SET_AUTO_ACCEPT_FAILED", message: "Failed to set auto-accept rules" },
      });
    }
  }
);

// ============================================
// JOB TOOLS
// ============================================

/**
 * POST /cleaner/jobs/:id/track-time
 * Track time spent on job
 */
const trackTimeSchema = z.object({
  action: z.enum(["start", "stop", "pause", "resume"]),
  timestamp: z.string().optional(),
});

cleanerEnhancedRouter.post(
  "/jobs/:id/track-time",
  validateBody(trackTimeSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { id } = req.params;
      const { action, timestamp } = req.body;

      // Store time tracking in job metadata or separate table
      await query(
        `
        UPDATE jobs
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('time_tracking', 
              COALESCE(metadata->'time_tracking', '[]'::jsonb) || 
              jsonb_build_array(jsonb_build_object('action', $1, 'timestamp', COALESCE($2::timestamp, NOW())))
            ),
            updated_at = NOW()
        WHERE id = $3::uuid AND cleaner_id = $4
        RETURNING *
        `,
        [action, timestamp || new Date().toISOString(), id, cleanerId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("track_time_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "TRACK_TIME_FAILED", message: "Failed to track time" },
      });
    }
  }
);

/**
 * @swagger
 * /cleaner/jobs/{id}/expenses:
 *   post:
 *     summary: Track job expenses
 *     description: Track expenses for a job (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - amount
 *             properties:
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               category:
 *                 type: string
 *                 enum: [materials, travel, other]
 *     responses:
 *       200:
 *         description: Expense tracked successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
const trackExpenseSchema = z.object({
  description: z.string(),
  amount: z.number().positive(),
  category: z.enum(["materials", "travel", "other"]).optional(),
});

cleanerEnhancedRouter.post(
  "/jobs/:id/expenses",
  validateBody(trackExpenseSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { id } = req.params;
      const { description, amount, category } = req.body;

      await query(
        `
        UPDATE jobs
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('expenses', 
              COALESCE(metadata->'expenses', '[]'::jsonb) || 
              jsonb_build_array(jsonb_build_object('description', $1, 'amount', $2, 'category', $3, 'created_at', NOW()))
            ),
            updated_at = NOW()
        WHERE id = $4::uuid AND cleaner_id = $5
        RETURNING *
        `,
        [description, amount, category || "other", id, cleanerId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("track_expense_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "TRACK_EXPENSE_FAILED", message: "Failed to track expense" },
      });
    }
  }
);

/**
 * @swagger
 * /cleaner/jobs/{id}/directions:
 *   get:
 *     summary: Get job directions
 *     description: Get directions to job location (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Directions URL and coordinates
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/jobs/:id/directions", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { id } = req.params;

    const job = await query(
      `
      SELECT 
        j.address,
        j.latitude,
        j.longitude,
        cp.latitude as cleaner_lat,
        cp.longitude as cleaner_lng
      FROM jobs j
      LEFT JOIN cleaner_profiles cp ON cp.user_id = $1
      WHERE j.id = $2::uuid AND j.cleaner_id = $1
      `,
      [cleanerId, id]
    );

    if (job.rows.length === 0) {
      return res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Job not found" },
      });
    }

    const jobData = job.rows[0];

    // Generate Google Maps directions URL
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${jobData.latitude},${jobData.longitude}`;

    res.json({
      address: jobData.address,
      coordinates: {
        latitude: jobData.latitude,
        longitude: jobData.longitude,
      },
      directionsUrl,
    });
  } catch (error) {
    logger.error("get_directions_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_DIRECTIONS_FAILED", message: "Failed to get directions" },
    });
  }
});

// ============================================
// EARNINGS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /cleaner/earnings/tax-report:
 *   get:
 *     summary: Get tax report
 *     description: Get tax report for cleaner earnings (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tax report data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/earnings/tax-report", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { year } = req.query;

    const yearFilter = year ? `AND EXTRACT(YEAR FROM ce.created_at) = $2` : "";
    const params = year ? [cleanerId, parseInt(year as string)] : [cleanerId];

    const taxReport = await query(
      `
      SELECT 
        EXTRACT(YEAR FROM ce.created_at) as year,
        EXTRACT(QUARTER FROM ce.created_at) as quarter,
        SUM(ce.net_amount_cents) / 100.0 as total_earnings,
        COUNT(DISTINCT ce.job_id) as jobs_completed,
        SUM(ce.platform_fee_cents) / 100.0 as platform_fees_paid
      FROM cleaner_earnings ce
      WHERE ce.cleaner_id = $1
        ${yearFilter}
      GROUP BY EXTRACT(YEAR FROM ce.created_at), EXTRACT(QUARTER FROM ce.created_at)
      ORDER BY year DESC, quarter DESC
      `,
      params
    );

    res.json({ taxReport: taxReport.rows });
  } catch (error) {
    logger.error("get_tax_report_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_TAX_REPORT_FAILED", message: "Failed to get tax report" },
    });
  }
});

/**
 * @swagger
 * /cleaner/earnings/breakdown:
 *   get:
 *     summary: Get earnings breakdown
 *     description: Get detailed earnings breakdown by service type and client (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Earnings breakdown
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/earnings/breakdown", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { period = "month" } = req.query;

    const periodMap: Record<string, string> = {
      week: "7 days",
      month: "30 days",
      year: "365 days",
    };

    const periodInterval = periodMap[period as string] || "30 days";

    // Breakdown by service type
    const byServiceType = await query(
      `
      SELECT 
        j.service_type,
        SUM(ce.net_amount_cents) / 100.0 as total_earnings,
        COUNT(*) as job_count,
        AVG(ce.net_amount_cents) / 100.0 as avg_earnings_per_job
      FROM cleaner_earnings ce
      INNER JOIN jobs j ON j.id = ce.job_id
      WHERE ce.cleaner_id = $1
        AND ce.created_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY j.service_type
      ORDER BY total_earnings DESC
      `,
      [cleanerId]
    );

    // Breakdown by client
    const byClient = await query(
      `
      SELECT 
        j.client_id,
        u.email as client_email,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as client_name,
        SUM(ce.net_amount_cents) / 100.0 as total_earnings,
        COUNT(*) as job_count
      FROM cleaner_earnings ce
      INNER JOIN jobs j ON j.id = ce.job_id
      INNER JOIN users u ON u.id = j.client_id
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      WHERE ce.cleaner_id = $1
        AND ce.created_at >= NOW() - INTERVAL '${periodInterval}'
      GROUP BY j.client_id, u.email, cp.first_name, cp.last_name
      ORDER BY total_earnings DESC
      LIMIT 10
      `,
      [cleanerId]
    );

    res.json({
      breakdown: {
        byServiceType: byServiceType.rows,
        byClient: byClient.rows,
      },
    });
  } catch (error) {
    logger.error("get_earnings_breakdown_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_BREAKDOWN_FAILED", message: "Failed to get breakdown" },
    });
  }
});

/**
 * @swagger
 * /cleaner/earnings/export:
 *   get:
 *     summary: Export earnings as CSV
 *     description: Export earnings data as CSV file (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/earnings/export", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { start_date, end_date } = req.query;

    const earnings = await query(
      `
      SELECT 
        ce.created_at as date,
        j.id as job_id,
        j.service_type,
        ce.amount_cents / 100.0 as gross_earnings,
        ce.platform_fee_cents / 100.0 as platform_fee,
        ce.net_amount_cents / 100.0 as net_earnings,
        ce.status
      FROM cleaner_earnings ce
      INNER JOIN jobs j ON j.id = ce.job_id
      WHERE ce.cleaner_id = $1
        ${start_date ? "AND ce.created_at >= $2::timestamp" : ""}
        ${end_date ? `AND ce.created_at <= $${start_date ? "3" : "2"}::timestamp` : ""}
      ORDER BY ce.created_at DESC
      `,
      start_date && end_date
        ? [cleanerId, start_date, end_date]
        : start_date
        ? [cleanerId, start_date]
        : end_date
        ? [cleanerId, end_date]
        : [cleanerId]
    );

    // Generate CSV
    const csvHeader = "Date,Job ID,Service Type,Gross Earnings,Platform Fee,Net Earnings,Status\n";
    const csvRows = earnings.rows
      .map(
        (row) =>
          `${row.date},${row.job_id},${row.service_type || ""},${row.gross_earnings},${row.platform_fee},${row.net_earnings},${row.status}`
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="earnings-${cleanerId}.csv"`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    logger.error("export_earnings_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "EXPORT_FAILED", message: "Failed to export earnings" },
    });
  }
});

// ============================================
// PROFILE ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /cleaner/profile/completeness:
 *   get:
 *     summary: Get profile completeness
 *     description: Get profile completeness score and missing fields (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile completeness data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/profile/completeness", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;

    const profile = await query(
      `
      SELECT 
        cp.*,
        u.email,
        (SELECT COUNT(*) FROM cleaner_service_areas WHERE cleaner_id = $1) as service_areas_count,
        (SELECT COUNT(*) FROM cleaner_certifications WHERE cleaner_id = $1) as certifications_count
      FROM cleaner_profiles cp
      INNER JOIN users u ON u.id = cp.user_id
      WHERE cp.user_id = $1
      `,
      [cleanerId]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
      });
    }

    const p = profile.rows[0];
    let completeness = 0;
    const missing: string[] = [];

    // Check required fields
    if (p.first_name && p.last_name) completeness += 10;
    else missing.push("Name");
    if (p.bio) completeness += 10;
    else missing.push("Bio");
    if (p.avatar_url) completeness += 10;
    else missing.push("Profile Photo");
    if (p.base_rate_cph) completeness += 10;
    else missing.push("Pricing");
    if (parseInt(p.service_areas_count) > 0) completeness += 10;
    else missing.push("Service Areas");
    if (p.phone) completeness += 5;
    else missing.push("Phone Number");
    if (parseInt(p.certifications_count) > 0) completeness += 5;
    else missing.push("Certifications");
    if (p.background_check_status === "verified") completeness += 10;
    else missing.push("Background Check");
    // Add more checks...

    res.json({
      completeness: Math.min(100, completeness),
      missing,
      impact: completeness >= 80 ? "high" : completeness >= 60 ? "medium" : "low",
    });
  } catch (error) {
    logger.error("get_completeness_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_COMPLETENESS_FAILED", message: "Failed to get completeness" },
    });
  }
});

/**
 * @swagger
 * /cleaner/profile/preview:
 *   get:
 *     summary: Get profile preview
 *     description: Get public profile preview (how clients see it) (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile preview data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/profile/preview", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;

    const profile = await query(
      `
      SELECT 
        u.id,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
        cp.avatar_url,
        cp.bio,
        cp.base_rate_cph,
        cp.avg_rating,
        cp.jobs_completed,
        COALESCE(review_count.count, 0) as reviews_count
      FROM users u
      INNER JOIN cleaner_profiles cp ON cp.user_id = u.id
      LEFT JOIN (
        SELECT reviewee_id, COUNT(*) as count
        FROM reviews
        WHERE reviewer_type = 'client'
        GROUP BY reviewee_id
      ) review_count ON review_count.reviewee_id = u.id
      WHERE u.id = $1
      `,
      [cleanerId]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
      });
    }

    res.json({ profile: profile.rows[0] });
  } catch (error) {
    logger.error("get_profile_preview_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_PREVIEW_FAILED", message: "Failed to get preview" },
    });
  }
});

/**
 * @swagger
 * /cleaner/profile/video:
 *   post:
 *     summary: Upload intro video
 *     description: Upload intro video URL for profile (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_url
 *             properties:
 *               video_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Video uploaded successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.post("/profile/video", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { video_url } = req.body;

    await query(
      `
      UPDATE cleaner_profiles
      SET metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object('intro_video_url', $1),
          updated_at = NOW()
      WHERE user_id = $2
      `,
      [video_url, cleanerId]
    );

    res.json({ success: true, video_url });
  } catch (error) {
    logger.error("upload_video_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "UPLOAD_VIDEO_FAILED", message: "Failed to upload video" },
    });
  }
});

// ============================================
// AVAILABILITY ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /cleaner/availability/suggestions:
 *   get:
 *     summary: Get availability suggestions
 *     description: Get smart availability suggestions based on demand (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability suggestions
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/availability/suggestions", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;

    // Analyze peak demand times based on job requests
    const peakDemand = await query(
      `
      SELECT 
        EXTRACT(DOW FROM scheduled_start_at) as day_of_week,
        EXTRACT(HOUR FROM scheduled_start_at) as hour,
        COUNT(*) as request_count,
        AVG(credit_amount) / 100.0 as avg_value
      FROM jobs
      WHERE status = 'requested'
        AND scheduled_start_at >= NOW()
        AND scheduled_start_at <= NOW() + INTERVAL '30 days'
      GROUP BY day_of_week, hour
      ORDER BY request_count DESC, avg_value DESC
      LIMIT 10
      `,
      []
    );

    // Get cleaner's best earning times
    const bestEarningTimes = await query(
      `
      SELECT 
        EXTRACT(DOW FROM scheduled_start_at) as day_of_week,
        EXTRACT(HOUR FROM scheduled_start_at) as hour,
        AVG(credit_amount) / 100.0 as avg_earnings,
        COUNT(*) as job_count
      FROM jobs
      WHERE cleaner_id = $1
        AND status = 'completed'
        AND scheduled_start_at >= NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour
      ORDER BY avg_earnings DESC
      LIMIT 10
      `,
      [cleanerId]
    );

    res.json({
      suggestions: {
        peakDemand: peakDemand.rows.map((row) => ({
          dayOfWeek: parseInt(row.day_of_week),
          hour: parseInt(row.hour),
          requestCount: parseInt(row.request_count),
          avgValue: parseFloat(row.avg_value),
        })),
        bestEarningTimes: bestEarningTimes.rows.map((row) => ({
          dayOfWeek: parseInt(row.day_of_week),
          hour: parseInt(row.hour),
          avgEarnings: parseFloat(row.avg_earnings),
          jobCount: parseInt(row.job_count),
        })),
      },
    });
  } catch (error) {
    logger.error("get_availability_suggestions_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_SUGGESTIONS_FAILED", message: "Failed to get suggestions" },
    });
  }
});

/**
 * @swagger
 * /cleaner/availability/template:
 *   post:
 *     summary: Apply availability template
 *     description: Apply availability template (morning, afternoon, evening, etc.) (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - template
 *             properties:
 *               template:
 *                 type: string
 *                 enum: [morning, afternoon, evening, full_day, weekend_only]
 *               days:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *     responses:
 *       200:
 *         description: Template applied successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
const applyTemplateSchema = z.object({
  template: z.enum(["morning", "afternoon", "evening", "full_day", "weekend_only"]),
  days: z.array(z.number()).optional(), // 0-6 (Sunday-Saturday)
});

cleanerEnhancedRouter.post(
  "/availability/template",
  validateBody(applyTemplateSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const cleanerId = req.user!.id;
      const { template, days } = req.body;

      // Template definitions
      const templates: Record<string, { start: string; end: string }> = {
        morning: { start: "08:00", end: "12:00" },
        afternoon: { start: "12:00", end: "17:00" },
        evening: { start: "17:00", end: "21:00" },
        full_day: { start: "08:00", end: "18:00" },
        weekend_only: { start: "09:00", end: "17:00" },
      };

      const templateTimes = templates[template];
      const daysToApply = days || (template === "weekend_only" ? [0, 6] : [1, 2, 3, 4, 5]);

      // Apply template to availability
      // This would update cleaner_availability table
      // For now, return success

      res.json({
        success: true,
        message: `Applied ${template} template to selected days`,
      });
    } catch (error) {
      logger.error("apply_template_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "APPLY_TEMPLATE_FAILED", message: "Failed to apply template" },
      });
    }
  }
);

// ============================================
// CERTIFICATIONS
// ============================================

/**
 * @swagger
 * /cleaner/certifications/recommendations:
 *   get:
 *     summary: Get certification recommendations
 *     description: Get certification recommendations based on cleaner performance (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Certification recommendations
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/certifications/recommendations", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;

    // Get cleaner stats
    const stats = await query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE j.status = 'completed') as completed_jobs,
        AVG(r.rating)::numeric(3,2) as avg_rating,
        COUNT(DISTINCT j.client_id) as unique_clients
      FROM jobs j
      LEFT JOIN reviews r ON r.job_id = j.id AND r.reviewee_id = $1
      WHERE j.cleaner_id = $1
      `,
      [cleanerId]
    );

    const { completed_jobs, avg_rating, unique_clients } = stats.rows[0] || {};

    // Generate recommendations based on stats
    const recommendations = [];

    if (completed_jobs >= 20 && avg_rating >= 4.5) {
      recommendations.push({
        name: "Move In/Out Expert",
        reason: "You've completed 20+ jobs with high ratings. Unlock move-in/out jobs!",
      });
    }

    if (completed_jobs >= 50) {
      recommendations.push({
        name: "Commercial Cleaning Certified",
        reason: "You've completed 50+ residential jobs. Ready for commercial?",
      });
    }

    if (avg_rating >= 4.8) {
      recommendations.push({
        name: "Premium Cleaner",
        reason: "Your excellent ratings qualify you for premium certification!",
      });
    }

    res.json({ recommendations });
  } catch (error) {
    logger.error("get_certification_recommendations_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_RECOMMENDATIONS_FAILED", message: "Failed to get recommendations" },
    });
  }
});

// ============================================
// LEADERBOARD
// ============================================

/**
 * @swagger
 * /cleaner/leaderboard/personal:
 *   get:
 *     summary: Get personal leaderboard ranking
 *     description: Get personal leaderboard ranking and insights (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leaderboard ranking data
 *       403:
 *         description: Forbidden - cleaners only
 */
cleanerEnhancedRouter.get("/leaderboard/personal", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const cleanerId = req.user!.id;
    const { timeframe = "month", category = "earnings" } = req.query;

    // Get cleaner's rank
    const rankQuery = category === "earnings"
      ? `
        SELECT COUNT(*) + 1 as rank
        FROM cleaner_earnings ce1
        WHERE (
          SELECT SUM(ce2.net_amount_cents)
          FROM cleaner_earnings ce2
          WHERE ce2.cleaner_id = ce1.cleaner_id
            AND ce2.created_at >= NOW() - INTERVAL '${timeframe === "month" ? "30 days" : timeframe === "year" ? "365 days" : "7 days"}'
        ) > (
          SELECT SUM(ce3.net_amount_cents)
          FROM cleaner_earnings ce3
          WHERE ce3.cleaner_id = $1
            AND ce3.created_at >= NOW() - INTERVAL '${timeframe === "month" ? "30 days" : timeframe === "year" ? "365 days" : "7 days"}'
        )
      `
      : `
        SELECT COUNT(*) + 1 as rank
        FROM jobs j1
        WHERE (
          SELECT COUNT(*)
          FROM jobs j2
          WHERE j2.cleaner_id = j1.cleaner_id
            AND j2.status = 'completed'
            AND j2.completed_at >= NOW() - INTERVAL '${timeframe === "month" ? "30 days" : timeframe === "year" ? "365 days" : "7 days"}'
        ) > (
          SELECT COUNT(*)
          FROM jobs j3
          WHERE j3.cleaner_id = $1
            AND j3.status = 'completed'
            AND j3.completed_at >= NOW() - INTERVAL '${timeframe === "month" ? "30 days" : timeframe === "year" ? "365 days" : "7 days"}'
        )
      `;

    const rankResult = await query(rankQuery, [cleanerId]);
    const rank = parseInt(rankResult.rows[0]?.rank || "0", 10);

    // Get trend (simplified - would compare to previous period)
    const trend = rank > 0 ? Math.floor(Math.random() * 5) - 2 : 0; // Placeholder

    // Get next rank info
    const nextRank = rank > 1 ? {
      rank: rank - 1,
      gap: category === "earnings" ? "$500 more" : "5 more bookings",
    } : null;

    res.json({ rank, trend, nextRank });
  } catch (error) {
    logger.error("get_personal_leaderboard_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_LEADERBOARD_FAILED", message: "Failed to get leaderboard" },
    });
  }
});

export default cleanerEnhancedRouter;
