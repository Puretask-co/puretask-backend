// src/routes/search.ts
// Search and browse cleaners - public/client accessible endpoint

import { Router, Response } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../middleware/jwtAuth";

const searchRouter = Router();

// These routes can be accessed by authenticated users (clients)
searchRouter.use(jwtAuthMiddleware);

/**
 * GET /search/cleaners
 * Search and browse available cleaners
 * Query params:
 * - limit: number of results (default 20, max 100)
 * - offset: pagination offset
 * - minRating: minimum rating (1-5)
 * - maxRate: maximum hourly rate
 * - serviceArea: filter by city/zip
 * - verified: only verified cleaners
 */
searchRouter.get("/cleaners", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const {
      limit = "20",
      offset = "0",
      minRating,
      maxRate,
      serviceArea,
      verified,
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offsetNum = parseInt(offset as string, 10);

    // Build dynamic query
    let whereConditions: string[] = ["u.role = 'cleaner'", "u.is_active = true"];
    let queryParams: any[] = [];
    let paramCount = 1;

    if (minRating) {
      whereConditions.push(`u.rating >= $${paramCount}`);
      queryParams.push(parseFloat(minRating as string));
      paramCount++;
    }

    if (maxRate) {
      whereConditions.push(`u.base_rate_cph <= $${paramCount}`);
      queryParams.push(parseFloat(maxRate as string));
      paramCount++;
    }

    if (verified === "true") {
      whereConditions.push(`u.verified_badge = true`);
    }

    // Add limit and offset
    queryParams.push(limitNum, offsetNum);

    const sql = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.rating,
        u.reviews_count,
        u.jobs_completed,
        u.base_rate_cph,
        u.deep_addon_cph,
        u.moveout_addon_cph,
        u.verified_badge,
        u.reliability_score,
        u.avatar_url,
        u.bio,
        u.created_at,
        u.last_active_at
      FROM users u
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY 
        u.verified_badge DESC,
        u.rating DESC,
        u.jobs_completed DESC,
        u.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await query<any>(sql, queryParams);

    // Get total count for pagination
    const countSql = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereConditions.join(" AND ")}
    `;
    const countResult = await query<{ total: string }>(
      countSql,
      queryParams.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    res.json({
      cleaners: result.rows,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    logger.error("search_cleaners_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "SEARCH_FAILED", message: "Failed to search cleaners" },
    });
  }
});

/**
 * GET /search/cleaners/:id
 * Get detailed cleaner profile
 */
searchRouter.get("/cleaners/:id", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<any>(
      `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.rating,
        u.reviews_count,
        u.jobs_completed,
        u.base_rate_cph,
        u.deep_addon_cph,
        u.moveout_addon_cph,
        u.verified_badge,
        u.reliability_score,
        u.avatar_url,
        u.bio,
        u.created_at,
        u.last_active_at,
        u.has_own_supplies,
        u.has_vehicle
      FROM users u
      WHERE u.id = $1 AND u.role = 'cleaner' AND u.is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "CLEANER_NOT_FOUND", message: "Cleaner not found" },
      });
    }

    // Get recent reviews (optional - if you have a reviews table)
    // For now, just return the cleaner profile
    res.json({ cleaner: result.rows[0] });
  } catch (error) {
    logger.error("get_cleaner_profile_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
      cleanerId: req.params.id,
    });
    res.status(500).json({
      error: { code: "GET_CLEANER_FAILED", message: "Failed to get cleaner" },
    });
  }
});

/**
 * GET /search/cleaners/:id/availability
 * Get cleaner's availability for booking
 */
searchRouter.get("/cleaners/:id/availability", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    // Verify cleaner exists
    const cleanerResult = await query<any>(
      `SELECT id FROM users WHERE id = $1 AND role = 'cleaner' AND is_active = true`,
      [id]
    );

    if (cleanerResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: "CLEANER_NOT_FOUND", message: "Cleaner not found" },
      });
    }

    // Get availability data
    const availabilityResult = await query<any>(
      `SELECT availability_data FROM users WHERE id = $1`,
      [id]
    );

    res.json({
      availability: availabilityResult.rows[0]?.availability_data || {},
    });
  } catch (error) {
    logger.error("get_cleaner_availability_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
      cleanerId: req.params.id,
    });
    res.status(500).json({
      error: {
        code: "GET_AVAILABILITY_FAILED",
        message: "Failed to get availability",
      },
    });
  }
});

export default searchRouter;

