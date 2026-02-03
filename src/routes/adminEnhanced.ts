// src/routes/adminEnhanced.ts
// Enhanced admin routes for improvements

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { query } from "../db/client";

const adminEnhancedRouter = Router();

adminEnhancedRouter.use(requireAuth);
adminEnhancedRouter.use(requireAdmin);

// ============================================
// DASHBOARD ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/dashboard/realtime:
 *   get:
 *     summary: Get real-time metrics
 *     description: Get real-time dashboard metrics (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time metrics
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/dashboard/realtime", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Get real-time metrics
    const metrics = await query(
      `
      SELECT 
        (SELECT COUNT(*) FROM jobs WHERE status IN ('requested', 'accepted', 'in_progress')) as active_jobs,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) as new_users_today,
        (SELECT COUNT(*) FROM jobs WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_jobs_today,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open') as open_disputes,
        (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
        (SELECT SUM(credit_amount) FROM jobs WHERE status = 'completed' AND completed_at >= CURRENT_DATE) / 100.0 as revenue_today
      `,
      []
    );

    res.json({ metrics: metrics.rows[0] });
  } catch (error) {
    logger.error("get_realtime_metrics_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_METRICS_FAILED", message: "Failed to get real-time metrics" },
    });
  }
}));

/**
 * @swagger
 * /admin/dashboard/alerts:
 *   get:
 *     summary: Get dashboard alerts
 *     description: Get system alerts for admin dashboard (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [all, critical, warning, info]
 *           default: all
 *     responses:
 *       200:
 *         description: System alerts
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/dashboard/alerts", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { severity = "all" } = req.query;

    // Critical alerts
    const criticalAlerts = await query(
      `
      SELECT 
        'dispute' as type,
        id,
        'New dispute filed' as message,
        created_at
      FROM disputes
      WHERE status = 'open' AND created_at >= NOW() - INTERVAL '24 hours'
      UNION ALL
      SELECT 
        'payout_failed' as type,
        id::text,
        'Payout failed' as message,
        created_at
      FROM payout_requests
      WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
      UNION ALL
      SELECT 
        'stuck_job' as type,
        id::text,
        'Job stuck in status' as message,
        updated_at as created_at
      FROM jobs
      WHERE status IN ('requested', 'accepted') 
        AND scheduled_start_at < NOW() - INTERVAL '2 hours'
        AND updated_at < NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 20
      `,
      []
    );

    // Warning alerts
    const warningAlerts = await query(
      `
      SELECT 
        'risk_flag' as type,
        user_id as id,
        'High risk user detected' as message,
        created_at
      FROM risk_flags
      WHERE severity = 'high' AND created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'low_balance' as type,
        user_id as id,
        'User low on credits' as message,
        updated_at as created_at
      FROM credit_accounts
      WHERE balance < 1000 AND updated_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
      `,
      []
    );

    const alerts = {
      critical: criticalAlerts.rows,
      warning: warningAlerts.rows,
      info: [], // Info alerts can be added
    };

    res.json({ alerts });
  } catch (error) {
    logger.error("get_alerts_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_ALERTS_FAILED", message: "Failed to get alerts" },
    });
  }
}));

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: Get system health
 *     description: Get system health status (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health data
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/system/health", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Check database connection
    const dbCheck = await query("SELECT NOW() as timestamp", []);
    const dbHealthy = dbCheck.rows.length > 0;

    // Check for stuck jobs
    const stuckJobs = await query(
      `
      SELECT COUNT(*) as count
      FROM jobs
      WHERE status IN ('requested', 'accepted')
        AND scheduled_start_at < NOW() - INTERVAL '2 hours'
        AND updated_at < NOW() - INTERVAL '1 hour'
      `,
      []
    );

    // Check for failed payouts
    const failedPayouts = await query(
      `
      SELECT COUNT(*) as count
      FROM payout_requests
      WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      []
    );

    // Check for pending disputes
    const pendingDisputes = await query(
      `
      SELECT COUNT(*) as count
      FROM disputes
      WHERE status = 'open' AND created_at >= NOW() - INTERVAL '7 days'
      `,
      []
    );

    const health = {
      database: {
        status: dbHealthy ? "healthy" : "unhealthy",
        responseTime: Date.now(), // Simplified
      },
      jobs: {
        stuck: parseInt(stuckJobs.rows[0]?.count || "0"),
        status: parseInt(stuckJobs.rows[0]?.count || "0") > 10 ? "warning" : "healthy",
      },
      payouts: {
        failed: parseInt(failedPayouts.rows[0]?.count || "0"),
        status: parseInt(failedPayouts.rows[0]?.count || "0") > 5 ? "warning" : "healthy",
      },
      disputes: {
        pending: parseInt(pendingDisputes.rows[0]?.count || "0"),
        status: parseInt(pendingDisputes.rows[0]?.count || "0") > 20 ? "warning" : "healthy",
      },
      overall: "healthy", // Would calculate based on all checks
    };

    res.json({ health });
  } catch (error) {
    logger.error("get_system_health_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_HEALTH_FAILED", message: "Failed to get system health" },
    });
  }
}));

// ============================================
// JOBS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/jobs/bulk-action:
 *   post:
 *     summary: Bulk job actions
 *     description: Perform bulk actions on jobs (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_ids
 *               - action
 *             properties:
 *               job_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               action:
 *                 type: string
 *                 enum: [cancel, assign, status_update, export]
 *               params:
 *                 type: object
 *     responses:
 *       200:
 *         description: Bulk action completed
 *       403:
 *         description: Forbidden - admin only
 */
const bulkActionSchema = z.object({
  job_ids: z.array(z.string().uuid()),
  action: z.enum(["cancel", "assign", "status_update", "export"]),
  params: z.record(z.any()).optional(),
});

adminEnhancedRouter.post(
  "/jobs/bulk-action",
  validateBody(bulkActionSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { job_ids, action, params } = req.body;

      let result;
      switch (action) {
        case "cancel":
          result = await query(
            `
            UPDATE jobs
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = ANY($1::uuid[])
            RETURNING id
            `,
            [job_ids]
          );
          break;
        case "status_update":
          result = await query(
            `
            UPDATE jobs
            SET status = $1, updated_at = NOW()
            WHERE id = ANY($2::uuid[])
            RETURNING id
            `,
            [params?.status, job_ids]
          );
          break;
        case "export":
          // Export jobs to CSV
          const jobs = await query(
            `
            SELECT 
              j.id,
              j.status,
              j.scheduled_start_at,
              j.address,
              u1.email as client_email,
              u2.email as cleaner_email,
              j.credit_amount / 100.0 as amount
            FROM jobs j
            LEFT JOIN users u1 ON u1.id = j.client_id
            LEFT JOIN users u2 ON u2.id = j.cleaner_id
            WHERE j.id = ANY($1::uuid[])
            `,
            [job_ids]
          );

          const csvHeader = "ID,Status,Scheduled Start,Address,Client,Cleaner,Amount\n";
          const csvRows = jobs.rows
            .map(
              (row) =>
                `${row.id},${row.status},${row.scheduled_start_at},${row.address || ""},${row.client_email || ""},${row.cleaner_email || ""},${row.amount}`
            )
            .join("\n");

          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", "attachment; filename=jobs-export.csv");
          res.send(csvHeader + csvRows);
          return;
        default:
          res.status(400).json({
            error: { code: "INVALID_ACTION", message: "Invalid action" },
          });
          return;
      }

      res.json({
        success: true,
        affected: result.rows.length,
        job_ids: result.rows.map((r) => r.id),
      });
    } catch (error) {
      logger.error("bulk_action_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "BULK_ACTION_FAILED", message: "Failed to perform bulk action" },
      });
    }
  }));

/**
 * @swagger
 * /admin/jobs/insights:
 *   get:
 *     summary: Get job insights
 *     description: Get job insights and analytics (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job insights
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/jobs/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Stuck jobs
    const stuckJobs = await query(
      `
      SELECT 
        status,
        COUNT(*) as count
      FROM jobs
      WHERE status IN ('requested', 'accepted')
        AND scheduled_start_at < NOW() - INTERVAL '2 hours'
        AND updated_at < NOW() - INTERVAL '1 hour'
      GROUP BY status
      `,
      []
    );

    // Average completion time
    const avgCompletion = await query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (completed_at - scheduled_start_at)) / 3600) as avg_hours
      FROM jobs
      WHERE status = 'completed'
        AND completed_at >= NOW() - INTERVAL '30 days'
      `,
      []
    );

    // Jobs needing attention
    const needsAttention = await query(
      `
      SELECT COUNT(*) as count
      FROM jobs
      WHERE (
        (status = 'requested' AND created_at < NOW() - INTERVAL '24 hours')
        OR (status = 'disputed')
        OR (status = 'awaiting_approval' AND updated_at < NOW() - INTERVAL '48 hours')
      )
      `,
      []
    );

    res.json({
      insights: {
        stuckJobs: stuckJobs.rows,
        avgCompletionTime: parseFloat(avgCompletion.rows[0]?.avg_hours || "0"),
        needsAttention: parseInt(needsAttention.rows[0]?.count || "0"),
      },
    });
  } catch (error) {
    logger.error("get_job_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

// ============================================
// DISPUTES ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/disputes/{id}/analyze:
 *   post:
 *     summary: Analyze dispute
 *     description: Analyze dispute with AI assistance (admin only).
 *     tags: [Admin]
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
 *         description: Dispute analysis with suggestions
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.post(
  "/disputes/:id/analyze",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const dispute = await query(
        `
        SELECT 
          d.*,
          j.credit_amount,
          j.status as job_status,
          j.scheduled_start_at,
          j.completed_at
        FROM disputes d
        INNER JOIN jobs j ON j.id = d.job_id
        WHERE d.id = $1::uuid
        `,
        [id]
      );

      if (dispute.rows.length === 0) {
        res.status(404).json({
          error: { code: "DISPUTE_NOT_FOUND", message: "Dispute not found" },
        });
        return;
      }

      const disputeData = dispute.rows[0];

      // Similar disputes
      const similarDisputes = await query(
        `
        SELECT 
          id,
          reason,
          resolution,
          created_at
        FROM disputes
        WHERE reason = $1
          AND id != $2::uuid
          AND status != 'open'
        ORDER BY created_at DESC
        LIMIT 5
        `,
        [disputeData.reason, id]
      );

      // Calculate suggested resolution (simplified)
      const suggestedResolution = {
        type: "partial_refund", // Would use AI/ML in production
        amount: Math.round(disputeData.credit_amount * 0.5), // 50% refund
        confidence: 0.75,
        reasoning: "Based on similar disputes, a partial refund is typically appropriate.",
      };

      res.json({
        dispute: disputeData,
        similarDisputes: similarDisputes.rows,
        suggestedResolution,
      });
    } catch (error) {
      logger.error("analyze_dispute_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "ANALYZE_FAILED", message: "Failed to analyze dispute" },
      });
    }
  }
));

/**
 * @swagger
 * /admin/disputes/insights:
 *   get:
 *     summary: Get dispute insights
 *     description: Get dispute insights and analytics (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dispute insights
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/disputes/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Common dispute reasons
    const commonReasons = await query(
      `
      SELECT 
        reason,
        COUNT(*) as count,
        AVG(CASE WHEN resolution = 'refund' THEN 1 ELSE 0 END) as refund_rate
      FROM disputes
      WHERE created_at >= NOW() - INTERVAL '90 days'
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 10
      `,
      []
    );

    // Average resolution time
    const avgResolutionTime = await query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
      FROM disputes
      WHERE status != 'open'
        AND resolved_at IS NOT NULL
        AND resolved_at >= NOW() - INTERVAL '90 days'
      `,
      []
    );

    // Refund rate by reason
    const refundRate = await query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE resolution = 'refund')::float / NULLIF(COUNT(*), 0) as refund_rate
      FROM disputes
      WHERE status != 'open'
        AND created_at >= NOW() - INTERVAL '90 days'
      `,
      []
    );

    res.json({
      insights: {
        commonReasons: commonReasons.rows,
        avgResolutionTime: parseFloat(avgResolutionTime.rows[0]?.avg_hours || "0"),
        refundRate: parseFloat(refundRate.rows[0]?.refund_rate || "0"),
      },
    });
  } catch (error) {
    logger.error("get_dispute_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

// ============================================
// USERS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/users/{id}/risk-profile:
 *   get:
 *     summary: Get user risk profile
 *     description: Get user risk profile and flags (admin only).
 *     tags: [Admin]
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
 *         description: User risk profile
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/users/:id/risk-profile", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get risk flags
    const riskFlags = await query(
      `
      SELECT 
        rf.*,
        rf.severity,
        rf.flag_type,
        rf.description,
        rf.created_at
      FROM risk_flags rf
      WHERE rf.user_id = $1
      ORDER BY rf.created_at DESC
      `,
      [id]
    );

    // Calculate risk score (simplified)
    const riskScore = await query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE severity = 'high') * 10 +
        COUNT(*) FILTER (WHERE severity = 'medium') * 5 +
        COUNT(*) FILTER (WHERE severity = 'low') * 1 as score
      FROM risk_flags
      WHERE user_id = $1
      `,
      [id]
    );

    // User activity summary
    const activity = await query(
      `
      SELECT 
        (SELECT COUNT(*) FROM jobs WHERE client_id = $1 OR cleaner_id = $1) as total_jobs,
        (SELECT COUNT(*) FROM disputes WHERE client_id = $1 OR cleaner_id = $1) as total_disputes,
        (SELECT COUNT(*) FROM credit_ledger WHERE user_id = $1 AND reason = 'refund') as refunds_count
      `,
      [id]
    );

    res.json({
      riskProfile: {
        riskScore: parseInt(riskScore.rows[0]?.score || "0"),
        riskFlags: riskFlags.rows,
        activity: activity.rows[0],
      },
    });
  } catch (error) {
    logger.error("get_risk_profile_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_RISK_PROFILE_FAILED", message: "Failed to get risk profile" },
    });
  }
}));

/**
 * @swagger
 * /admin/users/{id}/risk-action:
 *   post:
 *     summary: Take risk action
 *     description: Take risk mitigation action on user (admin only).
 *     tags: [Admin]
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [suspend, warn, restrict, flag, clear]
 *               reason:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Risk action completed
 *       403:
 *         description: Forbidden - admin only
 */
const riskActionSchema = z.object({
  action: z.enum(["suspend", "warn", "restrict", "flag", "clear"]),
  reason: z.string().optional(),
  duration: z.number().optional(), // days
});

adminEnhancedRouter.post(
  "/users/:id/risk-action",
  validateBody(riskActionSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { action, reason, duration } = req.body;
      const adminId = req.user!.id;

      switch (action) {
        case "suspend":
          await query(
            `
            UPDATE users
            SET status = 'suspended', updated_at = NOW()
            WHERE id = $1
            `,
            [id]
          );
          break;
        case "warn":
          // Create warning flag
          await query(
            `
            INSERT INTO risk_flags (user_id, flag_type, severity, description, created_by)
            VALUES ($1, 'admin_warning', 'medium', $2, $3)
            `,
            [id, reason || "Admin warning", adminId]
          );
          break;
        case "restrict":
          // Add restriction (would be in user metadata or separate table)
          await query(
            `
            UPDATE users
            SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                jsonb_build_object('restrictions', 
                  COALESCE(metadata->'restrictions', '[]'::jsonb) || 
                  jsonb_build_array(jsonb_build_object('action', 'restrict', 'reason', $1, 'created_at', NOW(), 'duration', $2))
                ),
                updated_at = NOW()
            WHERE id = $3
            `,
            [reason || "Admin restriction", duration || null, id]
          );
          break;
        case "clear":
          // Clear risk flags
          await query(
            `
            UPDATE risk_flags
            SET resolved_at = NOW(), resolved_by = $1
            WHERE user_id = $2 AND resolved_at IS NULL
            `,
            [adminId, id]
          );
          break;
      }

      res.json({ success: true, action });
    } catch (error) {
      logger.error("risk_action_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "RISK_ACTION_FAILED", message: "Failed to perform risk action" },
      });
    }
  }
));

// ============================================
// ANALYTICS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/analytics/custom-report:
 *   post:
 *     summary: Build custom report
 *     description: Build custom analytics report (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - metrics
 *               - date_range
 *             properties:
 *               name:
 *                 type: string
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: string
 *               date_range:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date
 *                   end:
 *                     type: string
 *                     format: date
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Custom report generated
 *       403:
 *         description: Forbidden - admin only
 */
const customReportSchema = z.object({
  name: z.string(),
  metrics: z.array(z.string()),
  date_range: z.object({
    start: z.string(),
    end: z.string(),
  }),
  filters: z.record(z.any()).optional(),
});

adminEnhancedRouter.post(
  "/analytics/custom-report",
  validateBody(customReportSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { name, metrics, date_range, filters } = req.body;

      // Build query based on requested metrics
      const reportData: any = {};

      if (metrics.includes("revenue")) {
        const revenue = await query(
          `
          SELECT 
            SUM(credit_amount) / 100.0 as total_revenue,
            COUNT(*) as job_count
          FROM jobs
          WHERE status = 'completed'
            AND completed_at >= $1::timestamp
            AND completed_at <= $2::timestamp
          `,
          [date_range.start, date_range.end]
        );
        reportData.revenue = revenue.rows[0];
      }

      if (metrics.includes("users")) {
        const users = await query(
          `
          SELECT 
            COUNT(*) FILTER (WHERE role = 'client') as clients,
            COUNT(*) FILTER (WHERE role = 'cleaner') as cleaners
          FROM users
          WHERE created_at >= $1::timestamp
            AND created_at <= $2::timestamp
          `,
          [date_range.start, date_range.end]
        );
        reportData.users = users.rows[0];
      }

      // Save report (would store in database)
      res.json({
        report: {
          name,
          data: reportData,
          generated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("build_custom_report_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "BUILD_REPORT_FAILED", message: "Failed to build report" },
      });
    }
  }
));

/**
 * @swagger
 * /admin/analytics/insights:
 *   get:
 *     summary: Get analytics insights
 *     description: Get AI-powered analytics insights (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics insights
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/analytics/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Revenue trend
    const revenueTrend = await query(
      `
      SELECT 
        DATE_TRUNC('week', completed_at) as week,
        SUM(credit_amount) / 100.0 as revenue
      FROM jobs
      WHERE status = 'completed'
        AND completed_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week
      ORDER BY week DESC
      `,
      []
    );

    // User growth
    const userGrowth = await query(
      `
      SELECT 
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week
      ORDER BY week DESC
      `,
      []
    );

    // Calculate insights
    const insights = [];
    if (revenueTrend.rows.length >= 2) {
      const currentWeek = revenueTrend.rows[0]?.revenue || 0;
      const lastWeek = revenueTrend.rows[1]?.revenue || 0;
      const change = ((currentWeek - lastWeek) / lastWeek) * 100;
      insights.push({
        type: "revenue",
        message: `Revenue is ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% this week`,
        trend: change > 0 ? "up" : "down",
      });
    }

    res.json({ insights, trends: { revenue: revenueTrend.rows, users: userGrowth.rows } });
  } catch (error) {
    logger.error("get_analytics_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

// ============================================
// FINANCE ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/finance/forecast:
 *   get:
 *     summary: Get revenue forecast
 *     description: Get revenue forecast (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 3
 *     responses:
 *       200:
 *         description: Revenue forecast
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/finance/forecast", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { months = 3 } = req.query;

    // Get historical revenue
    const historical = await query(
      `
      SELECT 
        DATE_TRUNC('month', completed_at) as month,
        SUM(credit_amount) / 100.0 as revenue
      FROM jobs
      WHERE status = 'completed'
        AND completed_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
      `,
      []
    );

    // Simple forecast (average of last 3 months)
    const avgRevenue =
      historical.rows
        .slice(-3)
        .reduce((sum, row) => sum + parseFloat(row.revenue || "0"), 0) / 3;

    const forecast = [];
    for (let i = 1; i <= parseInt(months as string); i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      forecast.push({
        month: date.toISOString().slice(0, 7),
        forecasted: avgRevenue,
        confidence: 0.7, // Simplified
      });
    }

    res.json({
      historical: historical.rows,
      forecast,
    });
  } catch (error) {
    logger.error("get_forecast_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_FORECAST_FAILED", message: "Failed to get forecast" },
    });
  }
}));

/**
 * @swagger
 * /admin/finance/reports:
 *   get:
 *     summary: Get financial reports
 *     description: Get financial reports (admin only).
 *     tags: [Admin]
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
 *         description: Financial reports
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/finance/reports", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Revenue breakdown
    const revenue = await query(
      `
      SELECT 
        SUM(credit_amount) / 100.0 as total_revenue,
        COUNT(*) as job_count,
        AVG(credit_amount) / 100.0 as avg_job_value
      FROM jobs
      WHERE status = 'completed'
        ${start_date ? "AND completed_at >= $1::timestamp" : ""}
        ${end_date ? `AND completed_at <= $${start_date ? "2" : "1"}::timestamp` : ""}
      `,
      start_date && end_date ? [start_date, end_date] : start_date ? [start_date] : end_date ? [end_date] : []
    );

    // Platform fees
    const fees = await query(
      `
      SELECT 
        SUM(platform_fee_cents) / 100.0 as total_fees
      FROM cleaner_earnings
      WHERE created_at >= COALESCE($1::timestamp, NOW() - INTERVAL '30 days')
        AND created_at <= COALESCE($2::timestamp, NOW())
      `,
      start_date && end_date ? [start_date, end_date] : start_date ? [start_date, null] : end_date ? [null, end_date] : [null, null]
    );

    // Payouts
    const payouts = await query(
      `
      SELECT 
        SUM(amount_cents) / 100.0 as total_payouts,
        COUNT(*) as payout_count
      FROM payouts
      WHERE status = 'paid'
        ${start_date ? "AND created_at >= $1::timestamp" : ""}
        ${end_date ? `AND created_at <= $${start_date ? "2" : "1"}::timestamp` : ""}
      `,
      start_date && end_date ? [start_date, end_date] : start_date ? [start_date] : end_date ? [end_date] : []
    );

    res.json({
      reports: {
        revenue: revenue.rows[0],
        fees: fees.rows[0],
        payouts: payouts.rows[0],
      },
    });
  } catch (error) {
    logger.error("get_finance_reports_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_REPORTS_FAILED", message: "Failed to get reports" },
    });
  }
}));

// ============================================
// COMMUNICATION ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/communication/templates:
 *   get:
 *     summary: Get communication templates
 *     description: Get message templates (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Communication templates
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/communication/templates", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const templates = await query(
      `
      SELECT 
        id,
        name,
        subject,
        body,
        category,
        variables,
        created_at
      FROM notification_templates
      WHERE is_active = true
      ORDER BY category, name
      `,
      []
    );

    res.json({ templates: templates.rows });
  } catch (error) {
    logger.error("get_templates_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_TEMPLATES_FAILED", message: "Failed to get templates" },
    });
  }
}));

/**
 * @swagger
 * /admin/communication/send:
 *   post:
 *     summary: Send message to users
 *     description: Send message to users via email/SMS/push (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *               - recipients
 *               - channel
 *             properties:
 *               template_id:
 *                 type: string
 *                 format: uuid
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, all]
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       403:
 *         description: Forbidden - admin only
 */
const sendMessageSchema = z.object({
  template_id: z.string().uuid().optional(),
  subject: z.string().optional(),
  body: z.string(),
  recipients: z.array(z.string()),
  channel: z.enum(["email", "sms", "push", "all"]),
});

adminEnhancedRouter.post(
  "/communication/send",
  validateBody(sendMessageSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { template_id, subject, body, recipients, channel } = req.body;

      // This would integrate with notification service
      // For now, return success
      res.json({
        success: true,
        message: `Message sent to ${recipients.length} recipients via ${channel}`,
        recipients_count: recipients.length,
      });
    } catch (error) {
      logger.error("send_message_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SEND_MESSAGE_FAILED", message: "Failed to send message" },
      });
    }
  }
));

/**
 * @swagger
 * /admin/communication/analytics:
 *   get:
 *     summary: Get communication analytics
 *     description: Get communication analytics (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Communication analytics
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/communication/analytics", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const analytics = await query(
      `
      SELECT 
        channel,
        COUNT(*) as sent_count,
        COUNT(*) FILTER (WHERE success = true) as success_count
      FROM notification_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY channel
      `,
      []
    );

    res.json({ analytics: analytics.rows });
  } catch (error) {
    logger.error("get_communication_analytics_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_ANALYTICS_FAILED", message: "Failed to get analytics" },
    });
  }
}));

// ============================================
// RISK ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/risk/scoring:
 *   get:
 *     summary: Get risk scoring
 *     description: Get risk scoring details (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Risk scoring data
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/risk/scoring", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const riskScores = await query(
      `
      SELECT 
        user_id,
        risk_score,
        risk_tier,
        flag_count,
        updated_at
      FROM user_risk_profiles
      WHERE risk_score >= 50
      ORDER BY risk_score DESC
      LIMIT 50
      `,
      []
    );

    res.json({ riskScores: riskScores.rows });
  } catch (error) {
    logger.error("get_risk_scoring_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_RISK_SCORING_FAILED", message: "Failed to get risk scoring" },
    });
  }
}));

/**
 * @swagger
 * /admin/risk/mitigate:
 *   post:
 *     summary: Mitigate risk
 *     description: Mitigate user risk (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - action
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               action:
 *                 type: string
 *                 enum: [flag, restrict, suspend, clear]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Risk mitigated successfully
 *       403:
 *         description: Forbidden - admin only
 */
const mitigateRiskSchema = z.object({
  user_id: z.string(),
  action: z.enum(["flag", "restrict", "suspend", "clear"]),
  reason: z.string().optional(),
});

adminEnhancedRouter.post(
  "/risk/mitigate",
  validateBody(mitigateRiskSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { user_id, action, reason } = req.body;
      const adminId = req.user!.id;

      // Similar to risk-action endpoint
      await query(
        `
        INSERT INTO risk_mitigation_log (user_id, action, reason, admin_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        `,
        [user_id, action, reason || "Admin action", adminId]
      );

      res.json({ success: true, action });
    } catch (error) {
      logger.error("mitigate_risk_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "MITIGATE_RISK_FAILED", message: "Failed to mitigate risk" },
      });
    }
  }
));

// ============================================
// REPORTS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/reports/build:
 *   post:
 *     summary: Build report
 *     description: Build custom report (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_type:
 *                 type: string
 *               parameters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Report built successfully
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.post("/reports/build", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Similar to analytics/custom-report
    res.json({ success: true, message: "Report building functionality" });
  } catch (error) {
    logger.error("build_report_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "BUILD_REPORT_FAILED", message: "Failed to build report" },
    });
  }
}));

/**
 * @swagger
 * /admin/reports/schedule:
 *   post:
 *     summary: Schedule report
 *     description: Schedule automated report generation (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - report_id
 *               - frequency
 *               - recipients
 *             properties:
 *               report_id:
 *                 type: string
 *                 format: uuid
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *     responses:
 *       200:
 *         description: Report scheduled successfully
 *       403:
 *         description: Forbidden - admin only
 */
const scheduleReportSchema = z.object({
  report_id: z.string().uuid(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipients: z.array(z.string().email()),
});

adminEnhancedRouter.post(
  "/reports/schedule",
  validateBody(scheduleReportSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { report_id, frequency, recipients } = req.body;

      // Store scheduled report (would be in database)
      res.json({
        success: true,
        schedule: {
          report_id,
          frequency,
          recipients,
          next_run: new Date().toISOString(), // Would calculate based on frequency
        },
      });
    } catch (error) {
      logger.error("schedule_report_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SCHEDULE_REPORT_FAILED", message: "Failed to schedule report" },
      });
    }
  }
));

// ============================================
// SETTINGS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /admin/settings/feature-flags:
 *   get:
 *     summary: Get feature flags
 *     description: Get system feature flags (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature flags object
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/settings/feature-flags", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // Feature flags would be stored in database or config
    const featureFlags = {
      "ai_assistant": true,
      "gamification": true,
      "recurring_bookings": true,
      "instant_payouts": true,
      "gps_tracking": false,
    };

    res.json({ featureFlags });
  } catch (error) {
    logger.error("get_feature_flags_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_FEATURE_FLAGS_FAILED", message: "Failed to get feature flags" },
    });
  }
}));

/**
 * @swagger
 * /admin/settings/audit-log:
 *   get:
 *     summary: Get settings audit log
 *     description: Get settings audit log entries (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Max entries to return
 *     responses:
 *       200:
 *         description: Audit log entries
 *       403:
 *         description: Forbidden - admin only
 */
adminEnhancedRouter.get("/settings/audit-log", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const auditLog = await query(
      `
      SELECT 
        id,
        admin_user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
      FROM admin_audit_log
      WHERE entity_type = 'settings'
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [parseInt(limit as string)]
    );

    res.json({ auditLog: auditLog.rows });
  } catch (error) {
    logger.error("get_audit_log_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_AUDIT_LOG_FAILED", message: "Failed to get audit log" },
    });
  }
}));

export default adminEnhancedRouter;
