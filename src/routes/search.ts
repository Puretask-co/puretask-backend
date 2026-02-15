/**
 * Search Routes
 * Backend routes for global search and autocomplete
 */

import { Router } from "express";
import { requireAuth } from "../middleware/authCanonical";
import { db } from "../lib/db";

const router = Router();

/**
 * @swagger
 * /search/global:
 *   get:
 *     summary: Global search
 *     description: Search across cleaners, bookings, clients, and jobs.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type: { type: 'string', enum: ['cleaner', 'booking', 'client'] }
 *                       id: { type: 'string' }
 *                       title: { type: 'string' }
 *                       subtitle: { type: 'string' }
 *                       url: { type: 'string' }
 */
router.get("/global", requireAuth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    const query = (q as string)?.toLowerCase().trim();

    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const results: any[] = [];

    // Search cleaners
    const cleaners = await query(
      `SELECT id, full_name, email, 'cleaner' as type
       FROM users
       WHERE role = 'cleaner'
       AND (LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1)
       LIMIT $2`,
      [`%${query}%`, Math.floor(Number(limit) / 4)]
    );

    cleaners.rows.forEach((row) => {
      results.push({
        type: "cleaner",
        id: row.id,
        title: row.full_name,
        subtitle: row.email,
        url: `/cleaner/${row.id}`,
      });
    });

    // Search bookings (if user is client or admin)
    if (req.user?.role === "client" || req.user?.role === "admin") {
      const bookings = await query(
        `SELECT j.id, j.address, j.service_type, 'booking' as type
         FROM jobs j
         WHERE (LOWER(j.address) LIKE $1 OR LOWER(j.service_type) LIKE $1)
         ${req.user?.role === "client" ? "AND j.client_id = $3" : ""}
         LIMIT $2`,
        req.user?.role === "client"
          ? [`%${query}%`, Math.floor(Number(limit) / 4), req.user.id]
          : [`%${query}%`, Math.floor(Number(limit) / 4)]
      );

      bookings.rows.forEach((row) => {
        results.push({
          type: "booking",
          id: row.id,
          title: `Booking at ${row.address}`,
          subtitle: row.service_type,
          url: `/client/bookings/${row.id}`,
        });
      });
    }

    // Search clients (admin only)
    if (req.user?.role === "admin") {
      const clients = await query(
        `SELECT id, full_name, email, 'client' as type
         FROM users
         WHERE role = 'client'
         AND (LOWER(full_name) LIKE $1 OR LOWER(email) LIKE $1)
         LIMIT $2`,
        [`%${query}%`, Math.floor(Number(limit) / 4)]
      );

      clients.rows.forEach((row) => {
        results.push({
          type: "client",
          id: row.id,
          title: row.full_name,
          subtitle: row.email,
          url: `/admin/users/${row.id}`,
        });
      });
    }

    res.json({ results: results.slice(0, Number(limit)) });
  } catch (error: any) {
    console.error("Global search error:", error);
    res.status(500).json({ error: { message: "Search failed" } });
  }
});

/**
 * @swagger
 * /search/autocomplete:
 *   get:
 *     summary: Autocomplete suggestions
 *     description: Get autocomplete suggestions for search queries (cleaners, services).
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 8
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string' }
 *                       text: { type: 'string' }
 *                       type: { type: 'string', enum: ['cleaner', 'service'] }
 */
router.get("/autocomplete", requireAuth, async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;
    const query = (q as string)?.toLowerCase().trim();

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions: any[] = [];

    // Cleaner name suggestions
    const cleaners = await query(
      `SELECT DISTINCT full_name as text, id, 'cleaner' as type
       FROM users
       WHERE role = 'cleaner'
       AND LOWER(full_name) LIKE $1
       LIMIT $2`,
      [`%${query}%`, Math.floor(Number(limit) / 2)]
    );

    cleaners.rows.forEach((row) => {
      suggestions.push({
        id: row.id,
        text: row.text,
        type: "cleaner",
      });
    });

    // Service type suggestions
    const services = ["standard", "deep", "move_in_out", "airbnb"];
    const matchingServices = services
      .filter((s) => s.toLowerCase().includes(query))
      .slice(0, 3)
      .map((s) => ({
        id: `service-${s}`,
        text: s.replace("_", " "),
        type: "service" as const,
      }));

    suggestions.push(...matchingServices);

    res.json({ suggestions: suggestions.slice(0, Number(limit)) });
  } catch (error: any) {
    console.error("Autocomplete error:", error);
    res.status(500).json({ error: { message: "Autocomplete failed" } });
  }
});

export default router;
