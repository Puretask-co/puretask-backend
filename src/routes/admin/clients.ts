// src/routes/admin/clients.ts
import { Router, Response, NextFunction, Request } from 'express';
import { AuthedRequest } from '../../types/express';
import { query } from '../../db/client';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth';
import { requireAdmin } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { ClientManagementItem } from '../../types/admin';

const router = Router();

router.use(jwtAuthMiddleware);
router.use((req: AuthedRequest, res: Response, next) => requireAdmin(req, res, next));

/**
 * GET /admin/clients
 * Get paginated list of clients with filters
 */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const {
      status,
      search,
      minBookings,
      hasRiskFlags,
      page = '1',
      limit = '50',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (status === 'active') {
      conditions.push(`EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.client_email = cp.user_email 
        AND j.created_at >= NOW() - INTERVAL '30 days'
      )`);
    } else if (status === 'inactive') {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.client_email = cp.user_email 
        AND j.created_at >= NOW() - INTERVAL '30 days'
      )`);
    }

    if (search) {
      conditions.push(`(
        cp.full_name ILIKE $${paramIndex} OR 
        cp.user_email ILIKE $${paramIndex} OR
        u.id::text ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (minBookings) {
      conditions.push(`booking_stats.total_bookings >= $${paramIndex}`);
      params.push(parseInt(minBookings as string));
      paramIndex++;
    }

    if (hasRiskFlags === 'true') {
      conditions.push(`risk_stats.flag_count > 0`);
    }

    const whereClause = conditions.join(' AND ');

    const validSortColumns: Record<string, string> = {
      name: 'cp.full_name',
      email: 'cp.user_email',
      bookings: 'total_bookings',
      spent: 'total_spent',
      createdAt: 'cp.created_at'
    };

    const sortColumn = validSortColumns[sortBy as string] || 'cp.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM client_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN (
         SELECT client_email, COUNT(*) as total_bookings
         FROM jobs GROUP BY client_email
       ) booking_stats ON booking_stats.client_email = cp.user_email
       LEFT JOIN (
         SELECT user_id, COUNT(*) as flag_count
         FROM risk_flags WHERE active = true
         GROUP BY user_id
       ) risk_stats ON risk_stats.user_id = cp.user_id
       WHERE ${whereClause}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].total);

    // Get clients
    const clientsResult = await query(
      `SELECT 
        cp.id,
        cp.user_id,
        cp.full_name,
        cp.user_email,
        cp.phone,
        cp.created_at,
        u.last_login_at,
        COALESCE(booking_stats.total_bookings, 0) as total_bookings,
        COALESCE(booking_stats.total_spent, 0) as total_spent,
        COALESCE(booking_stats.last_booking_at, NULL) as last_booking_at,
        COALESCE(credit_stats.credit_balance, 0) as credit_balance,
        COALESCE(risk_stats.risk_flags, '[]'::json) as risk_flags,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.client_email = cp.user_email 
            AND j.created_at >= NOW() - INTERVAL '30 days'
          ) THEN 'active'
          WHEN risk_stats.flag_count > 0 THEN 'flagged'
          ELSE 'inactive'
        END as status
      FROM client_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN (
        SELECT 
          client_email,
          COUNT(*) as total_bookings,
          SUM(total_price) as total_spent,
          MAX(created_at) as last_booking_at
        FROM jobs
        WHERE status IN ('completed', 'paid')
        GROUP BY client_email
      ) booking_stats ON booking_stats.client_email = cp.user_email
      LEFT JOIN (
        SELECT 
          client_id,
          SUM(amount) as credit_balance
        FROM credit_ledger
        GROUP BY client_id
      ) credit_stats ON credit_stats.client_id = cp.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as flag_count,
          json_agg(json_build_object('type', flag_type, 'reason', reason)) as risk_flags
        FROM risk_flags
        WHERE active = true
        GROUP BY user_id
      ) risk_stats ON risk_stats.user_id = cp.user_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const clients: ClientManagementItem[] = clientsResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.user_email,
      phone: row.phone,
      totalBookings: parseInt(row.total_bookings),
      totalSpent: parseFloat(row.total_spent),
      creditBalance: parseFloat(row.credit_balance),
      status: row.status,
      riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags.map((f: any) => f.type) : [],
      createdAt: row.created_at,
      lastBookingAt: row.last_booking_at
    }));

    res.json({
      clients,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });

    logger.info('Admin clients list retrieved', {
      adminId: req.user?.id,
      count: clients.length
    });
  } catch (error) {
    logger.error('Error fetching admin clients', { error });
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * GET /admin/clients/:id
 * Get detailed client information
 */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        cp.*,
        u.email,
        u.created_at as user_created_at,
        u.last_login_at,
        booking_stats.total_bookings,
        booking_stats.completed_bookings,
        booking_stats.cancelled_bookings,
        booking_stats.total_spent,
        booking_stats.avg_booking_value,
        credit_stats.credit_balance,
        credit_stats.total_credits_granted,
        risk_stats.risk_flags
      FROM client_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN (
        SELECT 
          client_email,
          COUNT(*) as total_bookings,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
          SUM(total_price) FILTER (WHERE status IN ('completed', 'paid')) as total_spent,
          AVG(total_price) as avg_booking_value
        FROM jobs
        GROUP BY client_email
      ) booking_stats ON booking_stats.client_email = cp.user_email
      LEFT JOIN (
        SELECT 
          client_id,
          SUM(amount) as credit_balance,
          SUM(amount) FILTER (WHERE amount > 0) as total_credits_granted
        FROM credit_ledger
        GROUP BY client_id
      ) credit_stats ON credit_stats.client_id = cp.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          json_agg(json_build_object(
            'type', flag_type,
            'reason', reason,
            'severity', severity,
            'createdAt', created_at
          )) as risk_flags
        FROM risk_flags
        WHERE active = true
        GROUP BY user_id
      ) risk_stats ON risk_stats.user_id = cp.user_id
      WHERE cp.user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching client details', { error, clientId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

/**
 * GET /admin/clients/:id/bookings
 * Get all bookings for a client
 */
router.get('/:id/bookings', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const result = await query(
      `SELECT 
        j.*,
        cp.full_name as cleaner_name,
        cp.tier as cleaner_tier
      FROM jobs j
      LEFT JOIN cleaner_profiles cp ON cp.user_email = j.cleaner_email
      WHERE j.client_email = (SELECT user_email FROM client_profiles WHERE user_id = $1)
      ORDER BY j.date DESC, j.start_time DESC
      LIMIT $2 OFFSET $3`,
      [id, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({ bookings: result.rows });
  } catch (error) {
    logger.error('Error fetching client bookings', { error, clientId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch client bookings' });
  }
});

/**
 * GET /admin/clients/stats/summary
 * Get client statistics summary
 */
router.get('/stats/summary', async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jobs j 
          WHERE j.client_email = client_profiles.user_email 
          AND j.created_at >= NOW() - INTERVAL '30 days'
        )) as active,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_this_month,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM risk_flags rf 
          WHERE rf.user_id = client_profiles.user_id 
          AND rf.active = true
        )) as flagged
      FROM client_profiles
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching client stats', { error });
    res.status(500).json({ error: 'Failed to fetch client stats' });
  }
});

/**
 * POST /admin/clients/:id/credit
 * Grant or deduct credits for a client
 */
router.post('/:id/credit', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason, type } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const creditAmount = type === 'deduct' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    // Add credit transaction
    await query(
      `INSERT INTO credit_ledger 
       (client_id, amount, reason, transaction_type, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, creditAmount, reason, type === 'deduct' ? 'admin_deduction' : 'admin_grant', req.user?.id]
    );

    // Log admin action
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        type === 'deduct' ? 'deduct_client_credit' : 'grant_client_credit',
        'client',
        id,
        JSON.stringify({ amount: creditAmount, reason }),
        req.ip
      ]
    );

    logger.info('Admin modified client credits', {
      adminId: req.user?.id,
      clientId: id,
      amount: creditAmount,
      reason
    });

    res.json({ success: true, message: 'Credit transaction recorded' });
  } catch (error) {
    logger.error('Error modifying client credits', { error, clientId: req.params.id });
    res.status(500).json({ error: 'Failed to modify credits' });
  }
});

export default router;

