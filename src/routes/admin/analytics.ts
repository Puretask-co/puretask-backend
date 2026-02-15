// src/routes/admin/analytics.ts
import { Router, Response, NextFunction, Request } from "express";
import { requireAuth, requireAdmin, AuthedRequest } from "../../middleware/authCanonical";
import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { AnalyticsData } from "../../types/admin";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /admin/analytics/overview:
 *   get:
 *     summary: Get analytics overview
 *     description: Get comprehensive analytics overview including revenue, bookings, cleaners.
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
 *         description: Analytics overview
 */
router.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const { period = "30d" } = authedReq.query;

    // Calculate date range
    const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Revenue analytics
    const revenueResult = await query(
      `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_booking_value
      FROM jobs
      WHERE created_at >= $1 AND status IN ('completed', 'paid')
    `,
      [startDate]
    );

    const revenueByPeriod = await query(
      `
      SELECT 
        DATE(created_at) as date,
        SUM(total_price) as amount,
        COUNT(*) as count
      FROM jobs
      WHERE created_at >= $1 AND status IN ('completed', 'paid')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
      [startDate]
    );

    const revenueByType = await query(
      `
      SELECT 
        cleaning_type as type,
        SUM(total_price) as amount,
        COUNT(*) as count
      FROM jobs
      WHERE created_at >= $1 AND status IN ('completed', 'paid')
      GROUP BY cleaning_type
      ORDER BY amount DESC
    `,
      [startDate]
    );

    // Booking analytics
    const bookingsByStatus = await query(
      `
      SELECT status, COUNT(*) as count
      FROM jobs
      WHERE created_at >= $1
      GROUP BY status
      ORDER BY count DESC
    `,
      [startDate]
    );

    // Cleaner analytics
    const cleanerStats = await query(`
      SELECT 
        COUNT(DISTINCT cp.id) as total,
        COUNT(DISTINCT CASE WHEN u.last_login_at >= NOW() - INTERVAL '30 days' THEN cp.id END) as active
      FROM cleaner_profiles cp
      JOIN users u ON u.id = cp.user_id
    `);

    const cleanersByTier = await query(`
      SELECT tier, COUNT(*) as count
      FROM cleaner_profiles
      WHERE tier IS NOT NULL
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'Platinum' THEN 1
          WHEN 'Gold' THEN 2
          WHEN 'Pro' THEN 3
          WHEN 'Semi Pro' THEN 4
          WHEN 'Rookie' THEN 5
        END
    `);

    const topPerformers = await query(
      `
      SELECT 
        cp.user_id as id,
        cp.full_name as name,
        COALESCE(SUM(j.total_price), 0) as earnings,
        cp.average_rating as rating,
        COUNT(j.id) as job_count
      FROM cleaner_profiles cp
      LEFT JOIN jobs j ON j.cleaner_email = cp.user_email AND j.created_at >= $1
      GROUP BY cp.user_id, cp.full_name, cp.average_rating
      ORDER BY earnings DESC
      LIMIT 10
    `,
      [startDate]
    );

    // Client analytics
    const clientStats = await query(`
      SELECT 
        COUNT(DISTINCT cp.id) as total,
        COUNT(DISTINCT CASE WHEN EXISTS (
          SELECT 1 FROM jobs j WHERE j.client_email = cp.user_email AND j.created_at >= NOW() - INTERVAL '30 days'
        ) THEN cp.id END) as active,
        COUNT(DISTINCT CASE WHEN cp.created_at >= NOW() - INTERVAL '30 days' THEN cp.id END) as new_this_month
      FROM client_profiles cp
    `);

    // Calculate retention rate
    const retentionResult = await query(
      `
      SELECT 
        COUNT(DISTINCT CASE WHEN booking_count >= 2 THEN client_email END)::float / 
        NULLIF(COUNT(DISTINCT client_email), 0) as retention_rate
      FROM (
        SELECT client_email, COUNT(*) as booking_count
        FROM jobs
        WHERE created_at >= $1
        GROUP BY client_email
      ) subquery
    `,
      [startDate]
    );

    const analyticsData: AnalyticsData = {
      revenue: {
        total: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
        byPeriod: revenueByPeriod.rows.map((r) => ({
          date: r.date,
          amount: parseFloat(r.amount),
        })),
        byCleaningType: revenueByType.rows.map((r) => ({
          type: r.type,
          amount: parseFloat(r.amount),
          count: parseInt(r.count),
        })),
        change: 0, // TODO: Calculate period-over-period change
      },
      bookings: {
        total: parseInt(revenueResult.rows[0]?.total_bookings || 0),
        byStatus: bookingsByStatus.rows.map((r) => ({
          status: r.status,
          count: parseInt(r.count),
        })),
        byPeriod: revenueByPeriod.rows.map((r) => ({
          date: r.date,
          count: parseInt(r.count),
        })),
        avgValue: parseFloat(revenueResult.rows[0]?.avg_booking_value || 0),
      },
      cleaners: {
        total: parseInt(cleanerStats.rows[0]?.total || 0),
        active: parseInt(cleanerStats.rows[0]?.active || 0),
        byTier: cleanersByTier.rows.map((r) => ({
          tier: r.tier,
          count: parseInt(r.count),
        })),
        topPerformers: topPerformers.rows.map((r) => ({
          id: r.id,
          name: r.name,
          earnings: parseFloat(r.earnings),
          rating: parseFloat(r.rating || 0),
          jobCount: parseInt(r.job_count),
        })),
      },
      clients: {
        total: parseInt(clientStats.rows[0]?.total || 0),
        active: parseInt(clientStats.rows[0]?.active || 0),
        newThisMonth: parseInt(clientStats.rows[0]?.new_this_month || 0),
        retentionRate: parseFloat(retentionResult.rows[0]?.retention_rate || 0) * 100,
      },
    };

    logger.info("Admin analytics retrieved", {
      adminId: authedReq.user?.id,
      period,
    });

    res.json(analyticsData);
  } catch (error) {
    logger.error("Error fetching analytics", { error });
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /admin/analytics/revenue
 * Get detailed revenue analytics
 */
router.get("/revenue", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const { period = "30d", groupBy = "day" } = authedReq.query;

    const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let dateFormat = "YYYY-MM-DD";
    if (groupBy === "week") dateFormat = "IYYY-IW";
    if (groupBy === "month") dateFormat = "YYYY-MM";

    const revenueData = await query(
      `
      SELECT 
        TO_CHAR(created_at, $1) as period,
        SUM(total_price) as revenue,
        COUNT(*) as booking_count,
        AVG(total_price) as avg_booking_value
      FROM jobs
      WHERE created_at >= $2 AND status IN ('completed', 'paid')
      GROUP BY TO_CHAR(created_at, $1)
      ORDER BY period ASC
    `,
      [dateFormat, startDate]
    );

    res.json({
      data: revenueData.rows.map((r) => ({
        period: r.period,
        revenue: parseFloat(r.revenue),
        bookingCount: parseInt(r.booking_count),
        avgBookingValue: parseFloat(r.avg_booking_value),
      })),
    });
  } catch (error) {
    logger.error("Error fetching revenue analytics", { error });
    res.status(500).json({ error: "Failed to fetch revenue analytics" });
  }
});

/**
 * GET /admin/analytics/platform-metrics
 * Get platform health metrics
 */
router.get("/platform-metrics", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const metrics = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM cleaner_profiles) as total_cleaners,
        (SELECT COUNT(*) FROM client_profiles) as total_clients,
        (SELECT COUNT(*) FROM jobs) as total_bookings,
        (SELECT COUNT(*) FROM jobs WHERE status = 'scheduled') as upcoming_bookings,
        (SELECT COUNT(*) FROM jobs WHERE status = 'completed') as completed_bookings,
        (SELECT AVG(average_rating) FROM cleaner_profiles WHERE average_rating > 0) as avg_cleaner_rating,
        (SELECT SUM(credit_balance) FROM credit_ledger GROUP BY client_id) as total_credits_issued
    `);

    res.json({
      totalUsers: parseInt(metrics.rows[0].total_users),
      totalCleaners: parseInt(metrics.rows[0].total_cleaners),
      totalClients: parseInt(metrics.rows[0].total_clients),
      totalBookings: parseInt(metrics.rows[0].total_bookings),
      upcomingBookings: parseInt(metrics.rows[0].upcoming_bookings),
      completedBookings: parseInt(metrics.rows[0].completed_bookings),
      avgCleanerRating: parseFloat(metrics.rows[0].avg_cleaner_rating || 0).toFixed(2),
    });
  } catch (error) {
    logger.error("Error fetching platform metrics", { error });
    res.status(500).json({ error: "Failed to fetch platform metrics" });
  }
});

export default router;
