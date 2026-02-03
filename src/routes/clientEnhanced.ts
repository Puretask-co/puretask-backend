// src/routes/clientEnhanced.ts
// Enhanced client routes for improvements

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, requireRole, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { query } from "../db/client";

const clientEnhancedRouter = Router();

clientEnhancedRouter.use(requireAuth);
clientEnhancedRouter.use(requireRole("client", "admin"));

// ============================================
// DRAFT BOOKINGS
// ============================================

/**
 * @swagger
 * /client/bookings/draft:
 *   post:
 *     summary: Save draft booking
 *     description: Save a draft booking for later completion (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *               scheduled_start_at:
 *                 type: string
 *                 format: date-time
 *               scheduled_end_at:
 *                 type: string
 *                 format: date-time
 *               service_type:
 *                 type: string
 *               duration_hours:
 *                 type: number
 *               add_ons:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft saved successfully
 *       403:
 *         description: Forbidden - clients only
 */
const saveDraftSchema = z.object({
  address: z.string().optional(),
  scheduled_start_at: z.string().optional(),
  scheduled_end_at: z.string().optional(),
  service_type: z.string().optional(),
  duration_hours: z.number().optional(),
  add_ons: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

clientEnhancedRouter.post(
  "/bookings/draft",
  validateBody(saveDraftSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const draft = req.body;

      // Store draft in user preferences or a drafts table
      // For now, we'll use a simple JSONB column in client_profiles
      await query(
        `
        UPDATE client_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('draft_booking', $1::jsonb),
            updated_at = NOW()
        WHERE user_id = $2
        `,
        [JSON.stringify(draft), clientId]
      );

      res.json({ success: true, draft });
    } catch (error) {
      logger.error("save_draft_booking_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SAVE_DRAFT_FAILED", message: "Failed to save draft" },
      });
    }
  }
));

/**
 * @swagger
 * /client/bookings/draft:
 *   get:
 *     summary: Get draft booking
 *     description: Get saved draft booking (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Draft booking data
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/bookings/draft", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const result = await query(
      `
      SELECT metadata->'draft_booking' as draft_booking
      FROM client_profiles
      WHERE user_id = $1
      `,
      [clientId]
    );

    const draft = result.rows[0]?.draft_booking || null;

    res.json({ draft });
  } catch (error) {
    logger.error("get_draft_booking_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_DRAFT_FAILED", message: "Failed to get draft" },
    });
  }
}));

// ============================================
// DASHBOARD INSIGHTS
// ============================================

/**
 * @swagger
 * /client/dashboard/insights:
 *   get:
 *     summary: Get dashboard insights
 *     description: Get personalized insights for client dashboard (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard insights
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/dashboard/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    // Get booking patterns
    const bookingPatterns = await query(
      `
      SELECT 
        EXTRACT(DOW FROM scheduled_start_at) as day_of_week,
        EXTRACT(HOUR FROM scheduled_start_at) as hour,
        COUNT(*) as count
      FROM jobs
      WHERE client_id = $1 AND status = 'completed'
      GROUP BY day_of_week, hour
      ORDER BY count DESC
      LIMIT 3
      `,
      [clientId]
    );

    // Get favorite cleaner
    const favoriteCleaner = await query(
      `
      SELECT 
        fc.cleaner_id,
        u.email,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
        COUNT(j.id) as booking_count
      FROM favorite_cleaners fc
      INNER JOIN jobs j ON j.cleaner_id = fc.cleaner_id AND j.client_id = $1
      INNER JOIN users u ON u.id = fc.cleaner_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
      WHERE fc.client_id = $1
      GROUP BY fc.cleaner_id, u.email, cp.first_name, cp.last_name
      ORDER BY booking_count DESC
      LIMIT 1
      `,
      [clientId]
    );

    // Get last booking date
    const lastBooking = await query(
      `
      SELECT scheduled_start_at, cleaner_id
      FROM jobs
      WHERE client_id = $1
      ORDER BY scheduled_start_at DESC
      LIMIT 1
      `,
      [clientId]
    );

    // Get credit expiration (if applicable)
    const creditExpiration = await query(
      `
      SELECT MIN(expires_at) as next_expiration
      FROM credit_ledger
      WHERE user_id = $1 AND expires_at > NOW() AND balance > 0
      `,
      [clientId]
    );

    const insights = {
      bookingPatterns: bookingPatterns.rows.map((row) => ({
        dayOfWeek: parseInt(row.day_of_week),
        hour: parseInt(row.hour),
        count: parseInt(row.count),
      })),
      favoriteCleaner: favoriteCleaner.rows[0] || null,
      lastBooking: lastBooking.rows[0] || null,
      creditExpiration: creditExpiration.rows[0]?.next_expiration || null,
    };

    res.json({ insights });
  } catch (error) {
    logger.error("get_dashboard_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

/**
 * @swagger
 * /client/dashboard/cleaner-preferences:
 *   get:
 *     summary: Get cleaner recommendations
 *     description: Get cleaner recommendations based on preferences (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleaner recommendations
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get(
  "/dashboard/recommendations",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      // Get cleaners similar to favorites
      const similarCleaners = await query(
        `
        SELECT DISTINCT
          u.id,
          cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
          cp.avatar_url,
          cp.base_rate_cph,
          COALESCE(avg_reviews.avg_rating, 0) as rating,
          COALESCE(avg_reviews.review_count, 0) as reviews_count
        FROM favorite_cleaners fc
        INNER JOIN users u ON u.id = fc.cleaner_id
        LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
        LEFT JOIN (
          SELECT 
            reviewee_id,
            AVG(rating)::numeric(3,2) as avg_rating,
            COUNT(*) as review_count
          FROM reviews
          WHERE reviewer_type = 'client'
          GROUP BY reviewee_id
        ) avg_reviews ON avg_reviews.reviewee_id = u.id
        WHERE fc.client_id = $1
        LIMIT 5
        `,
        [clientId]
      );

      // Get top rated cleaners in area (if we have location data)
      const topRated = await query(
        `
        SELECT 
          u.id,
          cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
          cp.avatar_url,
          cp.base_rate_cph,
          COALESCE(avg_reviews.avg_rating, 0) as rating,
          COALESCE(avg_reviews.review_count, 0) as reviews_count
        FROM users u
        INNER JOIN cleaner_profiles cp ON cp.user_id = u.id
        LEFT JOIN (
          SELECT 
            reviewee_id,
            AVG(rating)::numeric(3,2) as avg_rating,
            COUNT(*) as review_count
          FROM reviews
          WHERE reviewer_type = 'client'
          GROUP BY reviewee_id
        ) avg_reviews ON avg_reviews.reviewee_id = u.id
        WHERE u.role = 'cleaner'
          AND COALESCE(avg_reviews.avg_rating, 0) >= 4.5
        ORDER BY avg_reviews.avg_rating DESC, avg_reviews.review_count DESC
        LIMIT 5
        `,
        []
      );

      res.json({
        recommendations: {
          similarToFavorites: similarCleaners.rows,
          topRated: topRated.rows,
        },
      });
    } catch (error) {
      logger.error("get_recommendations_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_RECOMMENDATIONS_FAILED", message: "Failed to get recommendations" },
      });
    }
  }
));

// ============================================
// SAVED SEARCHES
// ============================================

/**
 * @swagger
 * /client/search/saved:
 *   post:
 *     summary: Save search preferences
 *     description: Save search preferences for reuse (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - filters
 *             properties:
 *               name:
 *                 type: string
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Search saved successfully
 *       403:
 *         description: Forbidden - clients only
 */
const saveSearchSchema = z.object({
  name: z.string().min(1),
  filters: z.record(z.any()),
});

clientEnhancedRouter.post(
  "/search/saved",
  validateBody(saveSearchSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { name, filters } = req.body;

      // Store in client_profiles metadata
      await query(
        `
        UPDATE client_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('saved_searches', 
              COALESCE(metadata->'saved_searches', '[]'::jsonb) || 
              jsonb_build_array(jsonb_build_object('name', $1, 'filters', $2::jsonb, 'created_at', NOW()))
            ),
            updated_at = NOW()
        WHERE user_id = $3
        `,
        [name, JSON.stringify(filters), clientId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("save_search_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SAVE_SEARCH_FAILED", message: "Failed to save search" },
      });
    }
  }
));

/**
 * @swagger
 * /client/search/saved:
 *   get:
 *     summary: Get saved searches
 *     description: Get client saved searches (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved searches list
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/search/saved", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const result = await query(
      `
      SELECT metadata->'saved_searches' as saved_searches
      FROM client_profiles
      WHERE user_id = $1
      `,
      [clientId]
    );

    const savedSearches = result.rows[0]?.saved_searches || [];

    res.json({ savedSearches });
  } catch (error) {
    logger.error("get_saved_searches_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_SAVED_SEARCHES_FAILED", message: "Failed to get saved searches" },
    });
  }
}));

// ============================================
// FAVORITES ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /client/favorites/recommendations:
 *   get:
 *     summary: Get favorite recommendations
 *     description: Get cleaner recommendations based on favorites (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleaner recommendations
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get(
  "/favorites/recommendations",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      // Get cleaners with similar service types to favorites
      const recommendations = await query(
        `
        SELECT DISTINCT
          u.id,
          cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
          cp.avatar_url,
          cp.base_rate_cph,
          COALESCE(avg_reviews.avg_rating, 0) as rating,
          COALESCE(avg_reviews.review_count, 0) as reviews_count,
          'similar' as reason
        FROM favorite_cleaners fc
        INNER JOIN users u ON u.id = fc.cleaner_id
        LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
        LEFT JOIN (
          SELECT 
            reviewee_id,
            AVG(rating)::numeric(3,2) as avg_rating,
            COUNT(*) as review_count
          FROM reviews
          WHERE reviewer_type = 'client'
          GROUP BY reviewee_id
        ) avg_reviews ON avg_reviews.reviewee_id = u.id
        WHERE fc.client_id = $1
        LIMIT 10
        `,
        [clientId]
      );

      res.json({ recommendations: recommendations.rows });
    } catch (error) {
      logger.error("get_favorite_recommendations_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "GET_RECOMMENDATIONS_FAILED",
          message: "Failed to get recommendations",
        },
      });
    }
  }
));

/**
 * @swagger
 * /client/favorites/insights:
 *   get:
 *     summary: Get favorites insights
 *     description: Get insights about favorite cleaners (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favorites insights
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/favorites/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const insights = await query(
      `
      SELECT 
        COUNT(DISTINCT fc.cleaner_id) as total_favorites,
        COUNT(DISTINCT j.id) as total_bookings_with_favorites,
        MAX(j.scheduled_start_at) as last_booking_date,
        AVG(j.credit_amount) as avg_booking_value
      FROM favorite_cleaners fc
      LEFT JOIN jobs j ON j.cleaner_id = fc.cleaner_id AND j.client_id = $1
      WHERE fc.client_id = $1
      `,
      [clientId]
    );

    // Get most booked favorite
    const mostBooked = await query(
      `
      SELECT 
        fc.cleaner_id,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as name,
        COUNT(j.id) as booking_count
      FROM favorite_cleaners fc
      INNER JOIN jobs j ON j.cleaner_id = fc.cleaner_id AND j.client_id = $1
      INNER JOIN users u ON u.id = fc.cleaner_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
      WHERE fc.client_id = $1
      GROUP BY fc.cleaner_id, cp.first_name, cp.last_name
      ORDER BY booking_count DESC
      LIMIT 1
      `,
      [clientId]
    );

    res.json({
      insights: {
        ...insights.rows[0],
        mostBookedFavorite: mostBooked.rows[0] || null,
      },
    });
  } catch (error) {
    logger.error("get_favorites_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

// ============================================
// RECURRING BOOKINGS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /client/recurring-bookings/{id}/skip:
 *   post:
 *     summary: Skip recurring booking
 *     description: Skip the next occurrence of a recurring booking (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Booking skipped successfully
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.post(
  "/recurring-bookings/:id/skip",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      // Update next_job_date to skip one occurrence
      const result = await query(
        `
        UPDATE cleaning_subscriptions
        SET next_job_date = next_job_date + 
            CASE frequency
              WHEN 'weekly' THEN INTERVAL '1 week'
              WHEN 'bi-weekly' THEN INTERVAL '2 weeks'
              WHEN 'monthly' THEN INTERVAL '1 month'
              ELSE INTERVAL '1 week'
            END,
            updated_at = NOW()
        WHERE id = $1::uuid AND client_id = $2
        RETURNING *
        `,
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "RECURRING_BOOKING_NOT_FOUND", message: "Recurring booking not found" },
        });
      }

      res.json({ recurringBooking: result.rows[0] });
    } catch (error) {
      logger.error("skip_recurring_booking_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SKIP_BOOKING_FAILED", message: "Failed to skip booking" },
      });
    }
  }
));

/**
 * @swagger
 * /client/recurring-bookings/{id}/suggestions:
 *   get:
 *     summary: Get scheduling suggestions
 *     description: Get smart scheduling suggestions for recurring booking (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scheduling suggestions
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get(
  "/recurring-bookings/:id/suggestions",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      // Get recurring booking
      const booking = await query(
        `
        SELECT * FROM cleaning_subscriptions
        WHERE id = $1::uuid AND client_id = $2
        `,
        [id, clientId]
      );

      if (booking.rows.length === 0) {
        return res.status(404).json({
          error: { code: "RECURRING_BOOKING_NOT_FOUND", message: "Recurring booking not found" },
        });
      }

      const recurringBooking = booking.rows[0];

      // Get booking history to suggest optimal times
      const history = await query(
        `
        SELECT 
          EXTRACT(DOW FROM scheduled_start_at) as day_of_week,
          EXTRACT(HOUR FROM scheduled_start_at) as hour,
          COUNT(*) as count
        FROM jobs
        WHERE client_id = $1 AND cleaner_id = $2 AND status = 'completed'
        GROUP BY day_of_week, hour
        ORDER BY count DESC
        LIMIT 3
        `,
        [clientId, recurringBooking.cleaner_id || null]
      );

      const suggestions = {
        optimalDays: history.rows.map((row) => ({
          dayOfWeek: parseInt(row.day_of_week),
          hour: parseInt(row.hour),
          confidence: parseInt(row.count),
        })),
        currentSchedule: {
          frequency: recurringBooking.frequency,
          preferredTime: recurringBooking.preferred_time,
        },
      };

      res.json({ suggestions });
    } catch (error) {
      logger.error("get_recurring_suggestions_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_SUGGESTIONS_FAILED", message: "Failed to get suggestions" },
      });
    }
  }
));

// ============================================
// PROFILE PREFERENCES
// ============================================

/**
 * @swagger
 * /client/profile/preferences:
 *   put:
 *     summary: Save profile preferences
 *     description: Save client preferences (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferred_cleaning_times: { type: array, items: { type: string } }
 *               default_service_type: { type: string }
 *               default_add_ons: { type: array, items: { type: string } }
 *               auto_fill_booking: { type: boolean }
 *               preferred_cleaners: { type: array, items: { type: string } }
 *               property_details:
 *                 type: object
 *                 properties:
 *                   bedrooms: { type: number }
 *                   bathrooms: { type: number }
 *                   square_feet: { type: number }
 *     responses:
 *       200:
 *         description: Preferences saved
 *       403:
 *         description: Forbidden - clients only
 */
const savePreferencesSchema = z.object({
  preferred_cleaning_times: z.array(z.string()).optional(),
  default_service_type: z.string().optional(),
  default_add_ons: z.array(z.string()).optional(),
  auto_fill_booking: z.boolean().optional(),
  preferred_cleaners: z.array(z.string()).optional(),
  property_details: z
    .object({
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      square_feet: z.number().optional(),
    })
    .optional(),
});

clientEnhancedRouter.put(
  "/profile/preferences",
  validateBody(savePreferencesSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const preferences = req.body;

      await query(
        `
        UPDATE client_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('preferences', $1::jsonb),
            updated_at = NOW()
        WHERE user_id = $2
        `,
        [JSON.stringify(preferences), clientId]
      );

      res.json({ preferences });
    } catch (error) {
      logger.error("save_preferences_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SAVE_PREFERENCES_FAILED", message: "Failed to save preferences" },
      });
    }
  }
));

/**
 * @swagger
 * /client/profile/preferences:
 *   get:
 *     summary: Get profile preferences
 *     description: Get client preferences (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile preferences
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/profile/preferences", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const result = await query(
      `
      SELECT metadata->'preferences' as preferences
      FROM client_profiles
      WHERE user_id = $1
      `,
      [clientId]
    );

    const preferences = result.rows[0]?.preferences || {};

    res.json({ preferences });
  } catch (error) {
    logger.error("get_preferences_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_PREFERENCES_FAILED", message: "Failed to get preferences" },
    });
  }
}));

/**
 * @swagger
 * /client/profile/photo:
 *   post:
 *     summary: Upload profile photo
 *     description: Upload profile photo (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - photo_url
 *             properties:
 *               photo_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.post("/profile/photo", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    // Note: File upload would be handled by multer or similar
    // This is a placeholder - actual implementation would handle file upload
    const { photo_url } = req.body;

    await query(
      `
      UPDATE client_profiles
      SET avatar_url = $1, updated_at = NOW()
      WHERE user_id = $2
      `,
      [photo_url, clientId]
    );

    res.json({ success: true, photo_url });
  } catch (error) {
    logger.error("upload_profile_photo_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "UPLOAD_PHOTO_FAILED", message: "Failed to upload photo" },
    });
  }
}));

// ============================================
// REVIEWS ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /client/reviews/{id}/photos:
 *   post:
 *     summary: Add photos to review
 *     description: Add photos to a review (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - photo_urls
 *             properties:
 *               photo_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *     responses:
 *       200:
 *         description: Photos added successfully
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.post(
  "/reviews/:id/photos",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;
      const { photo_urls } = req.body;

      // Store photos in review metadata or separate table
      await query(
        `
        UPDATE reviews
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('photos', $1::jsonb),
            updated_at = NOW()
        WHERE id = $2::uuid AND reviewer_id = $3
        RETURNING *
        `,
        [JSON.stringify(photo_urls), id, clientId]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("add_review_photos_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "ADD_PHOTOS_FAILED", message: "Failed to add photos" },
      });
    }
  }
));

/**
 * @swagger
 * /client/reviews/insights:
 *   get:
 *     summary: Get review insights
 *     description: Get review insights (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review insights
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/reviews/insights", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;

    const insights = await query(
      `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating)::numeric(3,2) as avg_rating_given,
        MIN(created_at) as first_review_date,
        MAX(created_at) as last_review_date
      FROM reviews
      WHERE reviewer_id = $1 AND reviewer_type = 'client'
      `,
      [clientId]
    );

    res.json({ insights: insights.rows[0] });
  } catch (error) {
    logger.error("get_review_insights_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_INSIGHTS_FAILED", message: "Failed to get insights" },
    });
  }
}));

// ============================================
// JOB ENHANCEMENTS
// ============================================

/**
 * @swagger
 * /client/jobs/{id}/live-status:
 *   get:
 *     summary: Get live job status
 *     description: Get real-time job status (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Live job status
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/jobs/:id/live-status", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;

    const job = await query(
      `
      SELECT 
        j.*,
        j.status as current_status,
        (
          SELECT json_agg(json_build_object(
            'event_type', event_type,
            'created_at', created_at,
            'actor_type', actor_type
          ) ORDER BY created_at DESC)
          FROM job_events
          WHERE job_id = j.id
        ) as events
      FROM jobs j
      WHERE j.id = $1::uuid AND j.client_id = $2
      `,
      [id, clientId]
    );

    if (job.rows.length === 0) {
      return res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Job not found" },
      });
    }

    res.json({ job: job.rows[0] });
  } catch (error) {
    logger.error("get_live_status_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_STATUS_FAILED", message: "Failed to get status" },
    });
  }
}));

/**
 * @swagger
 * /client/jobs/{id}/add-to-calendar:
 *   post:
 *     summary: Generate calendar file
 *     description: Generate iCal file for booking (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: iCal file download
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.post(
  "/jobs/:id/add-to-calendar",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      const job = await query(
        `
        SELECT 
          j.*,
          cp.first_name || ' ' || COALESCE(cp.last_name, '') as cleaner_name
        FROM jobs j
        LEFT JOIN users u ON u.id = j.cleaner_id
        LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
        WHERE j.id = $1::uuid AND j.client_id = $2
        `,
        [id, clientId]
      );

      if (job.rows.length === 0) {
        return res.status(404).json({
          error: { code: "JOB_NOT_FOUND", message: "Job not found" },
        });
      }

      const jobData = job.rows[0];
      // Generate iCal content (simplified)
      const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${new Date(jobData.scheduled_start_at).toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTEND:${new Date(jobData.scheduled_end_at).toISOString().replace(/[-:]/g, "").split(".")[0]}Z
SUMMARY:Cleaning Service - ${jobData.cleaner_name || "TBD"}
DESCRIPTION:Address: ${jobData.address}
END:VEVENT
END:VCALENDAR`;

      res.setHeader("Content-Type", "text/calendar");
      res.setHeader("Content-Disposition", `attachment; filename="booking-${id}.ics"`);
      res.send(icalContent);
    } catch (error) {
      logger.error("generate_calendar_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GENERATE_CALENDAR_FAILED", message: "Failed to generate calendar" },
      });
    }
  }
));

/**
 * @swagger
 * /client/jobs/{id}/share-link:
 *   get:
 *     summary: Get shareable link
 *     description: Get shareable link for booking (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Shareable link
 *       403:
 *         description: Forbidden - clients only
 */
clientEnhancedRouter.get("/jobs/:id/share-link", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const clientId = req.user!.id;
    const { id } = req.params;

    const job = await query(
      "SELECT id FROM jobs WHERE id = $1::uuid AND client_id = $2",
      [id, clientId]
    );

    if (job.rows.length === 0) {
      return res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Job not found" },
      });
    }

    // Generate shareable link (would use a token in production)
    const shareLink = `${process.env.FRONTEND_URL || "http://localhost:3001"}/bookings/${id}/share`;

    res.json({ shareLink });
  } catch (error) {
    logger.error("get_share_link_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_SHARE_LINK_FAILED", message: "Failed to get share link" },
    });
  }
}));

// ============================================
// CREDIT AUTO-REFILL
// ============================================

/**
 * @swagger
 * /client/credits/auto-refill:
 *   post:
 *     summary: Setup auto-refill
 *     description: Setup credit auto-refill configuration (clients only).
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *               threshold:
 *                 type: number
 *                 minimum: 0
 *               amount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Auto-refill configured successfully
 *       403:
 *         description: Forbidden - clients only
 */
const autoRefillSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
});

clientEnhancedRouter.post(
  "/credits/auto-refill",
  validateBody(autoRefillSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { enabled, threshold, amount } = req.body;

      // Store auto-refill config in client_profiles metadata
      await query(
        `
        UPDATE client_profiles
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_refill', jsonb_build_object(
            'enabled', $1::boolean,
            'threshold', $2::numeric,
            'amount', $3::numeric
          )
        ),
        updated_at = NOW()
        WHERE user_id = $4
        `,
        [enabled, threshold || 50, amount || 100, clientId]
      );

      res.json({ success: true, config: { enabled, threshold, amount } });
    } catch (error) {
      logger.error("setup_auto_refill_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SETUP_AUTO_REFILL_FAILED", message: "Failed to setup auto-refill" },
      });
    }
  }
));

export default clientEnhancedRouter;
