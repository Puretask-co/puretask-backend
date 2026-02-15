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

import { query } from "../db/client";
import { RollingWindowConfig, ClientRiskEvent, CleanerEvent } from "./types";

// ============================================
// Types
// ============================================

export interface RollingWindowResult<T> {
  events: T[];
  windowMode: "days" | "jobs" | "hybrid";
  since?: Date;
  jobIds?: number[];
}

// ============================================
// Main Service
// ============================================

export class RollingWindowService {
  /**
   * Get cleaner events within a rolling window
   */
  static async getCleanerEventWindow(
    cleanerId: number,
    config: RollingWindowConfig
  ): Promise<RollingWindowResult<CleanerEvent>> {
    if (config.mode === "days") {
      const since = new Date();
      since.setDate(since.getDate() - (config.days ?? 60));

      const events = await this.getCleanerEventsSince(cleanerId, since);
      return { events, windowMode: "days", since };
    }

    if (config.mode === "jobs") {
      const jobs = await this.getRecentJobsForCleaner(cleanerId, config.maxJobs ?? 30);
      const jobIds = jobs.map((j) => j.id);
      const events = await this.getCleanerEventsForJobs(cleanerId, jobIds);
      return { events, windowMode: "jobs", jobIds };
    }

    // Hybrid mode: use both days and jobs
    const since = new Date();
    since.setDate(since.getDate() - (config.days ?? 60));
    const jobs = await this.getRecentJobsForCleaner(cleanerId, config.maxJobs ?? 30, since);
    const jobIds = jobs.map((j) => j.id);
    const events = await this.getCleanerEventsForJobs(cleanerId, jobIds);
    return { events, windowMode: "hybrid", jobIds, since };
  }

  /**
   * Get client risk events within a rolling window
   */
  static async getClientRiskEventWindow(
    clientId: number,
    config: RollingWindowConfig
  ): Promise<RollingWindowResult<ClientRiskEvent>> {
    if (config.mode === "days") {
      const since = new Date();
      since.setDate(since.getDate() - (config.days ?? 30));

      const events = await this.getClientRiskEventsSince(clientId, since);
      return { events, windowMode: "days", since };
    }

    if (config.mode === "jobs") {
      const jobs = await this.getRecentJobsForClient(clientId, config.maxJobs ?? 20);
      const jobIds = jobs.map((j) => j.id);
      const events = await this.getClientRiskEventsForJobs(clientId, jobIds);
      return { events, windowMode: "jobs", jobIds };
    }

    // Hybrid mode
    const since = new Date();
    since.setDate(since.getDate() - (config.days ?? 30));
    const jobs = await this.getRecentJobsForClient(clientId, config.maxJobs ?? 20, since);
    const jobIds = jobs.map((j) => j.id);
    const events = await this.getClientRiskEventsForJobs(clientId, jobIds);
    return { events, windowMode: "hybrid", jobIds, since };
  }

  // ========================================
  // Cleaner Event Queries
  // ========================================

  private static async getCleanerEventsSince(
    cleanerId: number,
    since: Date
  ): Promise<CleanerEvent[]> {
    const result = await query<any>(
      `SELECT * FROM cleaner_events
       WHERE cleaner_id = $1
       AND created_at >= $2
       ORDER BY created_at DESC`,
      [String(cleanerId), since.toISOString()]
    );

    return result.rows.map(this.mapCleanerEvent);
  }

  private static async getCleanerEventsForJobs(
    cleanerId: number,
    jobIds: number[]
  ): Promise<CleanerEvent[]> {
    if (jobIds.length === 0) return [];

    const result = await query<any>(
      `SELECT * FROM cleaner_events
       WHERE cleaner_id = $1
       AND job_id = ANY($2::int[])
       ORDER BY created_at DESC`,
      [String(cleanerId), jobIds]
    );

    return result.rows.map(this.mapCleanerEvent);
  }

  private static mapCleanerEvent(row: any): CleanerEvent {
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

  private static async getClientRiskEventsSince(
    clientId: number,
    since: Date
  ): Promise<ClientRiskEvent[]> {
    const result = await query<any>(
      `SELECT * FROM client_risk_events
       WHERE client_id = $1
       AND created_at >= $2
       ORDER BY created_at DESC`,
      [String(clientId), since.toISOString()]
    );

    return result.rows.map(this.mapClientRiskEvent);
  }

  private static async getClientRiskEventsForJobs(
    clientId: number,
    jobIds: number[]
  ): Promise<ClientRiskEvent[]> {
    if (jobIds.length === 0) return [];

    const result = await query<any>(
      `SELECT * FROM client_risk_events
       WHERE client_id = $1
       AND job_id = ANY($2::int[])
       ORDER BY created_at DESC`,
      [String(clientId), jobIds]
    );

    return result.rows.map(this.mapClientRiskEvent);
  }

  private static mapClientRiskEvent(row: any): ClientRiskEvent {
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

  private static async getRecentJobsForCleaner(
    cleanerId: number,
    limit: number,
    since?: Date
  ): Promise<{ id: number }[]> {
    let queryStr = `
      SELECT id FROM jobs
      WHERE cleaner_id = $1
      AND status IN ('completed', 'cancelled_by_client', 'cancelled_by_cleaner', 'no_show_cleaner', 'no_show_client', 'disputed')
    `;
    const params: any[] = [String(cleanerId)];

    if (since) {
      params.push(since.toISOString());
      queryStr += ` AND scheduled_start_at >= $${params.length}`;
    }

    queryStr += ` ORDER BY scheduled_start_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query<{ id: string }>(queryStr, params);
    return result.rows.map((row) => ({ id: Number(row.id) }));
  }

  private static async getRecentJobsForClient(
    clientId: number,
    limit: number,
    since?: Date
  ): Promise<{ id: number }[]> {
    let queryStr = `
      SELECT id FROM jobs
      WHERE client_id = $1
    `;
    const params: any[] = [String(clientId)];

    if (since) {
      params.push(since.toISOString());
      queryStr += ` AND scheduled_start_at >= $${params.length}`;
    }

    queryStr += ` ORDER BY scheduled_start_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query<{ id: string }>(queryStr, params);
    return result.rows.map((row) => ({ id: Number(row.id) }));
  }
}
