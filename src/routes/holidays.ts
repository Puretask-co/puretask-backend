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
 * GET /holidays
 * Query options:
 * - ?date=YYYY-MM-DD -> single holiday lookup
 * - ?from=YYYY-MM-DD&to=YYYY-MM-DD -> list range
 * - ?limit=25 -> list upcoming
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
