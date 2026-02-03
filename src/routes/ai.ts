// src/routes/ai.ts
// AI Assistant API Routes

import { Router, Response } from 'express';
import { requireAuth, AuthedRequest, authedHandler } from '../middleware/authCanonical';
import { validateBody } from '../lib/validation';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { AICommunicationService } from '../services/aiCommunication';
import { AISchedulingService } from '../services/aiScheduling';
import { query } from '../db/client';

const aiRouter = Router();

// All routes require authentication
aiRouter.use(requireAuth);

/**
 * @swagger
 * /ai/settings:
 *   get:
 *     summary: Get AI settings
 *     description: Get cleaner's AI communication settings.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI settings
 *       404:
 *         description: Cleaner profile not found
 */
aiRouter.get('/settings', authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT communication_settings, ai_onboarding_completed, ai_features_active_count
       FROM cleaner_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cleaner profile not found' } });
      return;
    }

    res.json({ settings: result.rows[0] });
  } catch (error) {
    logger.error('get_ai_settings_failed', { error, userId: req.user?.id });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * @swagger
 * /ai/settings:
 *   put:
 *     summary: Update AI settings
 *     description: Update cleaner's AI communication settings.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               communication_settings: { type: 'object' }
 *               ai_onboarding_completed: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Settings updated
 */
const updateSettingsSchema = z.object({
  communication_settings: z.record(z.any()).optional(),
  ai_onboarding_completed: z.boolean().optional()
});

aiRouter.put('/settings', validateBody(updateSettingsSchema), authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { communication_settings, ai_onboarding_completed } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (communication_settings) {
      updates.push(`communication_settings = $${paramCount}`);
      values.push(JSON.stringify(communication_settings));
      paramCount++;
    }

    if (ai_onboarding_completed !== undefined) {
      updates.push(`ai_onboarding_completed = $${paramCount}`);
      values.push(ai_onboarding_completed);
      paramCount++;
    }

    updates.push(`last_ai_interaction_at = NOW()`);
    values.push(userId);

    const result = await query(
      `UPDATE cleaner_profiles
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING communication_settings, ai_onboarding_completed, ai_features_active_count`,
      values
    );

    logger.info('ai_settings_updated', { userId });

    res.json({ settings: result.rows[0] });
  } catch (error) {
    logger.error('update_ai_settings_failed', { error, userId: req.user?.id });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * @swagger
 * /ai/suggest-slots:
 *   post:
 *     summary: Get AI-suggested time slots
 *     description: Get AI-suggested booking time slots based on cleaner availability and preferences.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - cleaner_id
 *             properties:
 *               client_id: { type: 'string' }
 *               cleaner_id: { type: 'string' }
 *               preferred_date: { type: 'string', format: 'date' }
 *               duration_hours: { type: 'number' }
 *     responses:
 *       200:
 *         description: Suggested time slots
 */
const suggestSlotsSchema = z.object({
  client_id: z.string(),
  cleaner_id: z.string(),
  cleaning_type: z.string(),
  estimated_hours: z.number().min(1).max(12),
  preferred_dates: z.array(z.string()).optional(),
  address: z.string(),
  entry_instructions: z.string().optional(),
  client_preferences: z.record(z.any()).optional()
});

aiRouter.post('/suggest-slots', validateBody(suggestSlotsSchema), authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const result = await AISchedulingService.suggestBookingSlots(req.body);

    res.json(result);
  } catch (error) {
    logger.error('suggest_slots_failed', { error, body: req.body });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * POST /ai/process-client-response
 * Process client's response to booking suggestions
 */
const clientResponseSchema = z.object({
  booking_id: z.string().uuid(),
  response_type: z.enum(['selected_slot', 'suggest_other', 'not_interested']),
  selected_slot: z.object({
    date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    reasoning: z.string(),
    fills_gap: z.boolean()
  }).optional()
});

aiRouter.post('/process-client-response', validateBody(clientResponseSchema), authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { booking_id, response_type, selected_slot } = req.body;

    // Get booking to verify client ownership
    const bookingResult = await query(
      `SELECT client_id, cleaner_id FROM jobs WHERE id = $1`,
      [booking_id]
    );

    if (bookingResult.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
      return;
    }

    const booking = bookingResult.rows[0];

    if (booking.client_id !== userId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      return;
    }

    const result = await AISchedulingService.processClientResponse({
      booking_id,
      client_id: userId,
      cleaner_id: booking.cleaner_id,
      response_type,
      selected_slot
    });

    res.json(result);
  } catch (error) {
    logger.error('process_client_response_failed', { error, body: req.body });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * POST /ai/send-message
 * Send automated message (for testing/manual trigger)
 */
const sendMessageSchema = z.object({
  client_id: z.string(),
  message_type: z.string(),
  booking_id: z.string().uuid().optional(),
  custom_data: z.record(z.any()).optional()
});

aiRouter.post('/send-message', validateBody(sendMessageSchema), authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { client_id, message_type, booking_id, custom_data } = req.body;

    const result = await AICommunicationService.sendMessage({
      cleaner_id: userId,
      client_id,
      message_type,
      booking_id,
      custom_data
    });

    res.json(result);
  } catch (error) {
    logger.error('send_message_failed', { error, body: req.body });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * GET /ai/insights
 * Get AI-powered dashboard insights
 */
aiRouter.get('/insights', authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get pending bookings awaiting approval
    const pendingResult = await query(
      `SELECT id, client_id, scheduled_start_at, hours, address, cleaning_type, total_price,
              ai_match_score, ai_match_reasoning
       FROM jobs
       WHERE cleaner_id = $1
       AND status = 'awaiting_cleaner_approval'
       AND provisional_slot_expires_at > NOW()
       ORDER BY ai_match_score DESC NULLS LAST
       LIMIT 5`,
      [userId]
    );

    // Get schedule gaps
    const gapsResult = await query(
      `SELECT date, start_time, end_time
       FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', '1 day'::interval) date
       WHERE NOT EXISTS (
         SELECT 1 FROM jobs
         WHERE cleaner_id = $1
         AND DATE(scheduled_start_at) = date
       )
       LIMIT 3`,
      [userId]
    );

    // Get cleaner profile for performance snapshot
    const profileResult = await query(
      `SELECT reliability_score, tier, ai_features_active_count
       FROM cleaner_profiles
       WHERE user_id = $1`,
      [userId]
    );

    // Get recent AI activity
    const activityResult = await query(
      `SELECT activity_description, created_at
       FROM ai_activity_log
       WHERE actor_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      pending_requests: pendingResult.rows,
      schedule_gaps: gapsResult.rows,
      performance_snapshot: profileResult.rows[0] || {},
      recent_activity: activityResult.rows.map(r => r.activity_description)
    });
  } catch (error) {
    logger.error('get_insights_failed', { error, userId: req.user?.id });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

/**
 * POST /ai/generate-response
 * Generate AI response suggestions for messages
 */
const generateResponseSchema = z.object({
  client_message: z.string(),
  booking_id: z.string().uuid().optional(),
  scenario: z.enum(['on_my_way', 'confirm_details', 'running_late', 'job_complete']).optional()
});

aiRouter.post('/generate-response', validateBody(generateResponseSchema), authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { client_message, booking_id, scenario } = req.body;

    // Get cleaner profile for context
    const profileResult = await query(
      `SELECT first_name || ' ' || last_name as full_name, tier, specialty_tags
       FROM cleaner_profiles
       WHERE user_id = $1`,
      [userId]
    );

    const cleaner = profileResult.rows[0];

    // Build prompt based on scenario or message
    let prompt = `You are a professional cleaning service provider responding to a client.

Cleaner: ${cleaner.full_name} (${cleaner.tier})
Specialties: ${cleaner.specialty_tags?.join(', ') || 'General cleaning'}

Client Message: "${client_message}"

Generate 3 response options:
1. Professional and detailed
2. Friendly and warm
3. Quick and concise

Return ONLY valid JSON:
{
  "responses": [
    {
      "text": "Response text here",
      "style": "Professional",
      "tone": "Helpful"
    }
  ]
}`;

    // Call OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for cleaners.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 800
    });

    const responseText = completion.choices[0].message.content || '{}';
    const aiResponse = JSON.parse(responseText);

    res.json(aiResponse);
  } catch (error) {
    logger.error('generate_response_failed', { error, body: req.body });
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: (error as Error).message } });
  }
}));

export default aiRouter;

