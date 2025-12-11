"use strict";
// src/services/cleanerClientsService.ts
// Cleaner Portal: Previous Clients Management
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCleanerClients = getCleanerClients;
exports.getCleanerClientProfile = getCleanerClientProfile;
exports.getCleanerClientJobHistory = getCleanerClientJobHistory;
exports.getCleanerClientNote = getCleanerClientNote;
exports.upsertCleanerClientNote = upsertCleanerClientNote;
exports.toggleClientFavorite = toggleClientFavorite;
exports.validateCleanerClientRelationship = validateCleanerClientRelationship;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Get Cleaner's Clients List
// ============================================
async function getCleanerClients(cleanerId, filters = {}) {
    const { sortBy = "most_recent", search, favoriteOnly = false, limit = 50, offset = 0, } = filters;
    // Build WHERE clause
    const conditions = ["cleaner_id = $1"];
    const params = [cleanerId];
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
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM cleaner_client_summary WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    // Get paginated results
    params.push(limit, offset);
    const result = await (0, client_1.query)(`
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
    `, params);
    return { clients: result.rows, total };
}
// ============================================
// Get Single Client Profile (Cleaner View)
// ============================================
async function getCleanerClientProfile(cleanerId, clientId) {
    const result = await (0, client_1.query)(`
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
    `, [cleanerId, clientId]);
    return result.rows[0] ?? null;
}
// ============================================
// Get Job History with Client
// ============================================
async function getCleanerClientJobHistory(cleanerId, clientId, limit = 50, offset = 0) {
    // Verify the cleaner has worked with this client
    const relationship = await (0, client_1.query)(`
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `, [cleanerId, clientId]);
    if (!relationship.rows[0]?.exists) {
        return { jobs: [], total: 0 };
    }
    // Get total count
    const countResult = await (0, client_1.query)(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE cleaner_id = $1 AND client_id = $2
    `, [cleanerId, clientId]);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    // Get jobs with photo info
    const result = await (0, client_1.query)(`
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
    `, [cleanerId, clientId, limit, offset]);
    return { jobs: result.rows, total };
}
// ============================================
// Cleaner Notes Management
// ============================================
async function getCleanerClientNote(cleanerId, clientId) {
    const result = await (0, client_1.query)(`SELECT * FROM cleaner_client_notes WHERE cleaner_id = $1 AND client_id = $2`, [cleanerId, clientId]);
    return result.rows[0] ?? null;
}
async function upsertCleanerClientNote(cleanerId, clientId, data) {
    // Verify the cleaner has worked with this client
    const relationship = await (0, client_1.query)(`
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `, [cleanerId, clientId]);
    if (!relationship.rows[0]?.exists) {
        throw Object.assign(new Error("You have not worked with this client"), { statusCode: 403 });
    }
    const result = await (0, client_1.query)(`
      INSERT INTO cleaner_client_notes (cleaner_id, client_id, notes, preferences, is_favorite)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cleaner_id, client_id) DO UPDATE
      SET 
        notes = COALESCE($3, cleaner_client_notes.notes),
        preferences = COALESCE($4, cleaner_client_notes.preferences),
        is_favorite = COALESCE($5, cleaner_client_notes.is_favorite),
        updated_at = NOW()
      RETURNING *
    `, [cleanerId, clientId, data.notes ?? null, data.preferences ?? null, data.is_favorite ?? null]);
    logger_1.logger.info("cleaner_client_note_upserted", {
        cleanerId,
        clientId,
        isFavorite: data.is_favorite,
    });
    return result.rows[0];
}
async function toggleClientFavorite(cleanerId, clientId) {
    // Verify the cleaner has worked with this client
    const relationship = await (0, client_1.query)(`
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `, [cleanerId, clientId]);
    if (!relationship.rows[0]?.exists) {
        throw Object.assign(new Error("You have not worked with this client"), { statusCode: 403 });
    }
    const result = await (0, client_1.query)(`
      INSERT INTO cleaner_client_notes (cleaner_id, client_id, is_favorite)
      VALUES ($1, $2, true)
      ON CONFLICT (cleaner_id, client_id) DO UPDATE
      SET is_favorite = NOT cleaner_client_notes.is_favorite,
          updated_at = NOW()
      RETURNING is_favorite
    `, [cleanerId, clientId]);
    const isFavorite = result.rows[0]?.is_favorite ?? false;
    logger_1.logger.info("cleaner_client_favorite_toggled", {
        cleanerId,
        clientId,
        isFavorite,
    });
    return isFavorite;
}
// ============================================
// Validate Cleaner-Client Relationship
// ============================================
async function validateCleanerClientRelationship(cleanerId, clientId) {
    const result = await (0, client_1.query)(`
      SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE cleaner_id = $1 AND client_id = $2 
        AND status IN ('completed', 'awaiting_approval')
      ) as exists
    `, [cleanerId, clientId]);
    return result.rows[0]?.exists ?? false;
}
