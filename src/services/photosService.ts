// src/services/photosService.ts
// Job photos service for before/after images

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface JobPhoto {
  id: string;
  job_id: string;
  uploaded_by: string;
  type: "before" | "after";
  url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AddPhotoInput {
  jobId: string;
  uploadedBy: string;
  type: "before" | "after";
  url: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Photo Operations
// ============================================

/**
 * Add a photo to a job
 */
export async function addJobPhoto(input: AddPhotoInput): Promise<JobPhoto> {
  const result = await query<JobPhoto>(
    `
      INSERT INTO job_photos (
        job_id,
        uploaded_by,
        type,
        url,
        thumbnail_url,
        file_size,
        mime_type,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *
    `,
    [
      input.jobId,
      input.uploadedBy,
      input.type,
      input.url,
      input.thumbnailUrl ?? null,
      input.fileSize ?? null,
      input.mimeType ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  const photo = result.rows[0];

  logger.info("job_photo_added", {
    photoId: photo.id,
    jobId: input.jobId,
    type: input.type,
    uploadedBy: input.uploadedBy,
  });

  return photo;
}

/**
 * List all photos for a job
 */
export async function listJobPhotos(jobId: string): Promise<JobPhoto[]> {
  const result = await query<JobPhoto>(
    `
      SELECT *
      FROM job_photos
      WHERE job_id = $1
      ORDER BY type ASC, created_at ASC
    `,
    [jobId]
  );

  return result.rows;
}

/**
 * Get photos by type for a job
 */
export async function getJobPhotosByType(
  jobId: string,
  type: "before" | "after"
): Promise<JobPhoto[]> {
  const result = await query<JobPhoto>(
    `
      SELECT *
      FROM job_photos
      WHERE job_id = $1 AND type = $2
      ORDER BY created_at ASC
    `,
    [jobId, type]
  );

  return result.rows;
}

/**
 * Get a single photo by ID
 */
export async function getPhotoById(photoId: string): Promise<JobPhoto | null> {
  const result = await query<JobPhoto>(`SELECT * FROM job_photos WHERE id = $1`, [photoId]);

  return result.rows[0] ?? null;
}

/**
 * Delete a photo
 */
export async function deleteJobPhoto(
  photoId: string,
  userId: string,
  isAdmin = false
): Promise<boolean> {
  // Admin can delete any photo, users can only delete their own
  const whereClause = isAdmin ? `WHERE id = $1` : `WHERE id = $1 AND uploaded_by = $2`;

  const params = isAdmin ? [photoId] : [photoId, userId];

  const result = await query(`DELETE FROM job_photos ${whereClause} RETURNING id`, params);

  if (result.rows.length > 0) {
    logger.info("job_photo_deleted", {
      photoId,
      deletedBy: userId,
      isAdmin,
    });
    return true;
  }

  return false;
}

/**
 * Check if a job has required photos
 * (e.g., before starting, cleaner must upload before photos)
 */
export async function hasRequiredPhotos(
  jobId: string,
  type: "before" | "after",
  minRequired = 1
): Promise<boolean> {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1 AND type = $2
    `,
    [jobId, type]
  );

  const count = parseInt(result.rows[0]?.count || "0", 10);
  return count >= minRequired;
}

/**
 * Get photo counts for a job
 */
export async function getJobPhotoCounts(jobId: string): Promise<{
  before: number;
  after: number;
  total: number;
}> {
  const result = await query<{ type: string; count: string }>(
    `
      SELECT type, COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1
      GROUP BY type
    `,
    [jobId]
  );

  let before = 0;
  let after = 0;

  for (const row of result.rows) {
    if (row.type === "before") before = parseInt(row.count, 10);
    if (row.type === "after") after = parseInt(row.count, 10);
  }

  return {
    before,
    after,
    total: before + after,
  };
}

/**
 * Get recent photos uploaded by a cleaner
 */
export async function getCleanerRecentPhotos(cleanerId: string, limit = 20): Promise<JobPhoto[]> {
  const result = await query<JobPhoto>(
    `
      SELECT *
      FROM job_photos
      WHERE uploaded_by = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [cleanerId, limit]
  );

  return result.rows;
}
