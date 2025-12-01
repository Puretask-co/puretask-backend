// src/services/supportService.ts
// Support ticket system for customer issues

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { createAuditLog } from "./creditEconomyService";

// ============================================
// Types
// ============================================

export type TicketCategory = "billing" | "job_issue" | "account" | "payout" | "dispute" | "other";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  user_id: string;
  job_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  resolution: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: "user" | "admin" | "system";
  message: string;
  attachments: string[];
  created_at: string;
}

export interface TicketWithMessages extends SupportTicket {
  messages: SupportMessage[];
  user_email?: string;
  assigned_to_email?: string;
}

// ============================================
// Ticket CRUD
// ============================================

/**
 * Create a support ticket
 */
export async function createTicket(params: {
  userId: string;
  jobId?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority?: TicketPriority;
  metadata?: Record<string, unknown>;
}): Promise<SupportTicket> {
  const {
    userId,
    jobId,
    category,
    subject,
    description,
    priority = "normal",
    metadata = {},
  } = params;

  // Auto-escalate priority for certain categories
  let finalPriority = priority;
  if (category === "dispute" || category === "payout") {
    finalPriority = priority === "low" ? "normal" : priority;
  }

  const result = await query<SupportTicket>(
    `
      INSERT INTO support_tickets (user_id, job_id, category, subject, description, priority, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [userId, jobId ?? null, category, subject, description, finalPriority, JSON.stringify(metadata)]
  );

  const ticket = result.rows[0];

  // Add initial message from user
  await addMessage({
    ticketId: ticket.id,
    senderId: userId,
    senderType: "user",
    message: description,
  });

  logger.info("support_ticket_created", {
    ticketId: ticket.id,
    userId,
    category,
    priority: finalPriority,
  });

  return ticket;
}

/**
 * Get ticket by ID with messages
 */
export async function getTicketById(ticketId: string): Promise<TicketWithMessages | null> {
  const ticketResult = await query<SupportTicket & { user_email: string; assigned_to_email: string | null }>(
    `
      SELECT 
        t.*,
        u.email as user_email,
        a.email as assigned_to_email
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.assigned_to
      WHERE t.id = $1
    `,
    [ticketId]
  );

  if (ticketResult.rows.length === 0) return null;

  const ticket = ticketResult.rows[0];

  // Get messages
  const messagesResult = await query<SupportMessage>(
    `SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  );

  return {
    ...ticket,
    messages: messagesResult.rows,
  };
}

/**
 * Get tickets for a user
 */
export async function getUserTickets(
  userId: string,
  status?: TicketStatus
): Promise<SupportTicket[]> {
  let queryText = `SELECT * FROM support_tickets WHERE user_id = $1`;
  const params: unknown[] = [userId];

  if (status) {
    queryText += ` AND status = $2`;
    params.push(status);
  }

  queryText += ` ORDER BY created_at DESC`;

  const result = await query<SupportTicket>(queryText, params);
  return result.rows;
}

/**
 * List all tickets (admin)
 */
export async function listTickets(params: {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tickets: SupportTicket[]; total: number }> {
  const { status, category, priority, assignedTo, limit = 50, offset = 0 } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  if (category) {
    conditions.push(`category = $${paramIndex++}`);
    values.push(category);
  }
  if (priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(priority);
  }
  if (assignedTo) {
    conditions.push(`assigned_to = $${paramIndex++}`);
    values.push(assignedTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM support_tickets ${whereClause}`,
    values
  );

  // Get tickets
  const ticketsResult = await query<SupportTicket>(
    `SELECT * FROM support_tickets ${whereClause} ORDER BY 
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    tickets: ticketsResult.rows,
    total: Number(countResult.rows[0]?.count || 0),
  };
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  adminId?: string,
  resolution?: string
): Promise<SupportTicket> {
  const updates: string[] = [`status = $2`, `updated_at = NOW()`];
  const values: unknown[] = [ticketId, status];
  let paramIndex = 3;

  if (resolution) {
    updates.push(`resolution = $${paramIndex++}`);
    values.push(resolution);
  }

  if (status === "resolved" || status === "closed") {
    updates.push(`resolved_at = NOW()`);
  }

  const result = await query<SupportTicket>(
    `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );

  const ticket = result.rows[0];

  // Add system message
  await addMessage({
    ticketId,
    senderType: "system",
    message: `Ticket status changed to: ${status}${resolution ? `. Resolution: ${resolution}` : ""}`,
  });

  if (adminId) {
    await createAuditLog({
      actorId: adminId,
      actorType: "admin",
      action: "ticket_status_updated",
      resourceType: "support_ticket",
      resourceId: ticketId,
      newValue: { status, resolution },
    });
  }

  logger.info("ticket_status_updated", { ticketId, status, resolution });

  return ticket;
}

/**
 * Assign ticket to admin
 */
export async function assignTicket(
  ticketId: string,
  assignedTo: string,
  assignedBy: string
): Promise<SupportTicket> {
  const result = await query<SupportTicket>(
    `
      UPDATE support_tickets 
      SET assigned_to = $2, 
          status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, assignedTo]
  );

  const ticket = result.rows[0];

  await addMessage({
    ticketId,
    senderType: "system",
    message: `Ticket assigned to support team member.`,
  });

  await createAuditLog({
    actorId: assignedBy,
    actorType: "admin",
    action: "ticket_assigned",
    resourceType: "support_ticket",
    resourceId: ticketId,
    newValue: { assigned_to: assignedTo },
  });

  logger.info("ticket_assigned", { ticketId, assignedTo });

  return ticket;
}

// ============================================
// Messages
// ============================================

/**
 * Add message to ticket
 */
export async function addMessage(params: {
  ticketId: string;
  senderId?: string;
  senderType: "user" | "admin" | "system";
  message: string;
  attachments?: string[];
}): Promise<SupportMessage> {
  const { ticketId, senderId, senderType, message, attachments = [] } = params;

  const result = await query<SupportMessage>(
    `
      INSERT INTO support_messages (ticket_id, sender_id, sender_type, message, attachments)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `,
    [ticketId, senderId ?? null, senderType, message, JSON.stringify(attachments)]
  );

  // Update ticket's updated_at and potentially status
  if (senderType === "user") {
    await query(
      `
        UPDATE support_tickets 
        SET updated_at = NOW(),
            status = CASE WHEN status = 'waiting_user' THEN 'in_progress' ELSE status END
        WHERE id = $1
      `,
      [ticketId]
    );
  } else if (senderType === "admin") {
    await query(
      `
        UPDATE support_tickets 
        SET updated_at = NOW(),
            status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
        WHERE id = $1
      `,
      [ticketId]
    );
  }

  logger.info("ticket_message_added", { ticketId, senderType });

  return result.rows[0];
}

/**
 * Get ticket messages
 */
export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const result = await query<SupportMessage>(
    `SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  );
  return result.rows;
}

// ============================================
// Stats
// ============================================

/**
 * Get support ticket stats
 */
export async function getTicketStats(): Promise<{
  open: number;
  inProgress: number;
  waitingUser: number;
  resolvedToday: number;
  avgResolutionTimeHours: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM support_tickets GROUP BY status`
  );

  const categoryResult = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*)::text as count FROM support_tickets WHERE status NOT IN ('resolved', 'closed') GROUP BY category`
  );

  const priorityResult = await query<{ priority: string; count: string }>(
    `SELECT priority, COUNT(*)::text as count FROM support_tickets WHERE status NOT IN ('resolved', 'closed') GROUP BY priority`
  );

  const resolvedTodayResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM support_tickets WHERE resolved_at::date = CURRENT_DATE`
  );

  const avgTimeResult = await query<{ avg_hours: string }>(
    `
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::text as avg_hours
      FROM support_tickets
      WHERE resolved_at IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
    `
  );

  const stats: Record<string, number> = {};
  for (const row of statusResult.rows) {
    stats[row.status] = Number(row.count);
  }

  const byCategory: Record<string, number> = {};
  for (const row of categoryResult.rows) {
    byCategory[row.category] = Number(row.count);
  }

  const byPriority: Record<string, number> = {};
  for (const row of priorityResult.rows) {
    byPriority[row.priority] = Number(row.count);
  }

  return {
    open: stats["open"] || 0,
    inProgress: stats["in_progress"] || 0,
    waitingUser: stats["waiting_user"] || 0,
    resolvedToday: Number(resolvedTodayResult.rows[0]?.count || 0),
    avgResolutionTimeHours: Number(avgTimeResult.rows[0]?.avg_hours || 0),
    byCategory,
    byPriority,
  };
}

