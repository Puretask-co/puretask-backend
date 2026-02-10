// src/services/availabilityService.ts
// Cleaner availability and schedule management service

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface WeeklyAvailability {
  id: string;
  cleaner_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeOff {
  id: string;
  cleaner_id: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface ServiceArea {
  id: string;
  cleaner_id: string;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  radius_miles: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface CleanerPreferences {
  id: string;
  cleaner_id: string;
  max_jobs_per_day: number;
  min_job_duration_h: number;
  max_job_duration_h: number;
  accepts_pets: boolean;
  accepts_deep_clean: boolean;
  accepts_move_out: boolean;
  has_own_supplies: boolean;
  has_vehicle: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

// Days of week for reference
export const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

// ============================================
// Weekly Availability
// ============================================

/**
 * Get cleaner's weekly availability
 */
export async function getWeeklyAvailability(cleanerId: string): Promise<WeeklyAvailability[]> {
  const result = await query<WeeklyAvailability>(
    `SELECT * FROM cleaner_availability WHERE cleaner_id = $1 ORDER BY day_of_week`,
    [cleanerId]
  );
  return result.rows;
}

/**
 * Set cleaner's availability for a specific day
 */
export async function setDayAvailability(
  cleanerId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isAvailable: boolean = true
): Promise<WeeklyAvailability> {
  const result = await query<WeeklyAvailability>(
    `
      INSERT INTO cleaner_availability (cleaner_id, day_of_week, start_time, end_time, is_available)
      VALUES ($1, $2, $3::TIME, $4::TIME, $5)
      ON CONFLICT (cleaner_id, day_of_week) DO UPDATE
      SET start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          is_available = EXCLUDED.is_available,
          updated_at = NOW()
      RETURNING *
    `,
    [cleanerId, dayOfWeek, startTime, endTime, isAvailable]
  );

  logger.info("cleaner_availability_set", {
    cleanerId,
    dayOfWeek,
    startTime,
    endTime,
    isAvailable,
  });

  return result.rows[0];
}

/** Day name to day_of_week (0=Sunday, 1=Monday, ...) */
const DAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Update cleaner availability from route body (monday/tuesday/... arrays of { start, end })
 */
export async function updateCleanerAvailability(
  cleanerId: string,
  body: Record<string, Array<{ start: string; end: string }> | undefined>
): Promise<WeeklyAvailability[]> {
  const slots: AvailabilitySlot[] = [];
  for (const [dayName, entries] of Object.entries(body)) {
    const dayOfWeek = DAY_NAME_TO_NUM[dayName.toLowerCase()];
    if (dayOfWeek === undefined || !entries?.length) continue;
    for (const { start, end } of entries) {
      slots.push({
        dayOfWeek,
        startTime: start,
        endTime: end,
        isAvailable: true,
      });
    }
  }
  return setWeeklyAvailability(cleanerId, slots);
}

/**
 * Set cleaner's full week availability at once
 */
export async function setWeeklyAvailability(
  cleanerId: string,
  slots: AvailabilitySlot[]
): Promise<WeeklyAvailability[]> {
  // Delete existing availability
  await query(`DELETE FROM cleaner_availability WHERE cleaner_id = $1`, [cleanerId]);

  // Insert new slots
  const results: WeeklyAvailability[] = [];
  for (const slot of slots) {
    const result = await setDayAvailability(
      cleanerId,
      slot.dayOfWeek,
      slot.startTime,
      slot.endTime,
      slot.isAvailable
    );
    results.push(result);
  }

  logger.info("cleaner_weekly_availability_set", {
    cleanerId,
    slots: slots.length,
  });

  return results;
}

/**
 * Clear a specific day's availability
 */
export async function clearDayAvailability(
  cleanerId: string,
  dayOfWeek: number
): Promise<void> {
  await query(
    `DELETE FROM cleaner_availability WHERE cleaner_id = $1 AND day_of_week = $2`,
    [cleanerId, dayOfWeek]
  );
}

// ============================================
// Time Off
// ============================================

/**
 * Get cleaner's time off entries
 */
export async function getTimeOff(
  cleanerId: string,
  futureOnly: boolean = true
): Promise<TimeOff[]> {
  let queryText = `SELECT * FROM cleaner_time_off WHERE cleaner_id = $1`;
  if (futureOnly) {
    queryText += ` AND end_date >= CURRENT_DATE`;
  }
  queryText += ` ORDER BY start_date`;

  const result = await query<TimeOff>(queryText, [cleanerId]);
  return result.rows;
}

/**
 * Add time off for a cleaner
 */
export async function addTimeOff(params: {
  cleanerId: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}): Promise<TimeOff> {
  const {
    cleanerId,
    startDate,
    endDate,
    allDay = true,
    startTime,
    endTime,
    reason,
  } = params;

  const result = await query<TimeOff>(
    `
      INSERT INTO cleaner_time_off (cleaner_id, start_date, end_date, all_day, start_time, end_time, reason)
      VALUES ($1, $2::DATE, $3::DATE, $4, $5::TIME, $6::TIME, $7)
      RETURNING *
    `,
    [cleanerId, startDate, endDate, allDay, startTime ?? null, endTime ?? null, reason ?? null]
  );

  logger.info("cleaner_time_off_added", {
    cleanerId,
    startDate,
    endDate,
    allDay,
  });

  return result.rows[0];
}

/**
 * Delete time off entry
 */
export async function deleteTimeOff(cleanerId: string, timeOffId: string): Promise<void> {
  await query(
    `DELETE FROM cleaner_time_off WHERE id = $1 AND cleaner_id = $2`,
    [timeOffId, cleanerId]
  );

  logger.info("cleaner_time_off_deleted", { cleanerId, timeOffId });
}

// ============================================
// Service Areas
// ============================================

/**
 * Get cleaner's service areas
 */
export async function getServiceAreas(cleanerId: string): Promise<ServiceArea[]> {
  const result = await query<ServiceArea>(
    `SELECT * FROM cleaner_service_areas WHERE cleaner_id = $1 ORDER BY created_at`,
    [cleanerId]
  );
  return result.rows;
}

/**
 * Add a service area for a cleaner
 */
export async function addServiceArea(params: {
  cleanerId: string;
  zipCode?: string;
  city?: string;
  state?: string;
  radiusMiles?: number;
  latitude?: number;
  longitude?: number;
}): Promise<ServiceArea> {
  const {
    cleanerId,
    zipCode,
    city,
    state,
    radiusMiles,
    latitude,
    longitude,
  } = params;

  const result = await query<ServiceArea>(
    `
      INSERT INTO cleaner_service_areas (cleaner_id, zip_code, city, state, radius_miles, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [cleanerId, zipCode ?? null, city ?? null, state ?? null, radiusMiles ?? null, latitude ?? null, longitude ?? null]
  );

  logger.info("cleaner_service_area_added", { cleanerId, zipCode, city, state });

  return result.rows[0];
}

/**
 * Delete a service area
 */
export async function deleteServiceArea(cleanerId: string, areaId: string): Promise<void> {
  await query(
    `DELETE FROM cleaner_service_areas WHERE id = $1 AND cleaner_id = $2`,
    [areaId, cleanerId]
  );
}

// ============================================
// Preferences
// ============================================

/**
 * Get cleaner preferences
 */
export async function getPreferences(cleanerId: string): Promise<CleanerPreferences | null> {
  const result = await query<CleanerPreferences>(
    `SELECT * FROM cleaner_preferences WHERE cleaner_id = $1`,
    [cleanerId]
  );
  return result.rows[0] ?? null;
}

/**
 * Set/update cleaner preferences
 */
export async function setPreferences(
  cleanerId: string,
  prefs: Partial<Omit<CleanerPreferences, "id" | "cleaner_id" | "created_at" | "updated_at">>
): Promise<CleanerPreferences> {
  const result = await query<CleanerPreferences>(
    `
      INSERT INTO cleaner_preferences (
        cleaner_id,
        max_jobs_per_day,
        min_job_duration_h,
        max_job_duration_h,
        accepts_pets,
        accepts_deep_clean,
        accepts_move_out,
        has_own_supplies,
        has_vehicle,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (cleaner_id) DO UPDATE
      SET max_jobs_per_day = COALESCE($2, cleaner_preferences.max_jobs_per_day),
          min_job_duration_h = COALESCE($3, cleaner_preferences.min_job_duration_h),
          max_job_duration_h = COALESCE($4, cleaner_preferences.max_job_duration_h),
          accepts_pets = COALESCE($5, cleaner_preferences.accepts_pets),
          accepts_deep_clean = COALESCE($6, cleaner_preferences.accepts_deep_clean),
          accepts_move_out = COALESCE($7, cleaner_preferences.accepts_move_out),
          has_own_supplies = COALESCE($8, cleaner_preferences.has_own_supplies),
          has_vehicle = COALESCE($9, cleaner_preferences.has_vehicle),
          notes = COALESCE($10, cleaner_preferences.notes),
          updated_at = NOW()
      RETURNING *
    `,
    [
      cleanerId,
      prefs.max_jobs_per_day ?? 5,
      prefs.min_job_duration_h ?? 1.0,
      prefs.max_job_duration_h ?? 8.0,
      prefs.accepts_pets ?? true,
      prefs.accepts_deep_clean ?? true,
      prefs.accepts_move_out ?? true,
      prefs.has_own_supplies ?? false,
      prefs.has_vehicle ?? true,
      prefs.notes ?? null,
    ]
  );

  logger.info("cleaner_preferences_set", { cleanerId });

  return result.rows[0];
}

// ============================================
// Availability Checks
// ============================================

/**
 * Check if a cleaner is available at a specific datetime
 */
export async function isCleanerAvailable(
  cleanerId: string,
  datetime: Date
): Promise<boolean> {
  const result = await query<{ is_available: boolean }>(
    `SELECT is_cleaner_available($1, $2::TIMESTAMPTZ) as is_available`,
    [cleanerId, datetime.toISOString()]
  );
  return result.rows[0]?.is_available ?? false;
}

/**
 * Check if a cleaner is available for a job slot (start to end)
 */
export async function isCleanerAvailableForSlot(
  cleanerId: string,
  startAt: Date,
  endAt: Date
): Promise<boolean> {
  // Check both start and end times
  const startAvailable = await isCleanerAvailable(cleanerId, startAt);
  if (!startAvailable) return false;

  const endAvailable = await isCleanerAvailable(cleanerId, endAt);
  if (!endAvailable) return false;

  // Check if cleaner has too many jobs on that day
  const prefs = await getPreferences(cleanerId);
  const maxJobs = prefs?.max_jobs_per_day ?? 5;

  const jobCountResult = await query<{ count: string }>(
    `
      SELECT COUNT(*) as count FROM jobs
      WHERE cleaner_id = $1
        AND DATE(scheduled_start_at) = DATE($2)
        AND status NOT IN ('cancelled', 'completed')
    `,
    [cleanerId, startAt.toISOString()]
  );

  const existingJobs = Number(jobCountResult.rows[0]?.count || 0);
  if (existingJobs >= maxJobs) return false;

  // Check for overlapping jobs
  const overlapResult = await query<{ count: string }>(
    `
      SELECT COUNT(*) as count FROM jobs
      WHERE cleaner_id = $1
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (scheduled_start_at <= $2 AND scheduled_end_at > $2)
          OR (scheduled_start_at < $3 AND scheduled_end_at >= $3)
          OR (scheduled_start_at >= $2 AND scheduled_end_at <= $3)
        )
    `,
    [cleanerId, startAt.toISOString(), endAt.toISOString()]
  );

  const overlappingJobs = Number(overlapResult.rows[0]?.count || 0);
  return overlappingJobs === 0;
}

/**
 * Get all available cleaners for a time slot
 */
export async function getAvailableCleaners(
  startAt: Date,
  endAt: Date,
  zipCode?: string
): Promise<string[]> {
  // Get all active cleaners
  const cleanersResult = await query<{ user_id: string }>(
    `SELECT user_id FROM cleaner_profiles`
  );

  const availableCleanerIds: string[] = [];

  for (const row of cleanersResult.rows) {
    const isAvailable = await isCleanerAvailableForSlot(row.user_id, startAt, endAt);
    if (isAvailable) {
      // Optionally filter by service area
      if (zipCode) {
        const servesArea = await cleanerServesZipCode(row.user_id, zipCode);
        if (servesArea) {
          availableCleanerIds.push(row.user_id);
        }
      } else {
        availableCleanerIds.push(row.user_id);
      }
    }
  }

  return availableCleanerIds;
}

/**
 * Check if cleaner serves a specific zip code
 */
export async function cleanerServesZipCode(
  cleanerId: string,
  zipCode: string
): Promise<boolean> {
  const areas = await getServiceAreas(cleanerId);

  // If no areas defined, assume they serve everywhere
  if (areas.length === 0) return true;

  // Check if any area matches the zip code
  for (const area of areas) {
    if (area.zip_code === zipCode) return true;
    // Could also check radius here if we had geocoding
  }

  return false;
}

/**
 * Get cleaner's schedule for a specific date
 */
export async function getCleanerSchedule(
  cleanerId: string,
  date: Date
): Promise<{
  availability: WeeklyAvailability | null;
  timeOff: TimeOff[];
  scheduledJobs: Array<{
    id: string;
    status: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    address: string;
  }>;
}> {
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split("T")[0];

  // Get availability for that day
  const availabilityResult = await query<WeeklyAvailability>(
    `SELECT * FROM cleaner_availability WHERE cleaner_id = $1 AND day_of_week = $2`,
    [cleanerId, dayOfWeek]
  );

  // Get time off for that date
  const timeOffResult = await query<TimeOff>(
    `SELECT * FROM cleaner_time_off WHERE cleaner_id = $1 AND $2::DATE BETWEEN start_date AND end_date`,
    [cleanerId, dateStr]
  );

  // Get scheduled jobs for that date
  const jobsResult = await query<{
    id: string;
    status: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    address: string;
  }>(
    `
      SELECT id, status, scheduled_start_at, scheduled_end_at, address
      FROM jobs
      WHERE cleaner_id = $1
        AND DATE(scheduled_start_at) = $2::DATE
        AND status NOT IN ('cancelled')
      ORDER BY scheduled_start_at
    `,
    [cleanerId, dateStr]
  );

  return {
    availability: availabilityResult.rows[0] ?? null,
    timeOff: timeOffResult.rows,
    scheduledJobs: jobsResult.rows,
  };
}

