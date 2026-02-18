// src/routes/admin/finance.ts
import { Router, Response, NextFunction } from "express";
import {
  requireAuth,
  requireFinanceRole,
  AuthedRequest,
  authedHandler,
} from "../../middleware/authCanonical";
import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { FinanceCenterData } from "../../types/admin";

const router = Router();

router.use(requireAuth);
router.use(requireFinanceRole); // ops_finance, admin for payouts/credits

/**
 * @swagger
 * /admin/finance/overview:
 *   get:
 *     summary: Get finance overview
 *     description: Get finance center overview including pending payouts, revenue breakdown, recent transactions.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Finance overview
 */
router.get(
  "/overview",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { period = "30d" } = req.query;
      const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Pending payouts
      const pendingPayouts = await query(`
      SELECT 
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payout_items
      WHERE status = 'pending'
    `);

      const pendingPayoutItems = await query(`
      SELECT 
        pi.id,
        cp.full_name as cleaner_name,
        cp.user_id as cleaner_id,
        pi.amount,
        pi.job_count,
        pi.period_start,
        pi.period_end
      FROM payout_items pi
      JOIN cleaner_profiles cp ON cp.user_id = pi.cleaner_id
      WHERE pi.status = 'pending'
      ORDER BY pi.amount DESC
      LIMIT 20
    `);

      // Revenue breakdown
      const revenueBreakdown = await query(
        `
      SELECT 
        SUM(total_price) as gross_revenue,
        SUM(total_price * 0.80) as cleaner_payouts,
        SUM(total_price * 0.20) as platform_fee
      FROM jobs
      WHERE status IN ('completed', 'paid')
      AND created_at >= $1
    `,
        [startDate]
      );

      // Recent transactions
      const recentTransactions = await query(
        `
      SELECT 
        'payout' as type,
        amount,
        'Payout to cleaner' as description,
        created_at as timestamp,
        status
      FROM payout_items
      WHERE created_at >= $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
        [startDate]
      );

      const financeData: FinanceCenterData = {
        pendingPayouts: {
          total: parseInt(pendingPayouts.rows[0]?.count || 0),
          amount: parseFloat(pendingPayouts.rows[0]?.total_amount || 0),
          items: pendingPayoutItems.rows.map((row) => ({
            id: row.id,
            cleanerName: row.cleaner_name,
            cleanerId: row.cleaner_id,
            amount: parseFloat(row.amount),
            jobCount: parseInt(row.job_count || 0),
            periodStart: row.period_start,
            periodEnd: row.period_end,
          })),
        },
        recentTransactions: recentTransactions.rows.map((row) => ({
          id: row.id || `tx_${Date.now()}`,
          type: row.type,
          amount: parseFloat(row.amount),
          description: row.description,
          timestamp: row.timestamp,
          status: row.status,
        })),
        revenueBreakdown: {
          gross: parseFloat(revenueBreakdown.rows[0]?.gross_revenue || 0),
          cleanerPayouts: parseFloat(revenueBreakdown.rows[0]?.cleaner_payouts || 0),
          platformFee: parseFloat(revenueBreakdown.rows[0]?.platform_fee || 0),
          net: parseFloat(revenueBreakdown.rows[0]?.platform_fee || 0),
        },
      };

      logger.info("Admin finance overview retrieved", {
        adminId: req.user?.id,
        period,
      });

      res.json(financeData);
    } catch (error) {
      logger.error("Error fetching finance overview", { error });
      res.status(500).json({ error: "Failed to fetch finance overview" });
    }
  })
);

/**
 * GET /admin/finance/payouts
 * Get all payouts with filters
 */
router.get(
  "/payouts",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { status, cleanerId, dateFrom, dateTo, page = "1", limit = "50" } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const conditions: string[] = ["1=1"];
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`pi.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (cleanerId) {
        conditions.push(`pi.cleaner_id = $${paramIndex}`);
        params.push(cleanerId);
        paramIndex++;
      }

      if (dateFrom) {
        conditions.push(`pi.created_at >= $${paramIndex}`);
        params.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        conditions.push(`pi.created_at <= $${paramIndex}`);
        params.push(dateTo);
        paramIndex++;
      }

      const whereClause = conditions.join(" AND ");

      const payouts = await query(
        `SELECT 
        pi.*,
        cp.full_name as cleaner_name,
        cp.user_email as cleaner_email
      FROM payout_items pi
      JOIN cleaner_profiles cp ON cp.user_id = pi.cleaner_id
      WHERE ${whereClause}
      ORDER BY pi.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit as string), offset]
      );

      res.json({ payouts: payouts.rows });
    } catch (error) {
      logger.error("Error fetching payouts", { error });
      res.status(500).json({ error: "Failed to fetch payouts" });
    }
  })
);

/**
 * POST /admin/finance/payouts/process
 * Process pending payouts
 */
router.post(
  "/payouts/process",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { payoutIds } = req.body;

      if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
        res.status(400).json({ error: "Invalid payout IDs" });
        return;
      }

      // Update payout status
      const result = await query(
        `UPDATE payout_items 
       SET status = 'processing', processed_at = NOW(), processed_by = $1
       WHERE id = ANY($2) AND status = 'pending'
       RETURNING *`,
        [req.user?.id, payoutIds]
      );

      // Log admin action
      await query(
        `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.id,
          "process_payouts",
          "payout",
          null,
          JSON.stringify({ payoutIds, count: result.rowCount }),
          req.ip,
        ]
      );

      logger.info("Admin processed payouts", {
        adminId: req.user?.id,
        count: result.rowCount,
      });

      res.json({
        success: true,
        processedCount: result.rowCount,
        payouts: result.rows,
      });
    } catch (error) {
      logger.error("Error processing payouts", { error });
      res.status(500).json({ error: "Failed to process payouts" });
    }
  })
);

/**
 * GET /admin/finance/revenue
 * Get detailed revenue report
 */
router.get(
  "/revenue",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { period = "30d", groupBy = "day" } = req.query;
      const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      let dateFormat = "YYYY-MM-DD";
      if (groupBy === "week") dateFormat = "IYYY-IW";
      if (groupBy === "month") dateFormat = "YYYY-MM";

      const revenue = await query(
        `
      SELECT 
        TO_CHAR(created_at, $1) as period,
        COUNT(*) as booking_count,
        SUM(total_price) as gross_revenue,
        SUM(total_price * 0.80) as cleaner_payout,
        SUM(total_price * 0.20) as platform_fee
      FROM jobs
      WHERE status IN ('completed', 'paid')
      AND created_at >= $2
      GROUP BY TO_CHAR(created_at, $1)
      ORDER BY period ASC
    `,
        [dateFormat, startDate]
      );

      res.json({ data: revenue.rows });
    } catch (error) {
      logger.error("Error fetching revenue report", { error });
      res.status(500).json({ error: "Failed to fetch revenue report" });
    }
  })
);

/**
 * GET /admin/finance/transactions
 * Get transaction history
 */
router.get(
  "/transactions",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { type, dateFrom, dateTo, page = "1", limit = "100" } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Get credit ledger transactions
      const creditTransactions = await query(
        `
      SELECT 
        'credit' as type,
        cl.id,
        cl.amount,
        cl.reason as description,
        cl.created_at as timestamp,
        'completed' as status,
        cp.full_name as client_name
      FROM credit_ledger cl
      JOIN client_profiles cp ON cp.user_id = cl.client_id
      WHERE cl.created_at >= NOW() - INTERVAL '90 days'
      ORDER BY cl.created_at DESC
      LIMIT $1 OFFSET $2
    `,
        [parseInt(limit as string), offset]
      );

      res.json({ transactions: creditTransactions.rows });
    } catch (error) {
      logger.error("Error fetching transactions", { error });
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  })
);

/**
 * GET /admin/finance/stats
 * Get financial statistics
 */
router.get(
  "/stats",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const stats = await query(`
      SELECT 
        (SELECT COALESCE(SUM(total_price), 0) FROM jobs WHERE status IN ('completed', 'paid')) as total_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payout_items WHERE status = 'completed') as total_payouts,
        (SELECT COALESCE(SUM(amount), 0) FROM payout_items WHERE status = 'pending') as pending_payouts,
        (SELECT COUNT(*) FROM jobs WHERE status IN ('completed', 'paid')) as total_completed_bookings,
        (SELECT AVG(total_price) FROM jobs WHERE status IN ('completed', 'paid')) as avg_booking_value
    `);

      res.json(stats.rows[0]);
    } catch (error) {
      logger.error("Error fetching finance stats", { error });
      res.status(500).json({ error: "Failed to fetch finance stats" });
    }
  })
);

export default router;
