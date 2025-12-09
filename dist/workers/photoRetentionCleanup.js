"use strict";
// src/workers/photoRetentionCleanup.ts
// Photo retention cleanup worker (per Photo Proof policy: 90 days retention)
//
// Per Privacy Policy:
// "Photos are retained for 90 days after booking completion, then automatically deleted
//  unless a dispute is open."
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhotoRetentionCleanup = runPhotoRetentionCleanup;
exports.getPhotoRetentionStats = getPhotoRetentionStats;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
const BATCH_SIZE = 100;
/**
 * Find photos older than retention period (90 days by default)
 * Excludes photos for jobs with open disputes
 */
async function findExpiredPhotos() {
    const retentionDays = env_1.env.PHOTO_RETENTION_DAYS;
    const result = await (0, client_1.query)(`
      SELECT jp.id, jp.job_id, jp.url, jp.type, jp.created_at
      FROM job_photos jp
      JOIN jobs j ON j.id = jp.job_id
      LEFT JOIN disputes d ON d.job_id = jp.job_id AND d.status = 'open'
      WHERE jp.created_at < NOW() - INTERVAL '1 day' * $1
        AND j.status IN ('completed', 'cancelled')
        AND d.id IS NULL  -- No open disputes
      ORDER BY jp.created_at ASC
      LIMIT $2
    `, [retentionDays, BATCH_SIZE]);
    return result.rows;
}
/**
 * Delete a single photo record
 * Note: Actual S3 deletion should be handled by a separate process or S3 lifecycle rules
 */
async function deletePhotoRecord(photo) {
    try {
        await (0, client_1.query)(`DELETE FROM job_photos WHERE id = $1`, [photo.id]);
        logger_1.logger.info("photo_record_deleted", {
            photoId: photo.id,
            jobId: photo.job_id,
            type: photo.type,
            age: `${env_1.env.PHOTO_RETENTION_DAYS}+ days`,
        });
    }
    catch (error) {
        logger_1.logger.error("photo_deletion_failed", {
            photoId: photo.id,
            error: error.message,
        });
        throw error;
    }
}
/**
 * Main worker function - runs photo retention cleanup
 * Per Photo Proof policy: Photos retained for 90 days after completion
 */
async function runPhotoRetentionCleanup() {
    logger_1.logger.info("photo_retention_cleanup_started", {
        retentionDays: env_1.env.PHOTO_RETENTION_DAYS,
        batchSize: BATCH_SIZE,
    });
    let deleted = 0;
    let failed = 0;
    let hasMore = true;
    while (hasMore) {
        const expiredPhotos = await findExpiredPhotos();
        if (expiredPhotos.length === 0) {
            hasMore = false;
            break;
        }
        for (const photo of expiredPhotos) {
            try {
                await deletePhotoRecord(photo);
                deleted++;
            }
            catch {
                failed++;
            }
        }
        // Continue if we got a full batch (there might be more)
        hasMore = expiredPhotos.length === BATCH_SIZE;
    }
    logger_1.logger.info("photo_retention_cleanup_completed", {
        deleted,
        failed,
        retentionDays: env_1.env.PHOTO_RETENTION_DAYS,
    });
    return { deleted, failed };
}
/**
 * Get photo retention statistics
 */
async function getPhotoRetentionStats() {
    const retentionDays = env_1.env.PHOTO_RETENTION_DAYS;
    const result = await (0, client_1.query)(`
      WITH stats AS (
        SELECT 
          jp.id,
          jp.created_at,
          CASE WHEN d.id IS NOT NULL AND d.status = 'open' THEN true ELSE false END as has_open_dispute,
          jp.created_at + INTERVAL '1 day' * $1 as expires_at
        FROM job_photos jp
        JOIN jobs j ON j.id = jp.job_id
        LEFT JOIN disputes d ON d.job_id = jp.job_id
      )
      SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '7 days' AND NOT has_open_dispute)::text as expiring_7,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '30 days' AND NOT has_open_dispute)::text as expiring_30,
        COUNT(*) FILTER (WHERE has_open_dispute)::text as protected
      FROM stats
    `, [retentionDays]);
    const row = result.rows[0];
    return {
        totalPhotos: Number(row?.total || 0),
        expiringIn7Days: Number(row?.expiring_7 || 0),
        expiringIn30Days: Number(row?.expiring_30 || 0),
        protectedByDispute: Number(row?.protected || 0),
    };
}
