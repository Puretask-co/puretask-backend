// src/routes/admin/settings.ts
// Comprehensive Admin Settings Management

import { Router, Response, NextFunction } from 'express';
import { AuthedRequest } from '../../types/express';
import { query } from '../../db/client';
import { jwtAuthMiddleware } from '../../middleware/jwtAuth';
import { requireAdmin, requireSuperAdmin } from '../../middleware/adminAuth';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { validateBody } from '../../lib/validation';

const router = Router();

router.use(jwtAuthMiddleware);
router.use(requireAdmin);

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get admin settings
 *     description: Get all settings grouped by type.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: include_sensitive
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Admin settings
 */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { type, include_sensitive = 'false' } = req.query;

    let queryText = `
      SELECT 
        setting_key,
        setting_value,
        setting_type,
        description,
        is_sensitive,
        requires_restart,
        updated_at
      FROM admin_settings
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (type) {
      conditions.push(`setting_type = $${params.length + 1}`);
      params.push(type);
    }

    // Hide sensitive values unless explicitly requested (super admin only)
    if (include_sensitive !== 'true' || req.user?.role !== 'super_admin') {
      queryText += `
        , CASE 
          WHEN is_sensitive THEN NULL
          ELSE setting_value
        END as display_value
      `;
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ` ORDER BY setting_type, setting_key`;

    const result = await query(queryText, params);

    // Group settings by type
    const grouped: Record<string, any[]> = {};
    result.rows.forEach(row => {
      if (!grouped[row.setting_type]) {
        grouped[row.setting_type] = [];
      }

      // Mask sensitive values
      if (row.is_sensitive && include_sensitive !== 'true') {
        row.setting_value = '***HIDDEN***';
      }

      grouped[row.setting_type].push({
        key: row.setting_key,
        value: row.setting_value,
        description: row.description,
        isSensitive: row.is_sensitive,
        requiresRestart: row.requires_restart,
        updatedAt: row.updated_at
      });
    });

    logger.info('Admin settings retrieved', {
      adminId: req.user?.id,
      type,
      count: result.rows.length
    });

    res.json({
      settings: grouped,
      categories: Object.keys(grouped),
      total: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching admin settings', { error });
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * GET /admin/settings/categories
 * Get list of all setting categories
 */
router.get('/categories', async (req: AuthedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT DISTINCT setting_type, COUNT(*) as count
      FROM admin_settings
      GROUP BY setting_type
      ORDER BY setting_type
    `);

    const categories = result.rows.map(row => ({
      type: row.setting_type,
      count: parseInt(row.count),
      label: formatCategoryLabel(row.setting_type)
    }));

    res.json({ categories });
  } catch (error) {
    logger.error('Error fetching setting categories', { error });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /admin/settings/:key
 * Get specific setting by key
 */
router.get('/:key', async (req: AuthedRequest, res: Response) => {
  try {
    const { key } = req.params;

    const result = await query(
      `SELECT * FROM admin_settings WHERE setting_key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = result.rows[0];

    // Mask sensitive values for non-super admins
    if (setting.is_sensitive && req.user?.role !== 'super_admin') {
      setting.setting_value = '***HIDDEN***';
    }

    res.json({ setting });
  } catch (error) {
    logger.error('Error fetching setting', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

/**
 * PUT /admin/settings/:key
 * Update specific setting
 */
const updateSettingSchema = z.object({
  value: z.any(),
  reason: z.string().optional()
});

router.put('/:key', validateBody(updateSettingSchema), async (req: AuthedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;

    // Check if setting exists
    const existing = await query(
      `SELECT * FROM admin_settings WHERE setting_key = $1`,
      [key]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = existing.rows[0];

    // Sensitive settings can only be updated by super admins
    if (setting.is_sensitive && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Super admin access required to modify sensitive settings'
      });
    }

    // Update setting
    const result = await query(
      `UPDATE admin_settings 
       SET setting_value = $1, last_updated_by = $2, updated_at = NOW()
       WHERE setting_key = $3
       RETURNING *`,
      [JSON.stringify(value), req.user?.id, key]
    );

    // Log the change in settings history (trigger handles this automatically)
    // But we also log to admin audit log
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'update_setting',
        'setting',
        key,
        JSON.stringify({ 
          key, 
          oldValue: setting.setting_value, 
          newValue: value, 
          reason 
        }),
        req.ip
      ]
    );

    logger.warn('Admin setting updated', {
      adminId: req.user?.id,
      settingKey: key,
      reason,
      requiresRestart: setting.requires_restart
    });

    res.json({
      setting: result.rows[0],
      requiresRestart: setting.requires_restart,
      message: setting.requires_restart 
        ? 'Setting updated. Server restart required for changes to take effect.'
        : 'Setting updated successfully.'
    });
  } catch (error) {
    logger.error('Error updating setting', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

/**
 * POST /admin/settings/bulk-update
 * Update multiple settings at once
 */
const bulkUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string(),
    value: z.any()
  })),
  reason: z.string().optional()
});

router.post('/bulk-update', validateBody(bulkUpdateSchema), async (req: AuthedRequest, res: Response) => {
  try {
    const { settings, reason } = req.body;

    const results = [];
    let requiresRestart = false;

    for (const { key, value } of settings) {
      // Check if setting exists and user has permission
      const existing = await query(
        `SELECT * FROM admin_settings WHERE setting_key = $1`,
        [key]
      );

      if (existing.rows.length === 0) {
        results.push({ key, error: 'Setting not found', success: false });
        continue;
      }

      const setting = existing.rows[0];

      if (setting.is_sensitive && req.user?.role !== 'super_admin') {
        results.push({ key, error: 'Super admin required', success: false });
        continue;
      }

      // Update setting
      await query(
        `UPDATE admin_settings 
         SET setting_value = $1, last_updated_by = $2, updated_at = NOW()
         WHERE setting_key = $3`,
        [JSON.stringify(value), req.user?.id, key]
      );

      if (setting.requires_restart) {
        requiresRestart = true;
      }

      results.push({ key, success: true });
    }

    // Log bulk update
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id,
        'bulk_update_settings',
        'settings',
        null,
        JSON.stringify({ settings, reason }),
        req.ip
      ]
    );

    logger.warn('Admin bulk updated settings', {
      adminId: req.user?.id,
      count: settings.length,
      reason
    });

    res.json({
      results,
      requiresRestart,
      message: requiresRestart
        ? 'Settings updated. Server restart required for some changes to take effect.'
        : 'Settings updated successfully.'
    });
  } catch (error) {
    logger.error('Error bulk updating settings', { error });
    res.status(500).json({ error: 'Failed to bulk update settings' });
  }
});

/**
 * GET /admin/settings/:key/history
 * Get change history for a specific setting
 */
router.get('/:key/history', async (req: AuthedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { limit = '50' } = req.query;

    const result = await query(
      `SELECT 
        ash.*,
        u.email as changed_by_email
       FROM admin_settings_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.setting_key = $1
       ORDER BY ash.created_at DESC
       LIMIT $2`,
      [key, parseInt(limit as string)]
    );

    res.json({ history: result.rows });
  } catch (error) {
    logger.error('Error fetching setting history', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to fetch setting history' });
  }
});

/**
 * POST /admin/settings/reset/:key
 * Reset setting to default value
 */
router.post('/reset/:key', requireSuperAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { reason } = req.body;

    // This would require storing default values
    // For now, return error indicating feature needs implementation
    res.status(501).json({
      error: 'Reset to default not yet implemented',
      message: 'Please manually update the setting to desired value'
    });
  } catch (error) {
    logger.error('Error resetting setting', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to reset setting' });
  }
});

/**
 * GET /admin/settings/export
 * Export all settings as JSON
 */
router.get('/export', requireSuperAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT setting_key, setting_value, setting_type, description
      FROM admin_settings
      ORDER BY setting_type, setting_key
    `);

    const settings: Record<string, any> = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        type: row.setting_type,
        description: row.description
      };
    });

    logger.info('Admin exported settings', {
      adminId: req.user?.id,
      count: result.rows.length
    });

    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.email,
      settings
    });
  } catch (error) {
    logger.error('Error exporting settings', { error });
    res.status(500).json({ error: 'Failed to export settings' });
  }
});

/**
 * POST /admin/settings/import
 * Import settings from JSON (super admin only)
 */
router.post('/import', requireSuperAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { settings, overwrite = false } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    const results = [];

    for (const [key, data] of Object.entries(settings as Record<string, any>)) {
      try {
        if (overwrite) {
          await query(
            `UPDATE admin_settings 
             SET setting_value = $1, last_updated_by = $2, updated_at = NOW()
             WHERE setting_key = $3`,
            [JSON.stringify(data.value), req.user?.id, key]
          );
        } else {
          // Only import if setting doesn't exist
          await query(
            `INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, last_updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (setting_key) DO NOTHING`,
            [key, JSON.stringify(data.value), data.type, data.description, req.user?.id]
          );
        }
        results.push({ key, success: true });
      } catch (err) {
        results.push({ key, success: false, error: (err as Error).message });
      }
    }

    logger.warn('Admin imported settings', {
      adminId: req.user?.id,
      count: Object.keys(settings).length,
      overwrite
    });

    res.json({ results, message: 'Settings import completed' });
  } catch (error) {
    logger.error('Error importing settings', { error });
    res.status(500).json({ error: 'Failed to import settings' });
  }
});

// Helper function to format category labels
function formatCategoryLabel(type: string): string {
  const labels: Record<string, string> = {
    platform: 'Platform Configuration',
    booking: 'Booking Rules',
    pricing: 'Pricing & Fees',
    credits: 'Credit System',
    payment: 'Payment Settings',
    payout: 'Payout Settings',
    notifications: 'Notifications',
    email: 'Email Configuration',
    sms: 'SMS Configuration',
    features: 'Feature Flags',
    ai: 'AI Assistant',
    security: 'Security Settings',
    rate_limit: 'Rate Limiting',
    tiers: 'Cleaner Tiers',
    reviews: 'Review System',
    disputes: 'Disputes',
    referral: 'Referral Program',
    analytics: 'Analytics & Tracking',
    api: 'API Configuration',
    webhooks: 'Webhooks',
    backup: 'Backup & Maintenance',
    maintenance: 'Maintenance'
  };

  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export default router;

