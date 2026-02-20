// src/routes/holidays.ts
// Federal holidays public endpoints

import { Router, Response } from "express";
import { z } from "zod";
import { listHolidays, getHolidayByDate } from "../services/holidayService";

const holidaysRouter = Router();

const dateLike = z
  .string()
  .transform((s) => (s.includes("T") ? s.slice(0, 10) : s))
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "date must be YYYY-MM-DD");

const listQuerySchema = z.object({
  date: dateLike.optional(),
  from: dateLike.optional(),
  to: dateLike.optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

/**
 * @swagger
 * /holidays:
 *   get:
 *     summary: Get holidays
 *     description: Get federal holidays. Can query by single date, date range, or list upcoming.
 *     tags: [Holidays]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Single date lookup (YYYY-MM-DD)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date for range
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date for range
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit for upcoming holidays
 *     responses:
 *       200:
 *         description: Holiday(s) data
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     holiday: { type: 'object' }
 *                 - type: object
 *                   properties:
 *                     holidays: { type: 'array', items: { type: 'object' } }
 *       400:
 *         description: Invalid query parameters
 */
holidaysRouter.get("/", async (req, res: Response) => {
  try {
    const raw = req.query as Record<string, string | string[] | undefined>;
    const query = {
      date: Array.isArray(raw.date) ? raw.date[0] : raw.date,
      from: Array.isArray(raw.from) ? raw.from[0] : raw.from,
      to: Array.isArray(raw.to) ? raw.to[0] : raw.to,
      limit: Array.isArray(raw.limit) ? raw.limit[0] : raw.limit,
    };
    const parsed = listQuerySchema.parse(query);

    if (parsed.date) {
      const holiday = await getHolidayByDate(parsed.date);
      return res.json({ holiday });
    }

    const holidays = await listHolidays({
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit ? parseInt(parsed.limit, 10) : undefined,
    });

    res.json({ holidays });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: "INVALID_QUERY", message: (error as Error).message },
      });
    }
    res.json({ holidays: [] });
  }
});

export default holidaysRouter;
