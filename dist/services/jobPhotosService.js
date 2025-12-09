"use strict";
// src/services/jobPhotosService.ts
// Job photos service for before/after images
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJobPhoto = addJobPhoto;
exports.getJobPhotos = getJobPhotos;
exports.getJobPhotosByType = getJobPhotosByType;
exports.deleteJobPhoto = deleteJobPhoto;
exports.getUploadUrl = getUploadUrl;
exports.getPhotoCount = getPhotoCount;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
/**
 * Add a photo to a job
 */
async function addJobPhoto(input) {
    const { jobId, cleanerId, photoUrl, type } = input;
    // Verify cleaner is assigned to this job
    const jobResult = await (0, client_1.query)(`SELECT cleaner_id, status FROM jobs WHERE id = $1`, [jobId]);
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
    const result = await (0, client_1.query)(`
      INSERT INTO job_photos (job_id, cleaner_id, photo_url, type, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [jobId, cleanerId, photoUrl, type]);
    logger_1.logger.info("job_photo_added", {
        jobId,
        cleanerId,
        type,
        photoId: result.rows[0].id,
    });
    return result.rows[0];
}
/**
 * Get all photos for a job
 */
async function getJobPhotos(jobId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_photos
      WHERE job_id = $1
      ORDER BY type ASC, created_at ASC
    `, [jobId]);
    return result.rows;
}
/**
 * Get photos by type
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
 * Delete a photo
 */
async function deleteJobPhoto(photoId, cleanerId) {
    const result = await (0, client_1.query)(`
      DELETE FROM job_photos
      WHERE id = $1 AND cleaner_id = $2
      RETURNING id
    `, [photoId, cleanerId]);
    if (result.rows.length === 0) {
        return false;
    }
    logger_1.logger.info("job_photo_deleted", { photoId, cleanerId });
    return true;
}
/**
 * Generate a presigned URL for upload (placeholder - implement with your storage provider)
 * This would integrate with S3, Cloudinary, etc.
 */
async function getUploadUrl(options) {
    const { jobId, cleanerId, type, contentType } = options;
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
        throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP");
    }
    // Generate unique filename
    const timestamp = Date.now();
    const extension = contentType.split("/")[1];
    const filename = `jobs/${jobId}/${type}/${cleanerId}_${timestamp}.${extension}`;
    // TODO: Implement with your storage provider (S3, Cloudinary, etc.)
    // For now, return placeholder URLs
    // Import env at top of file for STORAGE_URL
    const baseUrl = "https://storage.puretask.com"; // Update with env.STORAGE_URL when configured
    return {
        uploadUrl: `${baseUrl}/upload/${filename}`,
        publicUrl: `${baseUrl}/${filename}`,
    };
}
/**
 * Count photos for a job
 */
async function getPhotoCount(jobId) {
    const result = await (0, client_1.query)(`
      SELECT type, COUNT(*) as count
      FROM job_photos
      WHERE job_id = $1
      GROUP BY type
    `, [jobId]);
    const counts = { before: 0, after: 0, total: 0 };
    for (const row of result.rows) {
        const count = parseInt(row.count, 10);
        counts[row.type] = count;
        counts.total += count;
    }
    return counts;
}
