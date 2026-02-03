// src/routes/admin/messages.ts
import { Router, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from '../../middleware/authCanonical';
import { query } from '../../db/client';
import { logger } from '../../lib/logger';
import { MessageLogItem } from '../../types/admin';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /admin/messages/log:
 *   get:
 *     summary: Get message delivery log
 *     description: Get message delivery log with filters.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: messageType
 *         schema:
 *           type: string
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Message delivery log
 */
router.get('/log', authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const {
      messageType,
      cleanerId,
      clientId,
      dateFrom,
      dateTo,
      page = '1',
      limit = '100'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (messageType) {
      conditions.push(`mdl.message_type = $${paramIndex}`);
      params.push(messageType);
      paramIndex++;
    }

    if (cleanerId) {
      conditions.push(`mdl.cleaner_id = $${paramIndex}`);
      params.push(cleanerId);
      paramIndex++;
    }

    if (clientId) {
      conditions.push(`mdl.client_id = $${paramIndex}`);
      params.push(clientId);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`mdl.sent_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`mdl.sent_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const messages = await query(
      `SELECT 
        mdl.*,
        cp.full_name as cleaner_name,
        clp.full_name as client_name
      FROM message_delivery_log mdl
      LEFT JOIN cleaner_profiles cp ON cp.user_id = mdl.cleaner_id
      LEFT JOIN client_profiles clp ON clp.user_id = mdl.client_id
      WHERE ${whereClause}
      ORDER BY mdl.sent_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const messageLog: MessageLogItem[] = messages.rows.map(row => ({
      id: row.id,
      messageType: row.message_type,
      cleanerId: row.cleaner_id,
      cleanerName: row.cleaner_name,
      clientId: row.client_id,
      clientName: row.client_name,
      bookingId: row.booking_id,
      channels: row.channels,
      deliveryResults: row.delivery_results,
      sentAt: row.sent_at,
      openedAt: row.opened_at,
      clickedAt: row.clicked_at
    }));

    res.json({ messages: messageLog });

    logger.info('Admin messages log retrieved', {
      adminId: req.user?.id,
      count: messageLog.length
    });
  } catch (error) {
    logger.error('Error fetching message log', { error });
    res.status(500).json({ error: 'Failed to fetch message log' });
  }
}));

/**
 * GET /admin/messages/stats
 * Get message delivery statistics
 */
router.get('/stats', authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const stats = await query(`
      SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicked,
        COUNT(DISTINCT message_type) as unique_message_types,
        COUNT(DISTINCT cleaner_id) as active_cleaners,
        json_agg(DISTINCT message_type) as message_types
      FROM message_delivery_log
      WHERE sent_at >= $1
    `, [startDate]);

    const byType = await query(`
      SELECT 
        message_type,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked
      FROM message_delivery_log
      WHERE sent_at >= $1
      GROUP BY message_type
      ORDER BY sent DESC
    `, [startDate]);

    res.json({
      summary: stats.rows[0],
      byType: byType.rows
    });
  } catch (error) {
    logger.error('Error fetching message stats', { error });
    res.status(500).json({ error: 'Failed to fetch message stats' });
  }
}));

/**
 * GET /admin/messages/templates
 * Get all message templates
 */
router.get('/templates', authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    // This would come from a templates table if we have one
    // For now, return a placeholder structure
    const templates = [
      {
        id: 'booking_confirmation',
        name: 'Booking Confirmation',
        type: 'automated',
        subject: 'Booking Confirmed',
        body: 'Hi {client_name}! Your cleaning is confirmed...',
        variables: ['client_name', 'date', 'time', 'cleaner_name'],
        channels: ['email', 'sms', 'in_app'],
        enabled: true
      },
      {
        id: 'pre_cleaning_reminder',
        name: 'Pre-Cleaning Reminder',
        type: 'automated',
        subject: 'Reminder: Cleaning Tomorrow',
        body: 'Hi {client_name}! Reminder that {cleaner_name} will be...',
        variables: ['client_name', 'cleaner_name', 'date', 'time'],
        channels: ['email', 'sms'],
        enabled: true
      }
    ];

    res.json({ templates });
  } catch (error) {
    logger.error('Error fetching templates', { error });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}));

export default router;

