"use strict";
// src/core/availabilityService.ts
// Cleaner Availability System (2.5)
//
// Allows:
// - Hours
// - Days
// - Blackout periods
// - Travel radius
// - Real-time conflict detection
//
// Used to determine:
// - Whether a reschedule request is "reasonable"
// - Whether declines are justified
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityService = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Main Service
// ============================================
class AvailabilityService {
    // ========================================
    // Weekly Availability Management
    // ========================================
    /**
     * Set weekly availability blocks for a cleaner
     */
    static async setWeeklyAvailability(cleanerId, blocks) {
        // Remove existing blocks
        await (0, client_1.query)(`DELETE FROM availability_blocks WHERE cleaner_id = $1`, [String(cleanerId)]);
        // Insert new blocks
        for (const block of blocks) {
            await (0, client_1.query)(`INSERT INTO availability_blocks (cleaner_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`, [String(cleanerId), block.dayOfWeek, block.startTime, block.endTime]);
        }
        logger_1.logger.info("weekly_availability_set", {
            cleanerId,
            blockCount: blocks.length,
        });
    }
    /**
     * Get weekly availability for a cleaner
     */
    static async getWeeklyAvailability(cleanerId) {
        const result = await (0, client_1.query)(`SELECT id, cleaner_id, day_of_week, start_time, end_time
       FROM availability_blocks
       WHERE cleaner_id = $1
       ORDER BY day_of_week, start_time`, [String(cleanerId)]);
        const blocks = result.rows.map(row => ({
            id: Number(row.id),
            cleanerId: Number(row.cleaner_id),
            dayOfWeek: Number(row.day_of_week),
            startTime: row.start_time,
            endTime: row.end_time,
        }));
        return { cleanerId, blocks };
    }
    /**
     * Get availability blocks for a specific day
     */
    static async getBlocksForDay(cleanerId, dayOfWeek) {
        const result = await (0, client_1.query)(`SELECT * FROM availability_blocks
       WHERE cleaner_id = $1 AND day_of_week = $2
       ORDER BY start_time`, [String(cleanerId), dayOfWeek]);
        return result.rows.map(row => ({
            id: Number(row.id),
            cleanerId: Number(row.cleaner_id),
            dayOfWeek: Number(row.day_of_week),
            startTime: row.start_time,
            endTime: row.end_time,
        }));
    }
    // ========================================
    // Blackout Period Management
    // ========================================
    /**
     * Add a blackout period for a cleaner
     */
    static async addBlackoutPeriod(cleanerId, startTs, endTs, reason) {
        const result = await (0, client_1.query)(`INSERT INTO blackout_periods (cleaner_id, start_ts, end_ts, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`, [String(cleanerId), startTs.toISOString(), endTs.toISOString(), reason || null]);
        const blackout = {
            id: Number(result.rows[0].id),
            cleanerId,
            startTs,
            endTs,
            reason: reason || null,
        };
        logger_1.logger.info("blackout_period_added", {
            cleanerId,
            startTs,
            endTs,
            reason,
        });
        return blackout;
    }
    /**
     * Remove a blackout period
     */
    static async removeBlackoutPeriod(blackoutId) {
        await (0, client_1.query)(`DELETE FROM blackout_periods WHERE id = $1`, [blackoutId]);
        logger_1.logger.info("blackout_period_removed", { blackoutId });
    }
    /**
     * Get all blackout periods for a cleaner
     */
    static async getBlackoutPeriods(cleanerId) {
        const result = await (0, client_1.query)(`SELECT * FROM blackout_periods
       WHERE cleaner_id = $1
       ORDER BY start_ts`, [String(cleanerId)]);
        return result.rows.map(row => ({
            id: Number(row.id),
            cleanerId: Number(row.cleaner_id),
            startTs: new Date(row.start_ts),
            endTs: new Date(row.end_ts),
            reason: row.reason,
        }));
    }
    /**
     * Get overlapping blackout period if any
     */
    static async getOverlappingBlackout(cleanerId, startTs, endTs) {
        const result = await (0, client_1.query)(`SELECT * FROM blackout_periods
       WHERE cleaner_id = $1
       AND start_ts < $3
       AND end_ts > $2
       LIMIT 1`, [String(cleanerId), startTs.toISOString(), endTs.toISOString()]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: Number(row.id),
            cleanerId: Number(row.cleaner_id),
            startTs: new Date(row.start_ts),
            endTs: new Date(row.end_ts),
            reason: row.reason,
        };
    }
    // ========================================
    // Availability Checking
    // ========================================
    /**
     * Core availability check
     *
     * Checks:
     * 1. Weekly availability blocks
     * 2. Blackout period overrides
     * 3. Overlapping jobs
     * 4. (Optional) Travel radius
     */
    static async isCleanerAvailable(cleanerId, requestedStart, requestedEnd) {
        // 1. Check weekly availability
        const dayOfWeek = requestedStart.getDay();
        const blocks = await this.getBlocksForDay(cleanerId, dayOfWeek);
        const timeStr = (d) => d.toTimeString().substring(0, 5); // 'HH:MM'
        const reqStartStr = timeStr(requestedStart);
        const reqEndStr = timeStr(requestedEnd);
        const withinAnyBlock = blocks.some(b => {
            return b.startTime <= reqStartStr && b.endTime >= reqEndStr;
        });
        if (!withinAnyBlock) {
            return {
                available: false,
                reason: 'outside_availability',
            };
        }
        // 2. Check blackout periods
        const blackout = await this.getOverlappingBlackout(cleanerId, requestedStart, requestedEnd);
        if (blackout) {
            return {
                available: false,
                reason: 'blackout_period',
                blackout,
            };
        }
        // 3. Check overlapping jobs
        const conflictJob = await this.findOverlappingJob(cleanerId, requestedStart, requestedEnd);
        if (conflictJob) {
            return {
                available: false,
                reason: 'job_conflict',
                conflictJob,
            };
        }
        // All checks passed
        return { available: true };
    }
    /**
     * Find overlapping job for a cleaner
     */
    static async findOverlappingJob(cleanerId, startTs, endTs) {
        const result = await (0, client_1.query)(`SELECT * FROM jobs
       WHERE cleaner_id = $1
       AND status NOT IN ('cancelled', 'completed')
       AND scheduled_start_at < $3
       AND scheduled_end_at > $2
       LIMIT 1`, [String(cleanerId), startTs.toISOString(), endTs.toISOString()]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: Number(row.id),
            clientId: Number(row.client_id),
            cleanerId: Number(row.cleaner_id),
            startTime: new Date(row.scheduled_start_at),
            endTime: new Date(row.scheduled_end_at),
            heldCredits: Number(row.credit_amount || 0),
            status: row.status,
        };
    }
    // ========================================
    // Travel Radius
    // ========================================
    /**
     * Set travel radius for a cleaner
     */
    static async setTravelRadius(cleanerId, radiusKm, homeLatitude, homeLongitude) {
        await (0, client_1.query)(`UPDATE cleaner_profiles
       SET travel_radius_km = $2, latitude = $3, longitude = $4, updated_at = NOW()
       WHERE user_id = $1`, [String(cleanerId), radiusKm, homeLatitude, homeLongitude]);
        logger_1.logger.info("travel_radius_set", {
            cleanerId,
            radiusKm,
            homeLatitude,
            homeLongitude,
        });
    }
    /**
     * Get travel radius settings for a cleaner
     */
    static async getTravelRadius(cleanerId) {
        const result = await (0, client_1.query)(`SELECT user_id, travel_radius_km, latitude, longitude
       FROM cleaner_profiles
       WHERE user_id = $1`, [String(cleanerId)]);
        if (result.rows.length === 0 || !result.rows[0].travel_radius_km) {
            return null;
        }
        const row = result.rows[0];
        return {
            cleanerId: Number(row.user_id),
            radiusKm: Number(row.travel_radius_km),
            homeLatitude: Number(row.latitude),
            homeLongitude: Number(row.longitude),
        };
    }
    /**
     * Check if a job location is within cleaner's travel radius
     */
    static async isWithinTravelRadius(cleanerId, jobLatitude, jobLongitude) {
        const settings = await this.getTravelRadius(cleanerId);
        if (!settings)
            return true; // No radius set means any location is OK
        const distance = this.calculateDistanceKm(settings.homeLatitude, settings.homeLongitude, jobLatitude, jobLongitude);
        return distance <= settings.radiusKm;
    }
    /**
     * Calculate distance between two points using Haversine formula
     */
    static calculateDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    static toRad(deg) {
        return deg * (Math.PI / 180);
    }
}
exports.AvailabilityService = AvailabilityService;
