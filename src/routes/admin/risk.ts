// src/routes/admin/risk.ts
import { Router, Response, NextFunction } from 'express';
import { AuthedRequest } from '../../types/express';
import { query } from '../../db/client';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth';
import { requireAdmin } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { RiskManagementData } from '../../types/admin';

const router = Router();

router.use(jwtAuthMiddleware);
router.use((req: AuthedRequest, res: Response, next) => requireAdmin(req, res, next));

/**
 * @swagger
 * /admin/risk/overview:
 *   get:
 *     summary: Get risk overview
 *     description: Get risk management overview including flagged clients/cleaners, disputes, safety incidents.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Risk overview
 */
router.get('/overview', async (req: AuthedRequest, res: Response) => {
  try {
    // Flagged clients
    const flaggedClientsResult = await query(`
      SELECT 
        cp.user_id as id,
        cp.full_name as name,
        cp.user_email as email,
        json_agg(json_build_object(
          'type', rf.flag_type,
          'reason', rf.reason,
          'severity', rf.severity,
          'createdAt', rf.created_at
        )) as flags,
        booking_stats.total_bookings,
        COALESCE(dispute_stats.dispute_count, 0) as dispute_count
      FROM client_profiles cp
      JOIN risk_flags rf ON rf.user_id = cp.user_id AND rf.active = true
      LEFT JOIN (
        SELECT client_email, COUNT(*) as total_bookings
        FROM jobs GROUP BY client_email
      ) booking_stats ON booking_stats.client_email = cp.user_email
      LEFT JOIN (
        SELECT initiator_id, COUNT(*) as dispute_count
        FROM disputes WHERE initiator_type = 'client'
        GROUP BY initiator_id
      ) dispute_stats ON dispute_stats.initiator_id = cp.user_id
      GROUP BY cp.user_id, cp.full_name, cp.user_email, booking_stats.total_bookings, dispute_stats.dispute_count
      ORDER BY array_length(array_agg(rf.id), 1) DESC
      LIMIT 50
    `);

    // Flagged cleaners
    const flaggedCleanersResult = await query(`
      SELECT 
        cp.user_id as id,
        cp.full_name as name,
        cp.user_email as email,
        cp.reliability_score,
        json_agg(json_build_object(
          'type', rf.flag_type,
          'reason', rf.reason,
          'severity', rf.severity,
          'createdAt', rf.created_at
        )) as flags
      FROM cleaner_profiles cp
      JOIN risk_flags rf ON rf.user_id = cp.user_id AND rf.active = true
      GROUP BY cp.user_id, cp.full_name, cp.user_email, cp.reliability_score
      ORDER BY array_length(array_agg(rf.id), 1) DESC
      LIMIT 50
    `);

    // Disputes
    const disputesResult = await query(`
      SELECT 
        d.id,
        d.booking_id,
        d.initiator_type as initiator,
        d.subject,
        d.status,
        d.created_at
      FROM disputes d
      WHERE d.status IN ('open', 'investigating')
      ORDER BY d.created_at DESC
      LIMIT 50
    `);

    // Safety incidents
    const safetyIncidentsResult = await query(`
      SELECT 
        si.id,
        u.email as reported_by,
        si.incident_type,
        si.severity,
        si.status,
        si.created_at
      FROM safety_incidents si
      JOIN users u ON u.id = si.reported_by_id
      WHERE si.status != 'resolved'
      ORDER BY 
        CASE si.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        si.created_at DESC
      LIMIT 50
    `);

    const riskData: RiskManagementData = {
      flaggedClients: flaggedClientsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        flags: Array.isArray(row.flags) ? row.flags : [],
        totalBookings: parseInt(row.total_bookings || 0),
        disputeCount: parseInt(row.dispute_count)
      })),
      flaggedCleaners: flaggedCleanersResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        flags: Array.isArray(row.flags) ? row.flags : [],
        reliabilityScore: parseFloat(row.reliability_score || 0)
      })),
      disputes: disputesResult.rows.map(row => ({
        id: row.id,
        bookingId: row.booking_id,
        initiator: row.initiator,
        subject: row.subject,
        status: row.status,
        createdAt: row.created_at
      })),
      safetyIncidents: safetyIncidentsResult.rows.map(row => ({
        id: row.id,
        reportedBy: row.reported_by,
        incidentType: row.incident_type,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at
      }))
    };

    logger.info('Admin risk overview retrieved', {
      adminId: req.user?.id
    });

    res.json(riskData);
  } catch (error) {
    logger.error('Error fetching risk overview', { error });
    res.status(500).json({ error: 'Failed to fetch risk overview' });
  }
});

/**
 * GET /admin/risk/flags
 * Get all risk flags with filters
 */
router.get('/flags', async (req: AuthedRequest, res: Response) => {
  try {
    const { userId, severity, active = 'true', page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`rf.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (severity) {
      conditions.push(`rf.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    if (active === 'true') {
      conditions.push(`rf.active = true`);
    } else if (active === 'false') {
      conditions.push(`rf.active = false`);
    }

    const whereClause = conditions.join(' AND ');

    const flags = await query(
      `SELECT 
        rf.*,
        u.email as user_email,
        cp.full_name as client_name,
        clp.full_name as cleaner_name
      FROM risk_flags rf
      JOIN users u ON u.id = rf.user_id
      LEFT JOIN client_profiles cp ON cp.user_id = rf.user_id
      LEFT JOIN cleaner_profiles clp ON clp.user_id = rf.user_id
      WHERE ${whereClause}
      ORDER BY rf.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    res.json({ flags: flags.rows });
  } catch (error) {
    logger.error('Error fetching risk flags', { error });
    res.status(500).json({ error: 'Failed to fetch risk flags' });
  }
});

/**
 * POST /admin/risk/flags
 * Create a new risk flag
 */
router.post('/flags', async (req: AuthedRequest, res: Response) => {
  try {
    const { userId, flagType, reason, severity, metadata } = req.body;

    const result = await query(
      `INSERT INTO risk_flags 
       (user_id, flag_type, reason, severity, metadata, flagged_by, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING *`,
      [userId, flagType, reason, severity, metadata || {}, req.user?.id]
    );

    // Log admin action
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'create_risk_flag',
        'risk_flag',
        result.rows[0].id,
        JSON.stringify({ userId, flagType, reason, severity }),
        req.ip
      ]
    );

    logger.warn('Admin created risk flag', {
      adminId: req.user?.id,
      userId,
      flagType,
      severity
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating risk flag', { error });
    res.status(500).json({ error: 'Failed to create risk flag' });
  }
});

/**
 * PATCH /admin/risk/flags/:id/resolve
 * Resolve a risk flag
 */
router.patch('/flags/:id/resolve', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const result = await query(
      `UPDATE risk_flags 
       SET active = false, resolved_at = NOW(), resolved_by = $1, resolution = $2
       WHERE id = $3
       RETURNING *`,
      [req.user?.id, resolution, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk flag not found' });
    }

    logger.info('Admin resolved risk flag', {
      adminId: req.user?.id,
      flagId: id
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error resolving risk flag', { error });
    res.status(500).json({ error: 'Failed to resolve risk flag' });
  }
});

/**
 * GET /admin/risk/disputes
 * Get all disputes with filters
 */
router.get('/disputes', async (req: AuthedRequest, res: Response) => {
  try {
    const { status, bookingId, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`d.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (bookingId) {
      conditions.push(`d.booking_id = $${paramIndex}`);
      params.push(bookingId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const disputes = await query(
      `SELECT 
        d.*,
        j.date as booking_date,
        j.address as booking_address,
        cp.full_name as client_name,
        clp.full_name as cleaner_name
      FROM disputes d
      LEFT JOIN jobs j ON j.id = d.booking_id
      LEFT JOIN client_profiles cp ON cp.user_id = d.initiator_id AND d.initiator_type = 'client'
      LEFT JOIN cleaner_profiles clp ON clp.user_id = d.initiator_id AND d.initiator_type = 'cleaner'
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    res.json({ disputes: disputes.rows });
  } catch (error) {
    logger.error('Error fetching disputes', { error });
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

/**
 * PATCH /admin/risk/disputes/:id/status
 * Update dispute status
 */
router.patch('/disputes/:id/status', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE disputes 
       SET status = $1, resolution = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, resolution, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    logger.info('Admin updated dispute status', {
      adminId: req.user?.id,
      disputeId: id,
      status
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating dispute status', { error });
    res.status(500).json({ error: 'Failed to update dispute status' });
  }
});

/**
 * GET /admin/risk/safety-incidents
 * Get all safety incidents
 */
router.get('/safety-incidents', async (req: AuthedRequest, res: Response) => {
  try {
    const { severity, status, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (severity) {
      conditions.push(`si.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    if (status) {
      conditions.push(`si.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const incidents = await query(
      `SELECT 
        si.*,
        u.email as reported_by_email,
        j.date as booking_date,
        j.address as booking_address
      FROM safety_incidents si
      JOIN users u ON u.id = si.reported_by_id
      LEFT JOIN jobs j ON j.id = si.booking_id
      WHERE ${whereClause}
      ORDER BY 
        CASE si.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        si.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    res.json({ incidents: incidents.rows });
  } catch (error) {
    logger.error('Error fetching safety incidents', { error });
    res.status(500).json({ error: 'Failed to fetch safety incidents' });
  }
});

/**
 * GET /admin/risk/stats
 * Get risk management statistics
 */
router.get('/stats', async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM risk_flags WHERE active = true) as active_flags,
        (SELECT COUNT(*) FROM risk_flags WHERE active = true AND severity = 'high') as high_severity_flags,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'investigating')) as open_disputes,
        (SELECT COUNT(*) FROM safety_incidents WHERE status != 'resolved') as unresolved_incidents,
        (SELECT COUNT(*) FROM safety_incidents WHERE severity = 'critical' AND status != 'resolved') as critical_incidents
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching risk stats', { error });
    res.status(500).json({ error: 'Failed to fetch risk stats' });
  }
});

export default router;

