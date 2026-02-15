// src/routes/admin/bookings.ts
import { Router, Response, NextFunction, Request } from "express";
import { requireAuth, requireAdmin, AuthedRequest } from "../../middleware/authCanonical";
import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { BookingConsoleFilters, BookingConsoleItem } from "../../types/admin";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /admin/bookings:
 *   get:
 *     summary: Get bookings (admin)
 *     description: Get paginated list of bookings with filters.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: cleanerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, createdAt, amount, status]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const {
      status,
      dateFrom,
      dateTo,
      cleanerId,
      clientId,
      search,
      page = "1",
      limit = "50",
      sortBy = "date",
      sortOrder = "DESC",
    } = authedReq.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build dynamic WHERE clause
    const conditions: string[] = ["1=1"];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      conditions.push(`j.status = ANY($${paramIndex})`);
      params.push(statusArray);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`j.date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`j.date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    if (cleanerId) {
      conditions.push(`cp.user_id = $${paramIndex}`);
      params.push(cleanerId);
      paramIndex++;
    }

    if (clientId) {
      conditions.push(`clp.user_id = $${paramIndex}`);
      params.push(clientId);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        cp.full_name ILIKE $${paramIndex} OR 
        clp.full_name ILIKE $${paramIndex} OR
        j.address ILIKE $${paramIndex} OR
        j.id::text ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Valid sort columns
    const validSortColumns: Record<string, string> = {
      date: "j.date",
      createdAt: "j.created_at",
      amount: "j.total_price",
      status: "j.status",
    };

    const sortColumn = validSortColumns[sortBy as string] || "j.date";
    const order = sortOrder === "ASC" ? "ASC" : "DESC";

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM jobs j
       LEFT JOIN cleaner_profiles cp ON cp.user_email = j.cleaner_email
       LEFT JOIN client_profiles clp ON clp.user_email = j.client_email
       WHERE ${whereClause}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].total);

    // Get bookings
    const bookingsResult = await query(
      `SELECT 
        j.id,
        j.date,
        j.start_time,
        j.hours,
        j.status,
        j.total_price,
        j.address,
        j.created_at,
        j.updated_at,
        clp.user_id as client_id,
        clp.full_name as client_name,
        clp.user_email as client_email,
        clp.phone as client_phone,
        cp.user_id as cleaner_id,
        cp.full_name as cleaner_name,
        cp.user_email as cleaner_email,
        cp.tier as cleaner_tier,
        COALESCE(ps.status, 'pending') as payment_status
      FROM jobs j
      LEFT JOIN cleaner_profiles cp ON cp.user_email = j.cleaner_email
      LEFT JOIN client_profiles clp ON clp.user_email = j.client_email
      LEFT JOIN payment_intents ps ON ps.booking_id = j.id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const bookings: BookingConsoleItem[] = bookingsResult.rows.map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time,
      hours: parseFloat(row.hours),
      status: row.status,
      client: {
        id: row.client_id,
        name: row.client_name,
        email: row.client_email,
        phone: row.client_phone,
      },
      cleaner: {
        id: row.cleaner_id,
        name: row.cleaner_name,
        email: row.cleaner_email,
        tier: row.cleaner_tier,
      },
      address: row.address,
      amount: parseFloat(row.total_price),
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      bookings,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });

    logger.info("Admin bookings list retrieved", {
      adminId: authedReq.user?.id,
      filters: { status, dateFrom, dateTo, cleanerId, clientId, search },
      count: bookings.length,
    });
  } catch (error) {
    logger.error("Error fetching admin bookings", { error });
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

/**
 * GET /admin/bookings/:id
 * Get detailed booking information
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const { id } = authedReq.params;

    const result = await query(
      `SELECT 
        j.*,
        cp.user_id as cleaner_id,
        cp.full_name as cleaner_name,
        cp.user_email as cleaner_email,
        cp.phone as cleaner_phone,
        cp.tier as cleaner_tier,
        cp.average_rating as cleaner_rating,
        clp.user_id as client_id,
        clp.full_name as client_name,
        clp.user_email as client_email,
        clp.phone as client_phone,
        ps.status as payment_status,
        ps.stripe_payment_intent_id,
        ps.amount as payment_amount
      FROM jobs j
      LEFT JOIN cleaner_profiles cp ON cp.user_email = j.cleaner_email
      LEFT JOIN client_profiles clp ON clp.user_email = j.client_email
      LEFT JOIN payment_intents ps ON ps.booking_id = j.id
      WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error fetching booking details", { error, bookingId: authedReq.params.id });
    res.status(500).json({ error: "Failed to fetch booking details" });
  }
});

/**
 * PATCH /admin/bookings/:id/status
 * Update booking status (admin override)
 */
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const { id } = authedReq.params;
    const { status, reason } = authedReq.body;

    const validStatuses = [
      "pending_acceptance",
      "scheduled",
      "in_progress",
      "completed",
      "cancelled",
      "disputed",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Update booking status
    const result = await query(
      `UPDATE jobs 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        "update_booking_status",
        "booking",
        id,
        JSON.stringify({ oldStatus: result.rows[0].status, newStatus: status, reason }),
        req.ip,
      ]
    );

    logger.info("Admin updated booking status", {
      adminId: authedReq.user?.id,
      bookingId: id,
      newStatus: status,
      reason,
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error updating booking status", { error, bookingId: authedReq.params.id });
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

/**
 * GET /admin/bookings/stats/summary
 * Get booking statistics summary
 */
router.get("/stats/summary", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending_acceptance') as pending,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'disputed') as disputed,
        COUNT(*) FILTER (WHERE date >= CURRENT_DATE) as upcoming,
        COUNT(*) FILTER (WHERE date = CURRENT_DATE) as today
      FROM jobs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error("Error fetching booking stats", { error });
    res.status(500).json({ error: "Failed to fetch booking stats" });
  }
});

/**
 * POST /admin/bookings/bulk-update
 * Bulk update bookings
 */
router.post("/bulk-update", async (req: Request, res: Response, next: NextFunction) => {
  const authedReq = req as AuthedRequest;
  try {
    const { bookingIds, action, value } = authedReq.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "Invalid booking IDs" });
    }

    let query_text = "";
    let params: any[] = [];

    switch (action) {
      case "update_status":
        query_text = `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = ANY($2)`;
        params = [value, bookingIds];
        break;
      case "cancel":
        query_text = `UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = ANY($1)`;
        params = [bookingIds];
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    const result = await query(query_text, params);

    logger.info("Admin bulk updated bookings", {
      adminId: authedReq.user?.id,
      action,
      count: result.rowCount,
    });

    res.json({
      success: true,
      updatedCount: result.rowCount,
    });
  } catch (error) {
    logger.error("Error bulk updating bookings", { error });
    res.status(500).json({ error: "Failed to bulk update bookings" });
  }
});

export default router;
