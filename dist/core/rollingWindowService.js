"use strict";
// src/core/rollingWindowService.ts
// Rolling Window System (2.6)
//
// Both risk and reliability use a rolling system:
// - Last 30 jobs
// - Or last 30 days
// - Or hybrid
//
// Benefits:
// - Prevents huge penalties
// - Keeps scores fresh
// - Encourages improving behavior
Object.defineProperty(exports, "__esModule", { value: true });
exports.RollingWindowService = void 0;
const client_1 = require("../db/client");
// ============================================
// Main Service
// ============================================
class RollingWindowService {
    /**
     * Get cleaner events within a rolling window
     */
    static async getCleanerEventWindow(cleanerId, config) {
        if (config.mode === 'days') {
            const since = new Date();
            since.setDate(since.getDate() - (config.days ?? 60));
            const events = await this.getCleanerEventsSince(cleanerId, since);
            return { events, windowMode: 'days', since };
        }
        if (config.mode === 'jobs') {
            const jobs = await this.getRecentJobsForCleaner(cleanerId, config.maxJobs ?? 30);
            const jobIds = jobs.map(j => j.id);
            const events = await this.getCleanerEventsForJobs(cleanerId, jobIds);
            return { events, windowMode: 'jobs', jobIds };
        }
        // Hybrid mode: use both days and jobs
        const since = new Date();
        since.setDate(since.getDate() - (config.days ?? 60));
        const jobs = await this.getRecentJobsForCleaner(cleanerId, config.maxJobs ?? 30, since);
        const jobIds = jobs.map(j => j.id);
        const events = await this.getCleanerEventsForJobs(cleanerId, jobIds);
        return { events, windowMode: 'hybrid', jobIds, since };
    }
    /**
     * Get client risk events within a rolling window
     */
    static async getClientRiskEventWindow(clientId, config) {
        if (config.mode === 'days') {
            const since = new Date();
            since.setDate(since.getDate() - (config.days ?? 30));
            const events = await this.getClientRiskEventsSince(clientId, since);
            return { events, windowMode: 'days', since };
        }
        if (config.mode === 'jobs') {
            const jobs = await this.getRecentJobsForClient(clientId, config.maxJobs ?? 20);
            const jobIds = jobs.map(j => j.id);
            const events = await this.getClientRiskEventsForJobs(clientId, jobIds);
            return { events, windowMode: 'jobs', jobIds };
        }
        // Hybrid mode
        const since = new Date();
        since.setDate(since.getDate() - (config.days ?? 30));
        const jobs = await this.getRecentJobsForClient(clientId, config.maxJobs ?? 20, since);
        const jobIds = jobs.map(j => j.id);
        const events = await this.getClientRiskEventsForJobs(clientId, jobIds);
        return { events, windowMode: 'hybrid', jobIds, since };
    }
    // ========================================
    // Cleaner Event Queries
    // ========================================
    static async getCleanerEventsSince(cleanerId, since) {
        const result = await (0, client_1.query)(`SELECT * FROM cleaner_events
       WHERE cleaner_id = $1
       AND created_at >= $2
       ORDER BY created_at DESC`, [String(cleanerId), since.toISOString()]);
        return result.rows.map(this.mapCleanerEvent);
    }
    static async getCleanerEventsForJobs(cleanerId, jobIds) {
        if (jobIds.length === 0)
            return [];
        const result = await (0, client_1.query)(`SELECT * FROM cleaner_events
       WHERE cleaner_id = $1
       AND job_id = ANY($2::int[])
       ORDER BY created_at DESC`, [String(cleanerId), jobIds]);
        return result.rows.map(this.mapCleanerEvent);
    }
    static mapCleanerEvent(row) {
        return {
            id: Number(row.id),
            cleanerId: Number(row.cleaner_id),
            jobId: row.job_id ? Number(row.job_id) : null,
            eventType: row.event_type,
            weight: Number(row.weight),
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
        };
    }
    // ========================================
    // Client Risk Event Queries
    // ========================================
    static async getClientRiskEventsSince(clientId, since) {
        const result = await (0, client_1.query)(`SELECT * FROM client_risk_events
       WHERE client_id = $1
       AND created_at >= $2
       ORDER BY created_at DESC`, [String(clientId), since.toISOString()]);
        return result.rows.map(this.mapClientRiskEvent);
    }
    static async getClientRiskEventsForJobs(clientId, jobIds) {
        if (jobIds.length === 0)
            return [];
        const result = await (0, client_1.query)(`SELECT * FROM client_risk_events
       WHERE client_id = $1
       AND job_id = ANY($2::int[])
       ORDER BY created_at DESC`, [String(clientId), jobIds]);
        return result.rows.map(this.mapClientRiskEvent);
    }
    static mapClientRiskEvent(row) {
        return {
            id: Number(row.id),
            clientId: Number(row.client_id),
            jobId: row.job_id ? Number(row.job_id) : null,
            eventType: row.event_type,
            weight: Number(row.weight),
            metadata: row.metadata,
            createdAt: new Date(row.created_at),
        };
    }
    // ========================================
    // Job Queries
    // ========================================
    static async getRecentJobsForCleaner(cleanerId, limit, since) {
        let queryStr = `
      SELECT id FROM jobs
      WHERE cleaner_id = $1
      AND status IN ('completed', 'cancelled_by_client', 'cancelled_by_cleaner', 'no_show_cleaner', 'no_show_client', 'disputed')
    `;
        const params = [String(cleanerId)];
        if (since) {
            params.push(since.toISOString());
            queryStr += ` AND scheduled_start_at >= $${params.length}`;
        }
        queryStr += ` ORDER BY scheduled_start_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await (0, client_1.query)(queryStr, params);
        return result.rows.map(row => ({ id: Number(row.id) }));
    }
    static async getRecentJobsForClient(clientId, limit, since) {
        let queryStr = `
      SELECT id FROM jobs
      WHERE client_id = $1
    `;
        const params = [String(clientId)];
        if (since) {
            params.push(since.toISOString());
            queryStr += ` AND scheduled_start_at >= $${params.length}`;
        }
        queryStr += ` ORDER BY scheduled_start_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await (0, client_1.query)(queryStr, params);
        return result.rows.map(row => ({ id: Number(row.id) }));
    }
}
exports.RollingWindowService = RollingWindowService;
