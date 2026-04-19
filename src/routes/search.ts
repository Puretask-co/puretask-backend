/**
 * Search Routes
 * Backend routes for global search and autocomplete
 */

import { Router } from "express";
import { requireAuth } from "../middleware/authCanonical";
import { autocompleteSearch, globalSearch } from "../services/searchService";

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
    const searchTerm = (q as string)?.toLowerCase().trim() ?? "";

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ results: [] });
    }

    const parsedLimit = Number(limit);
    const results = await globalSearch(searchTerm, req.user?.role, req.user?.id, parsedLimit);
    res.json({ results });
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
    const searchTerm = (q as string)?.toLowerCase().trim() ?? "";

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await autocompleteSearch(searchTerm, Number(limit));
    res.json({ suggestions });
  } catch (error: any) {
    console.error("Autocomplete error:", error);
    res.status(500).json({ error: { message: "Autocomplete failed" } });
  }
});

export default router;
