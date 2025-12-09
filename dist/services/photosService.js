"use strict";
// src/services/photosService.ts
// Job photos service for before/after images
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJobPhoto = addJobPhoto;
exports.listJobPhotos = listJobPhotos;
exports.getJobPhotosByType = getJobPhotosByType;
exports.getPhotoById = getPhotoById;
exports.deleteJobPhoto = deleteJobPhoto;
exports.hasRequiredPhotos = hasRequiredPhotos;
exports.getJobPhotoCounts = getJobPhotoCounts;
exports.getCleanerRecentPhotos = getCleanerRecentPhotos;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Photo Operations
// ============================================
/**
 * Add a photo to a job
 */
async function addJobPhoto(input) {
    const result = await (0, client_1.query)(`
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
    `, [
        input.jobId,
        input.uploadedBy,
        input.type,
        input.url,
        input.thumbnailUrl ?? null,
        input.fileSize ?? null,
        input.mimeType ?? null,
        JSON.stringify(input.metadata ?? {}),
    ]);
    const photo = result.rows[0];
    logger_1.logger.info("job_photo_added", {
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
async function listJobPhotos(jobId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_photos
      WHERE job_id = $1
      ORDER BY type ASC, created_at ASC
    `, [jobId]);
    return result.rows;
}
/**
 * Get photos by type for a job
 */
async function getJobPhotosByType(jobId, type) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_photos
      WHERE job_id = $1 AND type = $2
      ORDER BY created_at ASC
    `, [jobId, type]);
    return result.rows;
}
/**
 * Get a single photo by ID
 */
async function getPhotoById(photoId) {
    const result = await (0, client_1.query)(`SELECT * FROM job_photos WHERE id = $1`, [photoId]);
    return result.rows[0] ?? null;
}
/**
 * Delete a photo
 */
async function deleteJobPhoto(photoId, userId, isAdmin = false) {
    // Admin can delete any photo, users can only delete their own
    const whereClause = isAdmin
        ? `WHERE id = $1`
        : `WHERE id = $1 AND uploaded_by = $2`;
    const params = isAdmin ? [photoId] : [photoId, userId];
    const result = await (0, client_1.query)(`DELETE FROM job_photos ${whereClause} RETURNING id`, params);
    if (result.rows.length > 0) {
        logger_1.logger.info("job_photo_deleted", {
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
async function hasRequiredPhotos(jobId, type, minRequired = 1) {
    const result = await (0, client_1.query)(`
      SELECT COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1 AND type = $2
    `, [jobId, type]);
    const count = parseInt(result.rows[0]?.count || "0", 10);
    return count >= minRequired;
}
/**
 * Get photo counts for a job
 */
async function getJobPhotoCounts(jobId) {
    const result = await (0, client_1.query)(`
      SELECT type, COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1
      GROUP BY type
    `, [jobId]);
    let before = 0;
    let after = 0;
    for (const row of result.rows) {
        if (row.type === "before")
            before = parseInt(row.count, 10);
        if (row.type === "after")
            after = parseInt(row.count, 10);
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
async function getCleanerRecentPhotos(cleanerId, limit = 20) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_photos
      WHERE uploaded_by = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [cleanerId, limit]);
    return result.rows;
}
