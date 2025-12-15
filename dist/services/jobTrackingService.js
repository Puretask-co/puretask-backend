"use strict";
// src/services/jobTrackingService.ts
// Complete job live tracking for clients and cleaners
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobTrackingState = getJobTrackingState;
exports.startEnRoute = startEnRoute;
exports.markArrived = markArrived;
exports.checkIn = checkIn;
exports.checkOut = checkOut;
exports.updateCleanerLocation = updateCleanerLocation;
exports.approveJob = approveJob;
exports.disputeJob = disputeJob;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
const reliabilityService_1 = require("./reliabilityService");
const creditsService_1 = require("./creditsService");
const payoutsService_1 = require("./payoutsService");
const env_1 = require("../config/env");
// ============================================
// Timeline & Tracking
// ============================================
/**
 * Get full job tracking state for client view
 */
async function getJobTrackingState(jobId) {
    // Get job details
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    const job = jobResult.rows[0];
    // Get timeline events
    const eventsResult = await (0, client_1.query)(`
      SELECT event_type, created_at as timestamp, payload, actor_type
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at ASC
    `, [jobId]);
    // Get photos
    const photosResult = await (0, client_1.query)(`SELECT type, url FROM job_photos WHERE job_id = $1`, [jobId]);
    const photos = {
        before: photosResult.rows.filter(p => p.type === "before").map(p => p.url),
        after: photosResult.rows.filter(p => p.type === "after").map(p => p.url),
    };
    // Get cleaner info if assigned
    let cleaner = null;
    let currentLocation = null;
    let eta = null;
    if (job.cleaner_id) {
        const cleanerResult = await (0, client_1.query)(`
        SELECT u.id, u.email, cp.tier, cp.reliability_score
        FROM users u
        JOIN cleaner_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
      `, [job.cleaner_id]);
        if (cleanerResult.rows.length > 0) {
            const c = cleanerResult.rows[0];
            cleaner = {
                id: c.id,
                name: c.email.split("@")[0], // Placeholder - use real name field
                tier: c.tier,
                rating: c.reliability_score / 20, // Convert to 5-star scale
                photo: null,
            };
        }
        // Get last known location (from events)
        const locationEvent = eventsResult.rows
            .filter(e => e.event_type === "cleaner.location_updated")
            .pop();
        if (locationEvent?.payload) {
            const loc = locationEvent.payload;
            currentLocation = {
                latitude: loc.latitude,
                longitude: loc.longitude,
                updatedAt: locationEvent.timestamp,
            };
            // Calculate ETA (simplified)
            if (job.status === "on_my_way" && job.latitude && job.longitude) {
                const distance = calculateDistance(loc.latitude, loc.longitude, job.latitude, job.longitude);
                eta = {
                    minutes: Math.round(distance * 3), // Rough estimate: 3 min per mile
                    distance: `${distance.toFixed(1)} mi`,
                };
            }
        }
    }
    // Extract key timestamps from events
    const getEventTime = (type) => {
        const event = eventsResult.rows.find(e => e.event_type === type);
        return event?.timestamp ?? null;
    };
    return {
        jobId: job.id,
        status: job.status,
        timeline: eventsResult.rows,
        currentLocation,
        eta,
        photos,
        cleaner,
        times: {
            scheduled_start: job.scheduled_start_at,
            scheduled_end: job.scheduled_end_at,
            actual_start: job.actual_start_at,
            actual_end: job.actual_end_at,
            en_route_at: getEventTime("job.cleaner_en_route"),
            arrived_at: getEventTime("job.cleaner_arrived"),
        },
    };
}
// ============================================
// Cleaner Actions
// ============================================
/**
 * Cleaner starts heading to job
 */
async function startEnRoute(jobId, cleanerId, location) {
    // Verify job belongs to cleaner
    const job = await verifyCleanerJob(jobId, cleanerId);
    if (job.status !== "accepted") {
        throw Object.assign(new Error("Job must be in accepted status"), { statusCode: 400 });
    }
    await (0, client_1.query)(`UPDATE jobs SET status = 'on_my_way', updated_at = NOW() WHERE id = $1`, [jobId]);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "cleaner",
        actorId: cleanerId,
        eventName: "job.cleaner_en_route",
        payload: { location },
    });
    logger_1.logger.info("job_cleaner_en_route", { jobId, cleanerId });
}
/**
 * Cleaner arrives at location
 * Per policy: GPS check-in/out within 250 meters of job location
 */
async function markArrived(jobId, cleanerId, location) {
    const job = await verifyCleanerJob(jobId, cleanerId);
    if (job.status !== "on_my_way") {
        throw Object.assign(new Error("Must be en route first"), { statusCode: 400 });
    }
    // Verify GPS proximity (per policy: within 250 meters)
    if (job.latitude && job.longitude) {
        const distanceMeters = calculateDistanceMeters(location.latitude, location.longitude, job.latitude, job.longitude);
        const maxRadius = env_1.env.GPS_CHECKIN_RADIUS_METERS;
        if (distanceMeters > maxRadius) {
            logger_1.logger.warn("job_arrival_distance_warning", {
                jobId,
                cleanerId,
                distanceMeters,
                maxRadius,
                exceeded: true,
            });
            throw Object.assign(new Error(`GPS check-in failed: You must be within ${maxRadius} meters of the job location. Current distance: ${Math.round(distanceMeters)} meters`), { statusCode: 400, code: "GPS_TOO_FAR" });
        }
    }
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "cleaner",
        actorId: cleanerId,
        eventName: "job.cleaner_arrived",
        payload: { location, distanceMeters: job.latitude && job.longitude ? calculateDistanceMeters(location.latitude, location.longitude, job.latitude, job.longitude) : null },
    });
    logger_1.logger.info("job_cleaner_arrived", { jobId, cleanerId });
}
/**
 * Cleaner checks in and starts job
 * Per policy: GPS check-in within 250 meters of job location
 */
async function checkIn(jobId, cleanerId, location, beforePhotos) {
    const job = await verifyCleanerJob(jobId, cleanerId);
    if (!["on_my_way", "accepted"].includes(job.status)) {
        throw Object.assign(new Error("Invalid status for check-in"), { statusCode: 400 });
    }
    // Verify GPS proximity (per policy: within 250 meters)
    if (job.latitude && job.longitude) {
        const distanceMeters = calculateDistanceMeters(location.latitude, location.longitude, job.latitude, job.longitude);
        const maxRadius = env_1.env.GPS_CHECKIN_RADIUS_METERS;
        if (distanceMeters > maxRadius) {
            logger_1.logger.warn("job_checkin_distance_warning", {
                jobId,
                cleanerId,
                distanceMeters,
                maxRadius,
            });
            throw Object.assign(new Error(`GPS check-in failed: You must be within ${maxRadius} meters of the job location. Current distance: ${Math.round(distanceMeters)} meters`), { statusCode: 400, code: "GPS_TOO_FAR" });
        }
    }
    // Require at least 1 before photo
    if (beforePhotos.length === 0) {
        throw Object.assign(new Error("At least one before photo required"), { statusCode: 400 });
    }
    // Save photos
    for (const url of beforePhotos) {
        await (0, client_1.query)(`INSERT INTO job_photos (job_id, uploaded_by, type, url) VALUES ($1, $2, 'before', $3)`, [jobId, cleanerId, url]);
    }
    // Update job status
    await (0, client_1.query)(`UPDATE jobs SET status = 'in_progress', actual_start_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "cleaner",
        actorId: cleanerId,
        eventName: "job.checked_in",
        payload: { location, photoCount: beforePhotos.length },
    });
    logger_1.logger.info("job_checked_in", { jobId, cleanerId, photoCount: beforePhotos.length });
}
/**
 * Cleaner checks out and completes job
 * Per Photo Proof policy: Minimum 3 photos total (before + after combined)
 */
async function checkOut(jobId, cleanerId, afterPhotos, notes) {
    const job = await verifyCleanerJob(jobId, cleanerId);
    if (job.status !== "in_progress") {
        throw Object.assign(new Error("Job must be in progress"), { statusCode: 400 });
    }
    // Require at least 1 after photo
    if (afterPhotos.length === 0) {
        throw Object.assign(new Error("At least one after photo required"), { statusCode: 400 });
    }
    // Get count of existing before photos
    const beforeResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM job_photos WHERE job_id = $1 AND type = 'before'`, [jobId]);
    const beforeCount = Number(beforeResult.rows[0]?.count || 0);
    const totalPhotos = beforeCount + afterPhotos.length;
    // Per Photo Proof policy: Minimum 3 photos total
    const minPhotos = env_1.env.MIN_PHOTOS_TOTAL;
    if (totalPhotos < minPhotos) {
        throw Object.assign(new Error(`Minimum ${minPhotos} photos required (before + after combined). You have ${beforeCount} before photos and ${afterPhotos.length} after photos. Please add ${minPhotos - totalPhotos} more.`), { statusCode: 400, code: "INSUFFICIENT_PHOTOS" });
    }
    // Save photos
    for (const url of afterPhotos) {
        await (0, client_1.query)(`INSERT INTO job_photos (job_id, uploaded_by, type, url) VALUES ($1, $2, 'after', $3)`, [jobId, cleanerId, url]);
    }
    // Track photo compliance for reliability bonus
    await (0, client_1.query)(`
      INSERT INTO photo_compliance (job_id, cleaner_id, total_photos, before_photos, after_photos, meets_minimum)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (job_id) DO UPDATE
      SET total_photos = $3, before_photos = $4, after_photos = $5, meets_minimum = true
    `, [jobId, cleanerId, totalPhotos, beforeCount, afterPhotos.length]);
    // Update job status
    await (0, client_1.query)(`
      UPDATE jobs 
      SET status = 'awaiting_approval', 
          actual_end_at = NOW(), 
          client_notes = COALESCE(client_notes, '') || $2,
          updated_at = NOW() 
      WHERE id = $1
    `, [jobId, notes ? `\n[Cleaner notes]: ${notes}` : ""]);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "cleaner",
        actorId: cleanerId,
        eventName: "job.checked_out",
        payload: { totalPhotos, beforePhotos: beforeCount, afterPhotos: afterPhotos.length, notes },
    });
    logger_1.logger.info("job_checked_out", {
        jobId,
        cleanerId,
        totalPhotos,
        beforePhotos: beforeCount,
        afterPhotos: afterPhotos.length,
    });
}
/**
 * Update cleaner location during job
 */
async function updateCleanerLocation(jobId, cleanerId, location) {
    // Just verify and log - don't change job state
    await verifyCleanerJob(jobId, cleanerId);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "cleaner",
        actorId: cleanerId,
        eventName: "cleaner.location_updated",
        payload: { ...location },
    });
}
// ============================================
// Client Actions
// ============================================
/**
 * V1 HARDENING: Client approves completed job (atomic transaction)
 * - Updates job status to 'completed' (with WHERE clause guard)
 * - Releases escrowed credits to cleaner
 * - Creates payout record
 * - Handles tip if provided
 * All in a single transaction to prevent partial state
 */
async function approveJob(jobId, clientId, rating, tip, feedback) {
    const job = await verifyClientJob(jobId, clientId);
    if (job.status !== "awaiting_approval") {
        throw Object.assign(new Error("Job not awaiting approval"), { statusCode: 400 });
    }
    // V1 HARDENING: Use transaction to ensure atomicity
    return (0, client_1.withTransaction)(async (client) => {
        // Step 1: Update job status with WHERE clause guard (prevents race conditions)
        const updateResult = await client.query(`
        UPDATE jobs 
        SET status = 'completed', 
            rating = $2,
            updated_at = NOW() 
        WHERE id = $1
          AND status = 'awaiting_approval'
        RETURNING *
      `, [jobId, rating]);
        if (updateResult.rows.length === 0) {
            // Job was already completed or status changed (race condition)
            throw Object.assign(new Error("Job status changed - cannot approve"), { statusCode: 409, code: "CONFLICT" });
        }
        const updatedJob = updateResult.rows[0];
        // Step 2: Release escrowed credits to cleaner (if cleaner assigned and credits exist)
        if (updatedJob.cleaner_id && updatedJob.credit_amount > 0) {
            await (0, creditsService_1.releaseJobCreditsToCleaner)(updatedJob.cleaner_id, jobId, updatedJob.credit_amount);
            // Step 3: Create payout record
            const jobForPayout = {
                id: updatedJob.id,
                cleaner_id: updatedJob.cleaner_id,
                credit_amount: updatedJob.credit_amount,
            };
            await (0, payoutsService_1.recordEarningsForCompletedJob)(jobForPayout);
        }
        // Step 4: Handle tip if provided (within transaction)
        if (tip && tip > 0 && updatedJob.cleaner_id) {
            await client.query(`INSERT INTO credit_ledger (user_id, job_id, delta_credits, reason) VALUES ($1, $2, $3, 'adjustment')`, [updatedJob.cleaner_id, jobId, tip]);
        }
        // Step 5: Publish event (after transaction commits)
        await (0, events_1.publishEvent)({
            jobId,
            actorType: "client",
            actorId: clientId,
            eventName: "job.approved",
            payload: { rating, tip, feedback },
        });
        // Step 6: Update cleaner reliability (async, non-critical)
        if (updatedJob.cleaner_id) {
            // Don't await - let it run async to not block transaction
            (0, reliabilityService_1.updateCleanerReliability)(updatedJob.cleaner_id, "job_completed").catch((err) => {
                logger_1.logger.error("reliability_update_failed_after_approval", {
                    cleanerId: updatedJob.cleaner_id,
                    jobId,
                    error: err.message,
                });
            });
        }
        logger_1.logger.info("job_approved", { jobId, clientId, rating, tip, cleanerId: updatedJob.cleaner_id });
    });
}
/**
 * Client disputes completed job
 */
async function disputeJob(jobId, clientId, reason, requestedRefund) {
    const job = await verifyClientJob(jobId, clientId);
    if (!["awaiting_approval", "completed"].includes(job.status)) {
        throw Object.assign(new Error("Cannot dispute job in current status"), { statusCode: 400 });
    }
    // Create dispute
    await (0, client_1.query)(`
      INSERT INTO disputes (job_id, client_id, client_notes, status, metadata)
      VALUES ($1, $2, $3, 'open', $4::jsonb)
    `, [jobId, clientId, reason, JSON.stringify({ requestedRefund })]);
    // Update job status
    await (0, client_1.query)(`UPDATE jobs SET status = 'disputed', updated_at = NOW() WHERE id = $1`, [jobId]);
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "client",
        actorId: clientId,
        eventName: "job.disputed",
        payload: { reason, requestedRefund },
    });
    logger_1.logger.info("job_disputed", { jobId, clientId, requestedRefund });
}
// ============================================
// Helpers
// ============================================
async function verifyCleanerJob(jobId, cleanerId) {
    const result = await (0, client_1.query)(`SELECT id, status, cleaner_id, latitude, longitude FROM jobs WHERE id = $1`, [jobId]);
    const job = result.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    if (job.cleaner_id !== cleanerId) {
        throw Object.assign(new Error("Not assigned to this job"), { statusCode: 403 });
    }
    return job;
}
async function verifyClientJob(jobId, clientId) {
    const result = await (0, client_1.query)(`SELECT id, status, client_id, cleaner_id, credit_amount FROM jobs WHERE id = $1`, [jobId]);
    const job = result.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    if (job.client_id !== clientId) {
        throw Object.assign(new Error("Not your job"), { statusCode: 403 });
    }
    return job;
}
/**
 * Calculate distance in miles (for backwards compatibility)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
/**
 * Calculate distance in meters (for GPS check-in per policy: 250m radius)
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return deg * (Math.PI / 180);
}
