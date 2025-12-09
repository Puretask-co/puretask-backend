"use strict";
// src/services/jobEvents.ts
// Job events logging using job_events table from 001_init.sql
Object.defineProperty(exports, "__esModule", { value: true });
exports.logJobEvent = logJobEvent;
exports.getJobEventsForJob = getJobEventsForJob;
exports.getEventsByType = getEventsByType;
exports.getEventsByActor = getEventsByActor;
const client_1 = require("../db/client");
/**
 * Log a job event to job_events table
 * Matches 001_init.sql schema: (id, job_id, actor_type, actor_id, event_type, payload, created_at)
 */
async function logJobEvent(params) {
    const { jobId = null, actorType = null, actorId = null, eventType, payload = {}, } = params;
    await (0, client_1.query)(`
      INSERT INTO job_events (
        job_id,
        actor_type,
        actor_id,
        event_type,
        payload
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [jobId, actorType, actorId, eventType, JSON.stringify(payload)]);
}
/**
 * Get all events for a specific job
 */
async function getJobEventsForJob(jobId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at DESC
    `, [jobId]);
    return result.rows;
}
/**
 * Get events by event type
 */
async function getEventsByType(eventType, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [eventType, limit]);
    return result.rows;
}
/**
 * Get events by actor
 */
async function getEventsByActor(actorId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE actor_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [actorId, limit]);
    return result.rows;
}
