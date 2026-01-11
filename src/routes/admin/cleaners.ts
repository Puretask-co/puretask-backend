// src/routes/admin/cleaners.ts
import { Router, Response, NextFunction } from 'express';
import { AuthedRequest } from '../../types/express';
import { query } from '../../db/client';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth';
import { requireAdmin } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { CleanerManagementItem } from '../../types/admin';

const router = Router();

router.use(jwtAuthMiddleware);
router.use((req: AuthedRequest, res: Response, next) => requireAdmin(req, res, next));

/**
 * GET /admin/cleaners
 * Get paginated list of cleaners with filters
 */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const {
      tier,
      status,
      search,
      minRating,
      verified,
      page = '1',
      limit = '50',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (tier) {
      conditions.push(`cp.tier = $${paramIndex}`);
      params.push(tier);
      paramIndex++;
    }

    if (status) {
      // Determine status based on last activity
      if (status === 'active') {
        conditions.push(`u.last_login_at >= NOW() - INTERVAL '30 days'`);
      } else if (status === 'inactive') {
        conditions.push(`u.last_login_at < NOW() - INTERVAL '30 days' OR u.last_login_at IS NULL`);
      }
    }

    if (minRating) {
      conditions.push(`cp.average_rating >= $${paramIndex}`);
      params.push(parseFloat(minRating as string));
      paramIndex++;
    }

    if (verified === 'true') {
      conditions.push(`cp.verified_badge = true`);
    } else if (verified === 'false') {
      conditions.push(`cp.verified_badge = false`);
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

    const whereClause = conditions.join(' AND ');

    const validSortColumns: Record<string, string> = {
      name: 'cp.full_name',
      email: 'cp.user_email',
      tier: 'cp.tier',
      rating: 'cp.average_rating',
      score: 'cp.reliability_score',
      createdAt: 'cp.created_at',
      earnings: 'total_earnings'
    };

    const sortColumn = validSortColumns[sortBy as string] || 'cp.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM cleaner_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE ${whereClause}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].total);

    // Get cleaners with aggregated data
    const cleanersResult = await query(
      `SELECT 
        cp.id,
        cp.user_id,
        cp.full_name,
        cp.user_email,
        cp.phone,
        cp.tier,
        cp.reliability_score,
        cp.average_rating,
        cp.verified_badge,
        cp.instant_book_enabled,
        cp.specialty_tags,
        cp.service_locations,
        cp.ai_onboarding_completed,
        cp.ai_features_active_count,
        cp.created_at,
        u.last_login_at,
        COALESCE(job_stats.total_jobs, 0) as total_jobs,
        COALESCE(job_stats.total_earnings, 0) as total_earnings,
        CASE 
          WHEN u.last_login_at >= NOW() - INTERVAL '30 days' THEN 'active'
          ELSE 'inactive'
        END as status
      FROM cleaner_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN (
        SELECT 
          cleaner_email,
          COUNT(*) as total_jobs,
          SUM(total_price) as total_earnings
        FROM jobs
        WHERE status IN ('completed', 'paid')
        GROUP BY cleaner_email
      ) job_stats ON job_stats.cleaner_email = cp.user_email
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const cleaners: CleanerManagementItem[] = cleanersResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.user_email,
      phone: row.phone,
      tier: row.tier,
      reliabilityScore: parseFloat(row.reliability_score || 0),
      averageRating: parseFloat(row.average_rating || 0),
      totalJobs: parseInt(row.total_jobs),
      totalEarnings: parseFloat(row.total_earnings),
      status: row.status,
      verifiedBadge: row.verified_badge,
      instantBookEnabled: row.instant_book_enabled,
      specialtyTags: row.specialty_tags || [],
      serviceLocations: row.service_locations || [],
      aiOnboardingCompleted: row.ai_onboarding_completed,
      aiFeaturesActiveCount: parseInt(row.ai_features_active_count || 0),
      createdAt: row.created_at,
      lastActiveAt: row.last_login_at
    }));

    res.json({
      cleaners,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });

    logger.info('Admin cleaners list retrieved', {
      adminId: req.user?.id,
      count: cleaners.length
    });
  } catch (error) {
    logger.error('Error fetching admin cleaners', { error });
    res.status(500).json({ error: 'Failed to fetch cleaners' });
  }
});

/**
 * GET /admin/cleaners/:id
 * Get detailed cleaner information
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
        job_stats.total_jobs,
        job_stats.completed_jobs,
        job_stats.cancelled_jobs,
        job_stats.total_earnings,
        job_stats.avg_job_value,
        review_stats.total_reviews,
        review_stats.avg_rating as review_avg_rating
      FROM cleaner_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN (
        SELECT 
          cleaner_email,
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
          SUM(total_price) FILTER (WHERE status IN ('completed', 'paid')) as total_earnings,
          AVG(total_price) as avg_job_value
        FROM jobs
        GROUP BY cleaner_email
      ) job_stats ON job_stats.cleaner_email = cp.user_email
      LEFT JOIN (
        SELECT 
          cleaner_email,
          COUNT(*) as total_reviews,
          AVG(rating) as avg_rating
        FROM reviews
        GROUP BY cleaner_email
      ) review_stats ON review_stats.cleaner_email = cp.user_email
      WHERE cp.user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching cleaner details', { error, cleanerId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch cleaner details' });
  }
});

/**
 * PATCH /admin/cleaners/:id/verified-badge
 * Toggle verified badge for cleaner
 */
router.patch('/:id/verified-badge', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    const result = await query(
      `UPDATE cleaner_profiles 
       SET verified_badge = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [verified, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    logger.info('Admin toggled verified badge', {
      adminId: req.user?.id,
      cleanerId: id,
      verified
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating verified badge', { error, cleanerId: req.params.id });
    res.status(500).json({ error: 'Failed to update verified badge' });
  }
});

/**
 * PATCH /admin/cleaners/:id/tier
 * Update cleaner tier (admin override)
 */
router.patch('/:id/tier', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tier, reason } = req.body;

    const validTiers = ['Rookie', 'Semi Pro', 'Pro', 'Gold', 'Platinum'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const result = await query(
      `UPDATE cleaner_profiles 
       SET tier = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [tier, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    // Log admin action
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'update_cleaner_tier',
        'cleaner',
        id,
        JSON.stringify({ tier, reason }),
        req.ip
      ]
    );

    logger.info('Admin updated cleaner tier', {
      adminId: req.user?.id,
      cleanerId: id,
      tier,
      reason
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating cleaner tier', { error, cleanerId: req.params.id });
    res.status(500).json({ error: 'Failed to update tier' });
  }
});

/**
 * GET /admin/cleaners/stats/summary
 * Get cleaner statistics summary
 */
router.get('/stats/summary', async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tier = 'Rookie') as rookie,
        COUNT(*) FILTER (WHERE tier = 'Semi Pro') as semi_pro,
        COUNT(*) FILTER (WHERE tier = 'Pro') as pro,
        COUNT(*) FILTER (WHERE tier = 'Gold') as gold,
        COUNT(*) FILTER (WHERE tier = 'Platinum') as platinum,
        COUNT(*) FILTER (WHERE verified_badge = true) as verified,
        COUNT(*) FILTER (WHERE ai_onboarding_completed = true) as ai_enabled,
        AVG(average_rating) as avg_rating,
        AVG(reliability_score) as avg_reliability_score
      FROM cleaner_profiles
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching cleaner stats', { error });
    res.status(500).json({ error: 'Failed to fetch cleaner stats' });
  }
});

/**
 * POST /admin/cleaners/:id/suspend
 * Suspend a cleaner account
 */
router.post('/:id/suspend', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, duration } = req.body;

    // Update user status
    await query(
      `UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Log suspension
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'suspend_cleaner',
        'cleaner',
        id,
        JSON.stringify({ reason, duration }),
        req.ip
      ]
    );

    logger.warn('Admin suspended cleaner', {
      adminId: req.user?.id,
      cleanerId: id,
      reason,
      duration
    });

    res.json({ success: true, message: 'Cleaner suspended' });
  } catch (error) {
    logger.error('Error suspending cleaner', { error, cleanerId: req.params.id });
    res.status(500).json({ error: 'Failed to suspend cleaner' });
  }
});

export default router;

