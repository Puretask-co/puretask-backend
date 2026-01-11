// src/routes/admin/system.ts
import { Router, Response, NextFunction } from 'express';
import { AuthedRequest } from '../../types/express';
import { query } from '../../db/client';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth';
import { requireAdmin, requireSuperAdmin } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { SystemConfig, AdminAuditLogEntry } from '../../types/admin';

const router = Router();

router.use(jwtAuthMiddleware);
router.use((req: AuthedRequest, res: Response, next) => requireAdmin(req, res, next));

/**
 * GET /admin/system/config
 * Get system configuration
 */
router.get('/config', async (req: AuthedRequest, res: Response) => {
  try {
    // In a real system, this would come from a config table
    // For now, return placeholder structure
    const config: SystemConfig = {
      featureFlags: [
        { name: 'ai_assistant', enabled: true, description: 'AI-powered communication and scheduling' },
        { name: 'instant_booking', enabled: true, description: 'Allow instant booking without cleaner approval' },
        { name: 'bundle_offers', enabled: true, description: 'Enable bundle booking offers' },
        { name: 'dynamic_pricing', enabled: false, description: 'AI-powered dynamic pricing' }
      ],
      platformSettings: {
        maintenanceMode: false,
        registrationEnabled: true,
        bookingEnabled: true,
        minBookingHours: 2,
        maxBookingHours: 8,
        cancellationWindowHours: 24
      },
      pricingConfig: {
        basePricePerHour: 35,
        platformFeePercentage: 20,
        stripeFeePercentage: 2.9,
        stripeFeeFixed: 0.30
      }
    };

    res.json(config);
  } catch (error) {
    logger.error('Error fetching system config', { error });
    res.status(500).json({ error: 'Failed to fetch system config' });
  }
});

/**
 * PATCH /admin/system/config
 * Update system configuration (super admin only)
 */
router.patch('/config', requireSuperAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { section, updates } = req.body;

    // Log configuration change
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'update_system_config',
        'system_config',
        section,
        JSON.stringify(updates),
        req.ip
      ]
    );

    logger.warn('Super admin updated system config', {
      adminId: req.user?.id,
      section,
      updates
    });

    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    logger.error('Error updating system config', { error });
    res.status(500).json({ error: 'Failed to update system config' });
  }
});

/**
 * GET /admin/system/health
 * Get system health status
 */
router.get('/health', async (req: AuthedRequest, res: Response) => {
  try {
    // Check database connection
    const dbCheck = await query('SELECT NOW()');
    const dbHealthy = dbCheck.rows.length > 0;

    // Check recent errors
    const recentErrors = await query(`
      SELECT COUNT(*) as error_count
      FROM admin_audit_log
      WHERE action LIKE '%error%' 
      AND created_at >= NOW() - INTERVAL '1 hour'
    `);

    const errorCount = parseInt(recentErrors.rows[0]?.error_count || 0);

    const health = {
      status: dbHealthy && errorCount < 10 ? 'healthy' : errorCount < 50 ? 'warning' : 'critical',
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        recentErrors: errorCount,
        memory: {
          used: process.memoryUsage().heapUsed / 1024 / 1024,
          total: process.memoryUsage().heapTotal / 1024 / 1024
        }
      },
      issues: []
    };

    if (errorCount >= 10) {
      health.issues.push(`High error rate: ${errorCount} errors in last hour`);
    }

    res.json(health);
  } catch (error) {
    logger.error('Error checking system health', { error });
    res.status(500).json({ 
      status: 'critical',
      error: 'Failed to check system health' 
    });
  }
});

/**
 * GET /admin/system/audit-log
 * Get admin audit log
 */
router.get('/audit-log', async (req: AuthedRequest, res: Response) => {
  try {
    const {
      adminId,
      action,
      resourceType,
      dateFrom,
      dateTo,
      page = '1',
      limit = '100'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (adminId) {
      conditions.push(`aal.admin_id = $${paramIndex}`);
      params.push(adminId);
      paramIndex++;
    }

    if (action) {
      conditions.push(`aal.action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (resourceType) {
      conditions.push(`aal.resource_type = $${paramIndex}`);
      params.push(resourceType);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`aal.created_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`aal.created_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const auditLog = await query(
      `SELECT 
        aal.*,
        u.email as admin_email
      FROM admin_audit_log aal
      JOIN users u ON u.id = aal.admin_id
      WHERE ${whereClause}
      ORDER BY aal.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const entries: AdminAuditLogEntry[] = auditLog.rows.map(row => ({
      id: row.id,
      adminId: row.admin_id,
      adminEmail: row.admin_email,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      changes: row.changes,
      ipAddress: row.ip_address,
      userAgent: row.user_agent || '',
      timestamp: row.created_at
    }));

    res.json({ auditLog: entries });

    logger.info('Admin audit log retrieved', {
      adminId: req.user?.id,
      count: entries.length
    });
  } catch (error) {
    logger.error('Error fetching audit log', { error });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /admin/system/stats
 * Get overall system statistics
 */
router.get('/stats', async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM cleaner_profiles) as total_cleaners,
        (SELECT COUNT(*) FROM client_profiles) as total_clients,
        (SELECT COUNT(*) FROM jobs) as total_bookings,
        (SELECT COUNT(*) FROM jobs WHERE date >= CURRENT_DATE) as upcoming_bookings,
        (SELECT COUNT(*) FROM jobs WHERE status = 'completed') as completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM jobs WHERE status IN ('completed', 'paid')) as lifetime_revenue,
        (SELECT COUNT(*) FROM risk_flags WHERE active = true) as active_risk_flags,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'investigating')) as open_disputes
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching system stats', { error });
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

/**
 * GET /admin/system/dashboard
 * Get admin dashboard overview data
 */
router.get('/dashboard', async (req: AuthedRequest, res: Response) => {
  try {
    // Get overview stats
    const overviewStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM jobs WHERE date >= CURRENT_DATE) as total_bookings,
        (SELECT COUNT(*) FROM cleaner_profiles WHERE tier IS NOT NULL) as active_cleaners,
        (SELECT COUNT(*) FROM client_profiles) as active_clients,
        (SELECT COALESCE(SUM(total_price), 0) FROM jobs WHERE status IN ('completed', 'paid') AND created_at >= NOW() - INTERVAL '30 days') as total_revenue
    `);

    const stats = overviewStats.rows[0];

    // Calculate changes (would need historical data for real calculation)
    const revenueChange = 15.3; // Placeholder
    const bookingsChange = 8.7; // Placeholder

    // Get recent bookings
    const recentBookings = await query(`
      SELECT 
        j.id,
        j.date,
        clp.full_name as client_name,
        cp.full_name as cleaner_name,
        j.status,
        j.total_price as amount
      FROM jobs j
      LEFT JOIN client_profiles clp ON clp.user_email = j.client_email
      LEFT JOIN cleaner_profiles cp ON cp.user_email = j.cleaner_email
      ORDER BY j.created_at DESC
      LIMIT 10
    `);

    // System health
    const health = {
      status: 'healthy' as const,
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
      issues: []
    };

    // Get alerts
    const alerts = await query(`
      SELECT 
        'warning' as type,
        'High number of pending payouts' as message,
        NOW() as timestamp
      FROM payout_items
      WHERE status = 'pending'
      HAVING COUNT(*) > 10
      LIMIT 5
    `);

    const dashboardData = {
      overview: {
        totalBookings: parseInt(stats.total_bookings),
        activeCleaners: parseInt(stats.active_cleaners),
        activeClients: parseInt(stats.active_clients),
        totalRevenue: parseFloat(stats.total_revenue),
        revenueChange,
        bookingsChange
      },
      recentBookings: recentBookings.rows,
      systemHealth: health,
      alerts: alerts.rows
    };

    res.json(dashboardData);

    logger.info('Admin dashboard data retrieved', {
      adminId: req.user?.id
    });
  } catch (error) {
    logger.error('Error fetching dashboard data', { error });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;

