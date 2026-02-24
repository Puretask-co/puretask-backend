// src/routes/dashboardStubs.ts
// Stub and frontend-expected endpoints. Real implementations for /bookings/me and /cleaners/:id/reviews.

import { Router, Response } from "express";
import {
  requireAuth,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { query } from "../db/client";
import { listJobsForClient } from "../services/jobsService";
import { getWeeklyAvailability } from "../services/availabilityService";
import type { CleanerProfileResponse } from "../types/jobDetails";

/** GET /bookings/me → { bookings: [...] } — client's jobs as booking list (id, status, scheduled_start_at, scheduled_end_at, address, cleaner_id, cleaner, etc.) */
export const bookingsStubRouter = Router();
bookingsStubRouter.get(
  "/me",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const role = (req.user?.role ?? "client") as string;
      if (role !== "client") {
        return res.json({ bookings: [] });
      }
      const jobs = await listJobsForClient(userId);
      const jobIds = jobs.map((j) => j.id);
      let cleanerMap: Record<string, { name: string; avatar_url: string | null }> = {};
      if (jobIds.length > 0 && jobs.some((j) => j.cleaner_id)) {
        const cleanerIds = [...new Set(jobs.map((j) => j.cleaner_id).filter(Boolean) as string[])];
        const r = await query<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>(
          `SELECT u.id, cp.first_name, cp.last_name, cp.avatar_url
           FROM users u
           LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
           WHERE u.id = ANY($1::text[])`,
          [cleanerIds]
        );
        cleanerMap = Object.fromEntries(
          r.rows.map((row) => [
            row.id,
            {
              name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Cleaner",
              avatar_url: row.avatar_url ?? null,
            },
          ])
        );
      }
      const bookings = jobs.map((j) => {
        const b: Record<string, unknown> = {
          id: j.id,
          status: j.status,
          scheduled_start_at: j.scheduled_start_at,
          scheduled_end_at: j.scheduled_end_at,
          address: j.address,
          client_id: j.client_id,
          cleaner_id: j.cleaner_id ?? null,
          created_at: j.created_at,
        };
        if (j.cleaner_id && cleanerMap[j.cleaner_id]) {
          b.cleaner = cleanerMap[j.cleaner_id];
        }
        return b;
      });
      res.json({ bookings });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_BOOKINGS_FAILED", message: (e as Error).message } });
    }
  })
);

/**
 * Cleaners router: frontend expects GET /cleaners/search, /featured, /top-rated, /:id, /:id/availability, /:id/reviews.
 * Order matters: static paths before /:id.
 */
export const cleanersRouter = Router();

/** GET /cleaners/search — search cleaners (params: q, limit, etc.) */
cleanersRouter.get(
  "/search",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase();
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
      if (!q || q.length < 1) {
        return res.json({ cleaners: [], total: 0 });
      }
      const result = await query(
        `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph
         FROM users u
         LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
         WHERE u.role = 'cleaner'
         AND (LOWER(u.email) LIKE $1 OR LOWER(COALESCE(cp.first_name,'') || ' ' || COALESCE(cp.last_name,'')) LIKE $1)
         LIMIT $2`,
        [`%${q}%`, limit]
      );
      const cleaners = result.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
        avatar_url: r.avatar_url,
        bio: r.bio,
        base_rate_cph: r.base_rate_cph,
      }));
      res.json({ cleaners, total: cleaners.length });
    } catch (e) {
      res.status(500).json({ error: { code: "SEARCH_FAILED", message: (e as Error).message } });
    }
  })
);

/** Shared: list cleaners with rating/review count, ordered by rating (for featured and top-rated) */
async function listCleanersByRating(limit: number = 20): Promise<any[]> {
  const result = await query(
    `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph,
            COALESCE(avg_reviews.avg_rating, 0)::numeric(3,2) as rating,
            COALESCE(avg_reviews.review_count, 0)::int as review_count
     FROM users u
     LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
     LEFT JOIN (
       SELECT reviewee_id,
              AVG(rating)::numeric(3,2) as avg_rating,
              COUNT(*) as review_count
       FROM reviews
       WHERE reviewer_type = 'client'
       GROUP BY reviewee_id
     ) avg_reviews ON avg_reviews.reviewee_id = u.id
     WHERE u.role = 'cleaner'
     ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
    avatar_url: r.avatar_url,
    bio: r.bio,
    base_rate_cph: r.base_rate_cph,
    rating: parseFloat(r.rating || "0"),
    review_count: Number(r.review_count || 0),
  }));
}

/** GET /cleaners/featured — real data: same as top-rated (no featured flag on cleaners) */
cleanersRouter.get(
  "/featured",
  requireAuth,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const limit = Math.min(20, Math.max(1, parseInt(String(_req.query.limit || "10"), 10)));
      const cleaners = await listCleanersByRating(limit);
      res.json({ cleaners });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_FEATURED_FAILED", message: (e as Error).message } });
    }
  })
);

/** GET /cleaners/top-rated — real data from reviews / cleaner_profiles */
cleanersRouter.get(
  "/top-rated",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
      const cleaners = await listCleanersByRating(limit);
      res.json({ cleaners });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_TOP_RATED_FAILED", message: (e as Error).message } });
    }
  })
);

/** GET /cleaners/:id — cleaner profile (minimal for frontend); includes level and badges per GAMIFICATION_FRONTEND_BACKEND_SPEC */
cleanersRouter.get(
  "/:id",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph,
                cp.reliability_score, cp.tier, cp.avg_rating, cp.jobs_completed
         FROM users u
         LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
         WHERE u.id = $1 AND u.role = 'cleaner'`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner not found" } });
      }
      const r = result.rows[0] as any;
      const cleaner: CleanerProfileResponse = {
        id: r.id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
        avatar_url: r.avatar_url,
        bio: r.bio,
        base_rate_cph: r.base_rate_cph != null ? parseFloat(r.base_rate_cph) : null,
        reliability_score: r.reliability_score != null ? Number(r.reliability_score) : null,
        tier: r.tier ?? null,
        avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
        jobs_completed: r.jobs_completed != null ? Number(r.jobs_completed) : 0,
      };
      const [levelRow, badgesRow] = await Promise.all([
        query(
          `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
          [id]
        ).catch(() => ({ rows: [] })),
        query(
          `SELECT bd.id, bd.name, bd.icon_key
           FROM cleaner_badges cb
           JOIN badge_definitions bd ON bd.id = cb.badge_id AND bd.is_profile_visible = true
           WHERE cb.cleaner_id = $1
           ORDER BY cb.earned_at DESC
           LIMIT 5`,
          [id]
        ).catch(() => ({ rows: [] })),
      ]);
      const level = (levelRow.rows[0] as { current_level: number } | undefined)?.current_level;
      if (level != null) cleaner.level = level;
      if (badgesRow.rows.length > 0) {
        cleaner.badges = (badgesRow.rows as Array<{ id: string; name: string; icon_key: string | null }>).map(
          (b) => ({ id: b.id, name: b.name, icon: b.icon_key ?? undefined })
        );
      }
      res.json({ cleaner });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_CLEANER_FAILED", message: (e as Error).message } });
    }
  })
);

/** GET /cleaners/:id/availability — real data from cleaner_availability */
cleanersRouter.get(
  "/:id/availability",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.params.id;
      const rows = await getWeeklyAvailability(cleanerId);
      const slots = rows
        .filter((r) => r.is_available)
        .map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_available: r.is_available,
        }));
      res.json({ slots });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_AVAILABILITY_FAILED", message: (e as Error).message } });
    }
  })
);

/** GET /cleaners/:id/reviews → { reviews: [...], page, per_page, total } — reviews where reviewee is this cleaner */
cleanersRouter.get(
  "/:id/reviews",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const cleanerId = req.params.id;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.per_page || "10"), 10)));
      const offset = (page - 1) * perPage;

      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM reviews WHERE reviewee_id = $1 AND reviewer_type = 'client'`,
        [cleanerId]
      );
      const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

      const reviewsResult = await query<{
        id: string;
        job_id: string;
        reviewer_id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        response: string | null;
        response_at: string | null;
        reviewer_first_name: string | null;
        reviewer_last_name: string | null;
      }>(
        `SELECT r.id, r.job_id, r.reviewer_id, r.rating, r.comment, r.created_at, r.response, r.response_at,
                cp.first_name AS reviewer_first_name, cp.last_name AS reviewer_last_name
         FROM reviews r
         LEFT JOIN users u ON u.id = r.reviewer_id
         LEFT JOIN client_profiles cp ON cp.user_id = r.reviewer_id
         WHERE r.reviewee_id = $1 AND r.reviewer_type = 'client'
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [cleanerId, perPage, offset]
      );

      const reviews = reviewsResult.rows.map((row) => ({
        id: row.id,
        job_id: row.job_id,
        reviewer_id: row.reviewer_id,
        rating: row.rating,
        comment: row.comment ?? null,
        created_at: row.created_at,
        response: row.response ?? null,
        response_at: row.response_at ?? null,
        reviewer_name: [row.reviewer_first_name, row.reviewer_last_name].filter(Boolean).join(" ") || null,
      }));

      res.json({ reviews, page, per_page: perPage, total });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_REVIEWS_FAILED", message: (e as Error).message } });
    }
  })
);
