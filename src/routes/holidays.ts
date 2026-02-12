// src/routes/holidays.ts
// Federal holidays public endpoints

import { Router, Response } from "express";
import { z } from "zod";
import { listHolidays, getHolidayByDate } from "../services/holidayService";

const holidaysRouter = Router();

const listQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
    const parsed = listQuerySchema.parse(req.query);

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
    res.status(400).json({
      error: { code: "INVALID_QUERY", message: (error as Error).message },
    });
  }
});

export default holidaysRouter;
