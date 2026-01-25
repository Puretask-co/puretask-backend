// src/services/holidayService.ts
// Federal holiday policy data and cleaner holiday settings

import { query } from "../db/client";

export interface Holiday {
  holiday_date: string;
  name: string;
  is_federal: boolean;
  bank_holiday: boolean;
  support_limited: boolean;
}

export interface CleanerHolidaySettings {
  available_on_federal_holidays: boolean;
  holiday_rate_enabled: boolean;
  holiday_rate_multiplier: number;
}

export interface CleanerHolidayOverride {
  holiday_date: string;
  name: string;
  available: boolean;
  start_time_local: string | null;
  end_time_local: string | null;
  use_holiday_rate: boolean | null;
  min_job_hours: number | null;
  notes: string | null;
}

export async function getHolidayByDate(date: string): Promise<Holiday | null> {
  const result = await query<Holiday>(
    `SELECT holiday_date, name, is_federal, bank_holiday, support_limited
     FROM holidays
     WHERE holiday_date = $1 AND is_federal = true`,
    [date]
  );
  return result.rows[0] ?? null;
}

export async function listHolidays(params: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Holiday[]> {
  const { from, to, limit } = params;

  if (from && to) {
    const result = await query<Holiday>(
      `SELECT holiday_date, name, is_federal, bank_holiday, support_limited
       FROM holidays
       WHERE holiday_date BETWEEN $1 AND $2
         AND is_federal = true
       ORDER BY holiday_date ASC`,
      [from, to]
    );
    return result.rows;
  }

  const result = await query<Holiday>(
    `SELECT holiday_date, name, is_federal, bank_holiday, support_limited
     FROM holidays
     WHERE holiday_date >= CURRENT_DATE
       AND is_federal = true
     ORDER BY holiday_date ASC
     LIMIT $1`,
    [limit ?? 25]
  );
  return result.rows;
}

export async function getCleanerHolidaySettings(
  cleanerId: string
): Promise<CleanerHolidaySettings> {
  await query(
    `INSERT INTO cleaner_holiday_settings (cleaner_id)
     VALUES ($1)
     ON CONFLICT (cleaner_id) DO NOTHING`,
    [cleanerId]
  );

  const result = await query<CleanerHolidaySettings>(
    `SELECT available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier
     FROM cleaner_holiday_settings
     WHERE cleaner_id = $1`,
    [cleanerId]
  );

  return result.rows[0];
}

export async function updateCleanerHolidaySettings(
  cleanerId: string,
  updates: Partial<CleanerHolidaySettings>
): Promise<CleanerHolidaySettings> {
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    return getCleanerHolidaySettings(cleanerId);
  }

  const setClauses = fields.map((field, idx) => `${field} = $${idx + 2}`);
  const values = Object.values(updates);

  const result = await query<CleanerHolidaySettings>(
    `
      INSERT INTO cleaner_holiday_settings (cleaner_id, available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier)
      VALUES ($1, false, false, 1.150)
      ON CONFLICT (cleaner_id) DO UPDATE
      SET ${setClauses.join(", ")},
          updated_at = NOW()
      RETURNING available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier
    `,
    [cleanerId, ...values]
  );

  return result.rows[0];
}

export async function listCleanerHolidayOverrides(params: {
  cleanerId: string;
  from: string;
  to: string;
}): Promise<CleanerHolidayOverride[]> {
  const result = await query<CleanerHolidayOverride>(
    `
      SELECT
        o.holiday_date,
        h.name,
        o.available,
        o.start_time_local,
        o.end_time_local,
        o.use_holiday_rate,
        o.min_job_hours,
        o.notes
      FROM cleaner_holiday_overrides o
      JOIN holidays h ON h.holiday_date = o.holiday_date
      WHERE o.cleaner_id = $1
        AND o.holiday_date BETWEEN $2 AND $3
      ORDER BY o.holiday_date ASC
    `,
    [params.cleanerId, params.from, params.to]
  );

  return result.rows;
}

export async function upsertCleanerHolidayOverride(params: {
  cleanerId: string;
  holidayDate: string;
  available: boolean;
  startTimeLocal?: string | null;
  endTimeLocal?: string | null;
  useHolidayRate?: boolean | null;
  minJobHours?: number | null;
  notes?: string | null;
}): Promise<CleanerHolidayOverride> {
  const holiday = await getHolidayByDate(params.holidayDate);
  if (!holiday) {
    throw Object.assign(new Error("Holiday date is not recognized as a federal holiday"), {
      statusCode: 400,
      code: "INVALID_HOLIDAY_DATE",
    });
  }

  const result = await query<CleanerHolidayOverride>(
    `
      INSERT INTO cleaner_holiday_overrides (
        cleaner_id,
        holiday_date,
        available,
        start_time_local,
        end_time_local,
        use_holiday_rate,
        min_job_hours,
        notes
      )
      VALUES ($1, $2, $3, $4::TIME, $5::TIME, $6, $7, $8)
      ON CONFLICT (cleaner_id, holiday_date) DO UPDATE
      SET available = EXCLUDED.available,
          start_time_local = EXCLUDED.start_time_local,
          end_time_local = EXCLUDED.end_time_local,
          use_holiday_rate = EXCLUDED.use_holiday_rate,
          min_job_hours = EXCLUDED.min_job_hours,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      RETURNING
        holiday_date,
        $9::TEXT as name,
        available,
        start_time_local,
        end_time_local,
        use_holiday_rate,
        min_job_hours,
        notes
    `,
    [
      params.cleanerId,
      params.holidayDate,
      params.available,
      params.startTimeLocal ?? null,
      params.endTimeLocal ?? null,
      params.useHolidayRate ?? null,
      params.minJobHours ?? null,
      params.notes ?? null,
      holiday.name,
    ]
  );

  return result.rows[0];
}
