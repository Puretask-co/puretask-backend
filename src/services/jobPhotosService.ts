// src/services/jobPhotosService.ts
// Job photos service for before/after images

import { query } from "../db/client";
import { logger } from "../lib/logger";
import type { JobPhoto, PhotoType } from "../types/db";

export interface UploadPhotoInput {
  jobId: string;
  cleanerId: string;
  photoUrl: string;
  type: PhotoType;
}

/**
 * Add a photo to a job
 */
export async function addJobPhoto(input: UploadPhotoInput): Promise<JobPhoto> {
  const { jobId, cleanerId, photoUrl, type } = input;

  // Verify cleaner is assigned to this job
  const jobResult = await query<{ cleaner_id: string | null; status: string }>(
    `SELECT cleaner_id, status FROM jobs WHERE id = $1`,
    [jobId]
  );

  if (jobResult.rows.length === 0) {
    throw new Error("Job not found");
  }

  const job = jobResult.rows[0];

  if (job.cleaner_id !== cleanerId) {
    throw new Error("You are not assigned to this job");
  }

  // Validate photo type based on job status
  if (type === "before" && !["accepted", "en_route", "in_progress"].includes(job.status)) {
    throw new Error("Before photos can only be uploaded before or during cleaning");
  }

  if (type === "after" && !["in_progress", "awaiting_client"].includes(job.status)) {
    throw new Error("After photos can only be uploaded during or after cleaning");
  }

  // Insert photo
  const result = await query<JobPhoto>(
    `
      INSERT INTO job_photos (job_id, cleaner_id, photo_url, type, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `,
    [jobId, cleanerId, photoUrl, type]
  );

  logger.info("job_photo_added", {
    jobId,
    cleanerId,
    type,
    photoId: result.rows[0].id,
  });

  // Meaningful action for level system (login streak anti-gaming)
  import("./cleanerLevelService")
    .then(({ recordMeaningfulAction }) => recordMeaningfulAction(cleanerId, "photo_uploaded"))
    .catch(() => {});

  return result.rows[0];
}

/**
 * Get all photos for a job
 */
export async function getJobPhotos(jobId: string): Promise<JobPhoto[]> {
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
 * Get photos by type
 */
export async function getJobPhotosByType(jobId: string, type: PhotoType): Promise<JobPhoto[]> {
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
 * Delete a photo
 */
export async function deleteJobPhoto(photoId: string, cleanerId: string): Promise<boolean> {
  const result = await query(
    `
      DELETE FROM job_photos
      WHERE id = $1 AND cleaner_id = $2
      RETURNING id
    `,
    [photoId, cleanerId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  logger.info("job_photo_deleted", { photoId, cleanerId });
  return true;
}

/**
 * Generate a presigned URL for upload (placeholder - implement with your storage provider)
 * This would integrate with S3, Cloudinary, etc.
 *
 * Security hardening:
 * - Max file size: 10MB
 * - TTL: 15 minutes (signed URL expires)
 * - EXIF stripping: Should be done client-side or in storage processing
 */
export async function getUploadUrl(options: {
  jobId: string;
  cleanerId: string;
  type: PhotoType;
  contentType: string;
  fileSize?: number; // In bytes
}): Promise<{ uploadUrl: string; publicUrl: string; expiresAt: string }> {
  const { jobId, cleanerId, type, contentType, fileSize } = options;

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(contentType)) {
    throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP");
  }

  // Validate file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileSize && fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Generate unique filename
  const timestamp = Date.now();
  const extension = contentType.split("/")[1];
  const filename = `jobs/${jobId}/${type}/${cleanerId}_${timestamp}.${extension}`;

  // TTL: 15 minutes for signed URL
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // TODO: Implement with your storage provider (S3, Cloudinary, etc.)
  // For now, return placeholder URLs
  // Import env at top of file for STORAGE_URL
  const baseUrl = "https://storage.puretask.com"; // Update with env.STORAGE_URL when configured

  // NOTE: In production, the signed URL should:
  // 1. Include Content-Type restriction
  // 2. Include Content-Length restriction (max 10MB)
  // 3. Expire after 15 minutes
  // 4. Be scoped to the specific filename
  // Example (S3): s3.getSignedUrl('putObject', { Bucket, Key: filename, Expires: 900, ContentType: contentType, ContentLength: fileSize })

  return {
    uploadUrl: `${baseUrl}/upload/${filename}?expires=${Math.floor(Date.now() / 1000) + 900}`, // 15 min TTL
    publicUrl: `${baseUrl}/${filename}`,
    expiresAt,
  };
}

/**
 * Count photos for a job
 */
export async function getPhotoCount(
  jobId: string
): Promise<{ before: number; after: number; total: number }> {
  const result = await query<{ type: PhotoType; count: string }>(
    `
      SELECT type, COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1
      GROUP BY type
    `,
    [jobId]
  );

  const counts = { before: 0, after: 0, total: 0 };

  for (const row of result.rows) {
    const count = parseInt(row.count, 10);
    counts[row.type] = count;
    counts.total += count;
  }

  return counts;
}
