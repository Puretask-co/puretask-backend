// src/routes/dashboardStubs.ts
// Stub and frontend-expected endpoints. Replace stubs with real implementations later.

import { Router, Response } from "express";
import {
  requireAuth,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { query } from "../db/client";

/** GET /bookings/me → { bookings: [] } */
export const bookingsStubRouter = Router();
bookingsStubRouter.get(
  "/me",
  requireAuth,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ bookings: [] });
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

/** GET /cleaners/featured — stub */
cleanersRouter.get(
  "/featured",
  requireAuth,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ cleaners: [] });
  })
);

/** GET /cleaners/top-rated — stub */
cleanersRouter.get(
  "/top-rated",
  requireAuth,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ cleaners: [] });
  })
);

/** GET /cleaners/:id — cleaner profile (minimal for frontend) */
cleanersRouter.get(
  "/:id",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph
         FROM users u
         LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
         WHERE u.id = $1 AND u.role = 'cleaner'`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner not found" } });
      }
      const r = result.rows[0] as any;
      res.json({
        id: r.id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
        avatar_url: r.avatar_url,
        bio: r.bio,
        base_rate_cph: r.base_rate_cph,
      });
    } catch (e) {
      res.status(500).json({ error: { code: "GET_CLEANER_FAILED", message: (e as Error).message } });
    }
  })
);

/** GET /cleaners/:id/availability — stub */
cleanersRouter.get(
  "/:id/availability",
  requireAuth,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ slots: [] });
  })
);

/** GET /cleaners/:id/reviews → { reviews: [], page, per_page, total: 0 } */
cleanersRouter.get(
  "/:id/reviews",
  requireAuth,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const perPage = Math.min(50, Math.max(1, parseInt(String(req.query.per_page || "10"), 10)));
    res.json({
      reviews: [],
      page,
      per_page: perPage,
      total: 0,
    });
  })
);
