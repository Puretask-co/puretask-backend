// src/services/cleanerClientsService.ts
// Cleaner Portal: Previous Clients Management

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface CleanerClient {
  client_id: string;
  client_email: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  jobs_completed: number;
  jobs_successful: number;
  total_hours_worked: number | null;
  last_job_date: string | null;
  first_job_date: string | null;
  total_earnings_cents: number;
  addresses_serviced: string[];
  primary_address: string | null;
  client_indicator: "reliable" | "may_need_confirmation" | "caution";
  is_favorite: boolean;
  cleaner_notes: string | null;
  cleaner_preferences: string | null;
}

export interface CleanerClientJob {
  id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  status: string;
  address: string | null;
  cleaning_type: string | null;
  credit_amount: number;
  rating: number | null;
  duration_hours: number | null;
  has_before_photos: boolean;
  has_after_photos: boolean;
}

export interface CleanerClientNote {
  id: string;
  cleaner_id: string;
  client_id: string;
  notes: string | null;
  preferences: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientListFilters {
  sortBy?: "most_recent" | "most_jobs" | "highest_earnings" | "favorites";
  search?: string;
  favoriteOnly?: boolean;
  hasInvoices?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================
// Get Cleaner's Clients List
// ============================================

export async function getCleanerClients(
  cleanerId: string,
  filters: ClientListFilters = {}
): Promise<{ clients: CleanerClient[]; total: number }> {
  const { sortBy = "most_recent", search, favoriteOnly = false, limit = 50, offset = 0 } = filters;

  // Build WHERE clause
  const conditions: string[] = ["cleaner_id = $1"];
  const params: unknown[] = [cleanerId];
  let paramIndex = 2;

  if (favoriteOnly) {
    conditions.push("is_favorite = true");
  }

  if (search) {
    conditions.push(`(
      client_first_name ILIKE $${paramIndex} OR
      client_last_name ILIKE $${paramIndex} OR
      client_email ILIKE $${paramIndex} OR
      primary_address ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Build ORDER BY
  let orderBy = "last_job_date DESC NULLS LAST";
  switch (sortBy) {
    case "most_jobs":
      orderBy = "jobs_completed DESC";
      break;
    case "highest_earnings":
      orderBy = "total_earnings_cents DESC";
      break;
    case "favorites":
      orderBy = "is_favorite DESC, last_job_date DESC NULLS LAST";
      break;
  }

  const whereClause = conditions.join(" AND ");

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM cleaner_client_summary WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);

  // Get paginated results
  params.push(limit, offset);
  const result = await query<CleanerClient>(
    `
      SELECT 
        client_id,
        client_email,
        client_first_name,
        client_last_name,
        client_phone,
        jobs_completed::int,
        jobs_successful::int,
        total_hours_worked,
        last_job_date,
        first_job_date,
        total_earnings_cents::int,
        addresses_serviced,
        primary_address,
        client_indicator,
        is_favorite,
        cleaner_notes,
        cleaner_preferences
      FROM cleaner_client_summary
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    params
  );

  return { clients: result.rows, total };
}

// ============================================
// Get Single Client Profile (Cleaner View)
// ============================================

export async function getCleanerClientProfile(
  cleanerId: string,
  clientId: string
): Promise<CleanerClient | null> {
  const result = await query<CleanerClient>(
    `
      SELECT 
        client_id,
        client_email,
        client_first_name,
        client_last_name,
        client_phone,
        jobs_completed::int,
        jobs_successful::int,
        total_hours_worked,
        last_job_date,
        first_job_date,
        total_earnings_cents::int,
        addresses_serviced,
        primary_address,
        client_indicator,
        is_favorite,
        cleaner_notes,
        cleaner_preferences
      FROM cleaner_client_summary
      WHERE cleaner_id = $1 AND client_id = $2
    `,
    [cleanerId, clientId]
  );

  return result.rows[0] ?? null;
}

// ============================================
// Get Job History with Client
// ============================================

export async function getCleanerClientJobHistory(
  cleanerId: string,
  clientId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ jobs: CleanerClientJob[]; total: number }> {
  // Verify the cleaner has worked with this client
  const relationship = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `,
    [cleanerId, clientId]
  );

  if (!relationship.rows[0]?.exists) {
    return { jobs: [], total: 0 };
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE cleaner_id = $1 AND client_id = $2
    `,
    [cleanerId, clientId]
  );
  const total = parseInt(countResult.rows[0]?.count || "0", 10);

  // Get jobs with photo info
  const result = await query<CleanerClientJob>(
    `
      SELECT 
        j.id,
        j.scheduled_start_at,
        j.scheduled_end_at,
        j.actual_start_at,
        j.actual_end_at,
        j.status,
        j.address,
        j.cleaning_type,
        j.credit_amount,
        j.rating,
        EXTRACT(EPOCH FROM (j.actual_end_at - j.actual_start_at)) / 3600 AS duration_hours,
        EXISTS (SELECT 1 FROM job_photos WHERE job_id = j.id AND type = 'before') AS has_before_photos,
        EXISTS (SELECT 1 FROM job_photos WHERE job_id = j.id AND type = 'after') AS has_after_photos
      FROM jobs j
      WHERE j.cleaner_id = $1 AND j.client_id = $2
      ORDER BY j.scheduled_start_at DESC
      LIMIT $3 OFFSET $4
    `,
    [cleanerId, clientId, limit, offset]
  );

  return { jobs: result.rows, total };
}

// ============================================
// Cleaner Notes Management
// ============================================

export async function getCleanerClientNote(
  cleanerId: string,
  clientId: string
): Promise<CleanerClientNote | null> {
  const result = await query<CleanerClientNote>(
    `SELECT * FROM cleaner_client_notes WHERE cleaner_id = $1 AND client_id = $2`,
    [cleanerId, clientId]
  );
  return result.rows[0] ?? null;
}

export async function upsertCleanerClientNote(
  cleanerId: string,
  clientId: string,
  data: {
    notes?: string;
    preferences?: string;
    is_favorite?: boolean;
  }
): Promise<CleanerClientNote> {
  // Verify the cleaner has worked with this client
  const relationship = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `,
    [cleanerId, clientId]
  );

  if (!relationship.rows[0]?.exists) {
    throw Object.assign(new Error("You have not worked with this client"), { statusCode: 403 });
  }

  const result = await query<CleanerClientNote>(
    `
      INSERT INTO cleaner_client_notes (cleaner_id, client_id, notes, preferences, is_favorite)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cleaner_id, client_id) DO UPDATE
      SET 
        notes = COALESCE($3, cleaner_client_notes.notes),
        preferences = COALESCE($4, cleaner_client_notes.preferences),
        is_favorite = COALESCE($5, cleaner_client_notes.is_favorite),
        updated_at = NOW()
      RETURNING *
    `,
    [cleanerId, clientId, data.notes ?? null, data.preferences ?? null, data.is_favorite ?? null]
  );

  logger.info("cleaner_client_note_upserted", {
    cleanerId,
    clientId,
    isFavorite: data.is_favorite,
  });

  return result.rows[0];
}

export async function toggleClientFavorite(cleanerId: string, clientId: string): Promise<boolean> {
  // Verify the cleaner has worked with this client
  const relationship = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `,
    [cleanerId, clientId]
  );

  if (!relationship.rows[0]?.exists) {
    throw Object.assign(new Error("You have not worked with this client"), { statusCode: 403 });
  }

  const result = await query<{ is_favorite: boolean }>(
    `
      INSERT INTO cleaner_client_notes (cleaner_id, client_id, is_favorite)
      VALUES ($1, $2, true)
      ON CONFLICT (cleaner_id, client_id) DO UPDATE
      SET is_favorite = NOT cleaner_client_notes.is_favorite,
          updated_at = NOW()
      RETURNING is_favorite
    `,
    [cleanerId, clientId]
  );

  const isFavorite = result.rows[0]?.is_favorite ?? false;

  logger.info("cleaner_client_favorite_toggled", {
    cleanerId,
    clientId,
    isFavorite,
  });

  return isFavorite;
}

// ============================================
// Validate Cleaner-Client Relationship
// ============================================

export async function validateCleanerClientRelationship(
  cleanerId: string,
  clientId: string
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `,
    [cleanerId, clientId]
  );

  return result.rows[0]?.exists ?? false;
}
