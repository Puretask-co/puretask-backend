"use strict";
// src/services/propertiesService.ts
// Properties service for multi-location clients + cleaning score system
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProperty = createProperty;
exports.getPropertyById = getPropertyById;
exports.getClientProperties = getClientProperties;
exports.updateProperty = updateProperty;
exports.deleteProperty = deleteProperty;
exports.calculateCleaningScore = calculateCleaningScore;
exports.updateCleaningScore = updateCleaningScore;
exports.recalculateAllScores = recalculateAllScores;
exports.getPropertySuggestions = getPropertySuggestions;
exports.getRebookData = getRebookData;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Cleaning Score Configuration
// ============================================
const SCORE_CONFIG = {
    // Days after which score starts declining
    BASIC_DECAY_START: 7,
    DEEP_DECAY_START: 30,
    MOVEOUT_DECAY_START: 90,
    // Weight for each cleaning type (how much it contributes to score)
    BASIC_WEIGHT: 0.3,
    DEEP_WEIGHT: 0.5,
    MOVEOUT_WEIGHT: 0.2,
    // Decay rate per day after grace period
    DECAY_RATE: 1.5,
    // Suggestion thresholds
    BASIC_SUGGEST_DAYS: 14,
    DEEP_SUGGEST_DAYS: 60,
};
// ============================================
// Property CRUD
// ============================================
/**
 * Create a new property for a client
 */
async function createProperty(clientId, input) {
    const result = await (0, client_1.query)(`
      INSERT INTO properties (
        client_id, label, address_line1, address_line2, city, state_region,
        postal_code, country_code, latitude, longitude, notes,
        bedrooms, bathrooms, square_feet, has_pets, has_kids
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
        clientId,
        input.label,
        input.address_line1,
        input.address_line2 ?? null,
        input.city,
        input.state_region ?? null,
        input.postal_code ?? null,
        input.country_code ?? "US",
        input.latitude ?? null,
        input.longitude ?? null,
        input.notes ?? null,
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.square_feet ?? null,
        input.has_pets ?? false,
        input.has_kids ?? false,
    ]);
    logger_1.logger.info("property_created", { propertyId: result.rows[0].id, clientId });
    return result.rows[0];
}
/**
 * Get property by ID
 */
async function getPropertyById(propertyId, clientId) {
    let queryText = `SELECT * FROM properties WHERE id = $1`;
    const params = [propertyId];
    if (clientId) {
        queryText += ` AND client_id = $2`;
        params.push(clientId);
    }
    const result = await (0, client_1.query)(queryText, params);
    return result.rows[0] ?? null;
}
/**
 * Get all properties for a client
 */
async function getClientProperties(clientId) {
    const result = await (0, client_1.query)(`SELECT * FROM properties WHERE client_id = $1 ORDER BY label ASC`, [clientId]);
    return result.rows;
}
/**
 * Update a property
 */
async function updateProperty(propertyId, clientId, updates) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    const allowedFields = [
        "label",
        "address_line1",
        "address_line2",
        "city",
        "state_region",
        "postal_code",
        "latitude",
        "longitude",
        "notes",
        "bedrooms",
        "bathrooms",
        "square_feet",
        "has_pets",
        "has_kids",
    ];
    for (const field of allowedFields) {
        if (field in updates) {
            setClauses.push(`${field} = $${paramIndex++}`);
            values.push(updates[field]);
        }
    }
    if (setClauses.length === 0) {
        const existing = await getPropertyById(propertyId, clientId);
        if (!existing) {
            throw Object.assign(new Error("Property not found"), { statusCode: 404 });
        }
        return existing;
    }
    setClauses.push(`updated_at = NOW()`);
    values.push(propertyId, clientId);
    const result = await (0, client_1.query)(`
      UPDATE properties
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex++} AND client_id = $${paramIndex++}
      RETURNING *
    `, values);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Property not found"), { statusCode: 404 });
    }
    logger_1.logger.info("property_updated", { propertyId, clientId });
    return result.rows[0];
}
/**
 * Delete a property
 */
async function deleteProperty(propertyId, clientId) {
    // Check for active subscriptions or jobs
    const activeResult = await (0, client_1.query)(`
      SELECT COUNT(*)::text as count
      FROM cleaning_subscriptions
      WHERE property_id = $1 AND status = 'active'
    `, [propertyId]);
    if (Number(activeResult.rows[0]?.count || 0) > 0) {
        throw Object.assign(new Error("Cannot delete property with active subscriptions"), { statusCode: 400 });
    }
    await (0, client_1.query)(`DELETE FROM properties WHERE id = $1 AND client_id = $2`, [propertyId, clientId]);
    logger_1.logger.info("property_deleted", { propertyId, clientId });
}
// ============================================
// Cleaning Score
// ============================================
/**
 * Calculate cleaning score for a property
 */
function calculateCleaningScore(property) {
    const now = new Date();
    let score = 100;
    // Calculate days since each cleaning type
    const daysSinceBasic = property.last_basic_at
        ? Math.floor((now.getTime() - new Date(property.last_basic_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const daysSinceDeep = property.last_deep_at
        ? Math.floor((now.getTime() - new Date(property.last_deep_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const daysSinceMoveout = property.last_moveout_at
        ? Math.floor((now.getTime() - new Date(property.last_moveout_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    // Apply decay for each cleaning type
    if (daysSinceBasic !== null && daysSinceBasic > SCORE_CONFIG.BASIC_DECAY_START) {
        const decayDays = daysSinceBasic - SCORE_CONFIG.BASIC_DECAY_START;
        score -= decayDays * SCORE_CONFIG.DECAY_RATE * SCORE_CONFIG.BASIC_WEIGHT;
    }
    if (daysSinceDeep !== null && daysSinceDeep > SCORE_CONFIG.DEEP_DECAY_START) {
        const decayDays = daysSinceDeep - SCORE_CONFIG.DEEP_DECAY_START;
        score -= decayDays * SCORE_CONFIG.DECAY_RATE * SCORE_CONFIG.DEEP_WEIGHT;
    }
    if (daysSinceMoveout !== null && daysSinceMoveout > SCORE_CONFIG.MOVEOUT_DECAY_START) {
        const decayDays = daysSinceMoveout - SCORE_CONFIG.MOVEOUT_DECAY_START;
        score -= decayDays * SCORE_CONFIG.DECAY_RATE * SCORE_CONFIG.MOVEOUT_WEIGHT;
    }
    // If no cleaning history at all, start at 50
    if (daysSinceBasic === null && daysSinceDeep === null && daysSinceMoveout === null) {
        score = 50;
    }
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
/**
 * Update cleaning score after a job is completed
 */
async function updateCleaningScore(propertyId, cleaningType) {
    // Update the last cleaning timestamp
    const fieldMap = {
        basic: "last_basic_at",
        deep: "last_deep_at",
        moveout: "last_moveout_at",
    };
    const result = await (0, client_1.query)(`
      UPDATE properties
      SET ${fieldMap[cleaningType]} = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [propertyId]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Property not found"), { statusCode: 404 });
    }
    const property = result.rows[0];
    // Calculate and update score
    const newScore = calculateCleaningScore(property);
    await (0, client_1.query)(`UPDATE properties SET cleaning_score = $2, updated_at = NOW() WHERE id = $1`, [propertyId, newScore]);
    logger_1.logger.info("cleaning_score_updated", {
        propertyId,
        cleaningType,
        newScore,
    });
    return { ...property, cleaning_score: newScore };
}
/**
 * Recalculate scores for all properties (batch job)
 */
async function recalculateAllScores() {
    const properties = await (0, client_1.query)(`SELECT * FROM properties`);
    let updated = 0;
    for (const property of properties.rows) {
        const newScore = calculateCleaningScore(property);
        if (Math.abs(newScore - property.cleaning_score) > 0.1) {
            await (0, client_1.query)(`UPDATE properties SET cleaning_score = $2, updated_at = NOW() WHERE id = $1`, [property.id, newScore]);
            updated++;
        }
    }
    logger_1.logger.info("all_scores_recalculated", { updated, total: properties.rows.length });
    return updated;
}
// ============================================
// Suggestions
// ============================================
/**
 * Get cleaning suggestions for a property
 */
async function getPropertySuggestions(propertyId) {
    const property = await getPropertyById(propertyId);
    if (!property) {
        throw Object.assign(new Error("Property not found"), { statusCode: 404 });
    }
    const suggestions = [];
    const now = new Date();
    // Calculate days since each cleaning type
    const daysSinceBasic = property.last_basic_at
        ? Math.floor((now.getTime() - new Date(property.last_basic_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const daysSinceDeep = property.last_deep_at
        ? Math.floor((now.getTime() - new Date(property.last_deep_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    // Basic cleaning suggestions
    if (daysSinceBasic === null) {
        suggestions.push({
            type: "basic",
            urgency: "medium",
            message: "You haven't had a basic cleaning yet. Start with a basic cleaning to maintain your home.",
            days_since_last: null,
        });
    }
    else if (daysSinceBasic >= SCORE_CONFIG.BASIC_SUGGEST_DAYS * 2) {
        suggestions.push({
            type: "basic",
            urgency: "high",
            message: `It's been ${daysSinceBasic} days since your last basic cleaning. Your cleaning score is declining!`,
            days_since_last: daysSinceBasic,
        });
    }
    else if (daysSinceBasic >= SCORE_CONFIG.BASIC_SUGGEST_DAYS) {
        suggestions.push({
            type: "basic",
            urgency: "medium",
            message: `Consider scheduling a basic cleaning. It's been ${daysSinceBasic} days since your last one.`,
            days_since_last: daysSinceBasic,
        });
    }
    // Deep cleaning suggestions
    if (daysSinceDeep === null) {
        suggestions.push({
            type: "deep",
            urgency: "low",
            message: "Schedule a deep cleaning to thoroughly clean hard-to-reach areas.",
            days_since_last: null,
        });
    }
    else if (daysSinceDeep >= SCORE_CONFIG.DEEP_SUGGEST_DAYS * 1.5) {
        suggestions.push({
            type: "deep",
            urgency: "high",
            message: `It's been ${daysSinceDeep} days since your last deep cleaning. Time for a thorough clean!`,
            days_since_last: daysSinceDeep,
        });
    }
    else if (daysSinceDeep >= SCORE_CONFIG.DEEP_SUGGEST_DAYS) {
        suggestions.push({
            type: "deep",
            urgency: "medium",
            message: `Consider a deep cleaning. It's been ${daysSinceDeep} days since your last one.`,
            days_since_last: daysSinceDeep,
        });
    }
    // Pet/kid specific suggestions
    if (property.has_pets && daysSinceBasic && daysSinceBasic >= 7) {
        suggestions.push({
            type: "basic",
            urgency: "medium",
            message: "Homes with pets benefit from more frequent cleanings to manage pet hair and dander.",
            days_since_last: daysSinceBasic,
        });
    }
    return suggestions;
}
// ============================================
// One-Tap Rebook
// ============================================
/**
 * Get rebook data from a completed job
 */
async function getRebookData(jobId, clientId) {
    const jobResult = await (0, client_1.query)(`SELECT property_id, cleaner_id, credit_amount, client_id, status FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    if (job.client_id !== clientId) {
        throw Object.assign(new Error("Not your job"), { statusCode: 403 });
    }
    if (!["completed", "awaiting_approval"].includes(job.status)) {
        throw Object.assign(new Error("Job must be completed to rebook"), { statusCode: 400 });
    }
    // Get property
    const property = await getPropertyById(job.property_id);
    if (!property) {
        throw Object.assign(new Error("Property not found"), { statusCode: 404 });
    }
    // Generate suggested slots (next 3 available times)
    const suggestedSlots = [];
    const now = new Date();
    for (let i = 1; i <= 7; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        // Skip weekends for simplicity
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            suggestedSlots.push({
                date: date.toISOString().split("T")[0],
                time: "09:00",
            });
            if (suggestedSlots.length >= 3)
                break;
        }
    }
    return {
        property,
        cleanerId: job.cleaner_id,
        cleaningType: "basic", // Could be enhanced to track cleaning_type on jobs
        creditAmount: job.credit_amount,
        suggestedSlots,
    };
}
