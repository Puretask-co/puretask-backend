// src/services/opsDashboardService.ts
// Unified ops dashboard: disputes, webhooks, risk summary

import { query } from "../db/client";

export interface OpsDashboard {
  disputes: {
    open: number;
    investigating: number;
    totalOpen: number;
  };
  webhooks: {
    pending: number;
    failed: number;
  };
  risk: {
    activeFlags: number;
    openDisputes: number;
  };
}

/**
 * Get unified ops dashboard snapshot for admin
 */
export async function getOpsDashboard(): Promise<OpsDashboard> {
  const dashboard: OpsDashboard = {
    disputes: { open: 0, investigating: 0, totalOpen: 0 },
    webhooks: { pending: 0, failed: 0 },
    risk: { activeFlags: 0, openDisputes: 0 },
  };

  try {
    // Disputes (disputes table uses dispute_status enum: open, resolved_refund, resolved_no_refund)
    const openCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM disputes WHERE status = 'open'`
    );
    dashboard.disputes.open = parseInt(openCount.rows[0]?.count || "0", 10);
    dashboard.disputes.totalOpen = dashboard.disputes.open;

    // Webhooks
    const webhooksResult = await query<{ processing_status: string; count: string }>(
      `SELECT processing_status, COUNT(*)::text as count FROM webhook_events
       WHERE processing_status IN ('pending', 'failed')
       GROUP BY processing_status`
    );
    for (const row of webhooksResult.rows) {
      const c = parseInt(row.count || "0", 10);
      if (row.processing_status === "pending") dashboard.webhooks.pending = c;
      else if (row.processing_status === "failed") dashboard.webhooks.failed = c;
    }

    // Risk (use disputes as proxy if risk_flags doesn't exist)
    dashboard.risk.openDisputes = dashboard.disputes.totalOpen;
    try {
      const flagsResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM risk_flags WHERE active = true`
      );
      dashboard.risk.activeFlags = parseInt(flagsResult.rows[0]?.count || "0", 10);
    } catch {
      // risk_flags table may not exist
    }
  } catch (err) {
    // Return partial dashboard on error
  }

  return dashboard;
}
