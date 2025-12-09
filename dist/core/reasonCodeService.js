"use strict";
// src/core/reasonCodeService.ts
// Reason Code Logging System (2.1)
//
// Every reschedule or cancellation chooses:
// - Why the requester is asking
// - Why the other party accepts/declines
//
// Reason codes feed:
// - Analytics
// - Risk score
// - Reliability score
// - Customer support
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasonCodeService = exports.REASON_CODES = void 0;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Predefined Reason Codes
// ============================================
exports.REASON_CODES = {
    // Client reschedule reasons
    client_reschedule: [
        { code: 'schedule_conflict', label: 'Schedule Conflict', description: 'Client has a scheduling conflict' },
        { code: 'work_change', label: 'Work Change', description: 'Client\'s work schedule changed' },
        { code: 'family_emergency', label: 'Family Emergency', description: 'Client has a family emergency' },
        { code: 'running_late', label: 'Running Late', description: 'Client is running late' },
        { code: 'need_different_cleaning_time', label: 'Different Time Needed', description: 'Client needs a different cleaning time' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
    // Cleaner reschedule reasons
    cleaner_reschedule: [
        { code: 'schedule_conflict', label: 'Schedule Conflict', description: 'Cleaner has a scheduling conflict' },
        { code: 'previous_job_overrun', label: 'Previous Job Overrun', description: 'Previous job took longer than expected' },
        { code: 'transport_issue', label: 'Transportation Issue', description: 'Cleaner has transportation issues' },
        { code: 'family_emergency', label: 'Family Emergency', description: 'Cleaner has a family emergency' },
        { code: 'health_issue', label: 'Health Issue', description: 'Cleaner is not feeling well' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
    // Cancellation reasons
    client_cancel: [
        { code: 'no_longer_needed', label: 'No Longer Needed', description: 'Cleaning is no longer needed' },
        { code: 'found_alternative', label: 'Found Alternative', description: 'Client found an alternative' },
        { code: 'financial_reason', label: 'Financial Reason', description: 'Client cannot afford at this time' },
        { code: 'moving', label: 'Moving', description: 'Client is moving' },
        { code: 'dissatisfied', label: 'Dissatisfied', description: 'Client is dissatisfied with service' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
    cleaner_cancel: [
        { code: 'emergency', label: 'Emergency', description: 'Personal or family emergency' },
        { code: 'illness', label: 'Illness', description: 'Cleaner is ill' },
        { code: 'transportation', label: 'Transportation Issue', description: 'Cannot get to location' },
        { code: 'safety_concern', label: 'Safety Concern', description: 'Safety concerns about job' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
    // Decline reasons (for reschedule)
    cleaner_decline: [
        { code: 'not_available', label: 'Not Available', description: 'Cleaner is not available at new time' },
        { code: 'already_booked', label: 'Already Booked', description: 'Cleaner has another job at that time' },
        { code: 'outside_availability', label: 'Outside Availability', description: 'New time is outside cleaner\'s working hours' },
        { code: 'prefer_original', label: 'Prefer Original Time', description: 'Cleaner prefers the original time' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
    client_decline: [
        { code: 'new_time_not_suitable', label: 'Time Not Suitable', description: 'New time doesn\'t work for client' },
        { code: 'found_alternative', label: 'Found Alternative', description: 'Client found another solution' },
        { code: 'cancelling_instead', label: 'Will Cancel Instead', description: 'Client prefers to cancel' },
        { code: 'other', label: 'Other', description: 'Other reason' },
    ],
};
// ============================================
// Main Service
// ============================================
class ReasonCodeService {
    /**
     * Get all active reason codes for an actor type and category
     */
    static async getActiveReasonCodes(actorType, category) {
        let query_str = `
      SELECT id, code, actor_type, category, label, description, is_active
      FROM reason_codes
      WHERE is_active = true
    `;
        const params = [];
        let paramIndex = 1;
        if (actorType) {
            query_str += ` AND (actor_type = $${paramIndex} OR actor_type = 'both')`;
            params.push(actorType);
            paramIndex++;
        }
        if (category) {
            query_str += ` AND category = $${paramIndex}`;
            params.push(category);
        }
        query_str += ' ORDER BY code';
        const result = await (0, client_1.query)(query_str, params);
        return result.rows.map(row => ({
            id: Number(row.id),
            code: row.code,
            actorType: row.actor_type,
            category: row.category,
            label: row.label,
            description: row.description,
            isActive: row.is_active,
        }));
    }
    /**
     * Validate a reason code for a specific context
     */
    static async validateReasonCode(code, actorType, category) {
        if (!code) {
            return { valid: true }; // Optional in some flows
        }
        const result = await (0, client_1.query)(`SELECT * FROM reason_codes WHERE code = $1`, [code]);
        if (result.rows.length === 0) {
            return { valid: false, error: `Invalid reason code: ${code}` };
        }
        const found = result.rows[0];
        if (!found.is_active) {
            return { valid: false, error: `Reason code ${code} is no longer active` };
        }
        if (found.actor_type !== actorType && found.actor_type !== 'both') {
            return { valid: false, error: `Reason code ${code} cannot be used by ${actorType}` };
        }
        if (found.category !== category) {
            return { valid: false, error: `Reason code ${code} is not valid for ${category}` };
        }
        return { valid: true };
    }
    /**
     * Get a specific reason code by code string
     */
    static async getByCode(code) {
        const result = await (0, client_1.query)(`SELECT * FROM reason_codes WHERE code = $1`, [code]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: Number(row.id),
            code: row.code,
            actorType: row.actor_type,
            category: row.category,
            label: row.label,
            description: row.description,
            isActive: row.is_active,
        };
    }
    /**
     * Get predefined reason codes (without database lookup)
     */
    static getPredefinedCodes(context) {
        return exports.REASON_CODES[context] || [];
    }
    /**
     * Seed reason codes to database (run once during setup)
     */
    static async seedReasonCodes() {
        const allCodes = [
            ...exports.REASON_CODES.client_reschedule.map(c => ({ ...c, actorType: 'client', category: 'reschedule' })),
            ...exports.REASON_CODES.cleaner_reschedule.map(c => ({ ...c, actorType: 'cleaner', category: 'reschedule' })),
            ...exports.REASON_CODES.client_cancel.map(c => ({ ...c, actorType: 'client', category: 'cancel' })),
            ...exports.REASON_CODES.cleaner_cancel.map(c => ({ ...c, actorType: 'cleaner', category: 'cancel' })),
            ...exports.REASON_CODES.cleaner_decline.map(c => ({ ...c, actorType: 'cleaner', category: 'reschedule' })),
            ...exports.REASON_CODES.client_decline.map(c => ({ ...c, actorType: 'client', category: 'reschedule' })),
        ];
        for (const code of allCodes) {
            await (0, client_1.query)(`INSERT INTO reason_codes (code, actor_type, category, label, description, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (code) DO UPDATE SET
           actor_type = $2,
           category = $3,
           label = $4,
           description = $5`, [code.code, code.actorType, code.category, code.label, code.description]);
        }
        logger_1.logger.info("reason_codes_seeded", { count: allCodes.length });
    }
}
exports.ReasonCodeService = ReasonCodeService;
