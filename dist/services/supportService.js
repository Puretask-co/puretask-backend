"use strict";
// src/services/supportService.ts
// Support ticket system for customer issues
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.getTicketById = getTicketById;
exports.getUserTickets = getUserTickets;
exports.listTickets = listTickets;
exports.updateTicketStatus = updateTicketStatus;
exports.assignTicket = assignTicket;
exports.addMessage = addMessage;
exports.getTicketMessages = getTicketMessages;
exports.getTicketStats = getTicketStats;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const creditEconomyService_1 = require("./creditEconomyService");
// ============================================
// Ticket CRUD
// ============================================
/**
 * Create a support ticket
 */
async function createTicket(params) {
    const { userId, jobId, category, subject, description, priority = "normal", metadata = {}, } = params;
    // Auto-escalate priority for certain categories
    let finalPriority = priority;
    if (category === "dispute" || category === "payout") {
        finalPriority = priority === "low" ? "normal" : priority;
    }
    const result = await (0, client_1.query)(`
      INSERT INTO support_tickets (user_id, job_id, category, subject, description, priority, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `, [userId, jobId ?? null, category, subject, description, finalPriority, JSON.stringify(metadata)]);
    const ticket = result.rows[0];
    // Add initial message from user
    await addMessage({
        ticketId: ticket.id,
        senderId: userId,
        senderType: "user",
        message: description,
    });
    logger_1.logger.info("support_ticket_created", {
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
async function getTicketById(ticketId) {
    const ticketResult = await (0, client_1.query)(`
      SELECT 
        t.*,
        u.email as user_email,
        a.email as assigned_to_email
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.assigned_to
      WHERE t.id = $1
    `, [ticketId]);
    if (ticketResult.rows.length === 0)
        return null;
    const ticket = ticketResult.rows[0];
    // Get messages
    const messagesResult = await (0, client_1.query)(`SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [ticketId]);
    return {
        ...ticket,
        assigned_to_email: ticket.assigned_to_email ?? undefined,
        messages: messagesResult.rows,
    };
}
/**
 * Get tickets for a user
 */
async function getUserTickets(userId, status) {
    let queryText = `SELECT * FROM support_tickets WHERE user_id = $1`;
    const params = [userId];
    if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
    }
    queryText += ` ORDER BY created_at DESC`;
    const result = await (0, client_1.query)(queryText, params);
    return result.rows;
}
/**
 * List all tickets (admin)
 */
async function listTickets(params) {
    const { status, category, priority, assignedTo, limit = 50, offset = 0 } = params;
    const conditions = [];
    const values = [];
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
    const countResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM support_tickets ${whereClause}`, values);
    // Get tickets
    const ticketsResult = await (0, client_1.query)(`SELECT * FROM support_tickets ${whereClause} ORDER BY 
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, [...values, limit, offset]);
    return {
        tickets: ticketsResult.rows,
        total: Number(countResult.rows[0]?.count || 0),
    };
}
/**
 * Update ticket status
 */
async function updateTicketStatus(ticketId, status, adminId, resolution) {
    const updates = [`status = $2`, `updated_at = NOW()`];
    const values = [ticketId, status];
    let paramIndex = 3;
    if (resolution) {
        updates.push(`resolution = $${paramIndex++}`);
        values.push(resolution);
    }
    if (status === "resolved" || status === "closed") {
        updates.push(`resolved_at = NOW()`);
    }
    const result = await (0, client_1.query)(`UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $1 RETURNING *`, values);
    const ticket = result.rows[0];
    // Add system message
    await addMessage({
        ticketId,
        senderType: "system",
        message: `Ticket status changed to: ${status}${resolution ? `. Resolution: ${resolution}` : ""}`,
    });
    if (adminId) {
        await (0, creditEconomyService_1.createAuditLog)({
            actorId: adminId,
            actorType: "admin",
            action: "ticket_status_updated",
            resourceType: "support_ticket",
            resourceId: ticketId,
            newValue: { status, resolution },
        });
    }
    logger_1.logger.info("ticket_status_updated", { ticketId, status, resolution });
    return ticket;
}
/**
 * Assign ticket to admin
 */
async function assignTicket(ticketId, assignedTo, assignedBy) {
    const result = await (0, client_1.query)(`
      UPDATE support_tickets 
      SET assigned_to = $2, 
          status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [ticketId, assignedTo]);
    const ticket = result.rows[0];
    await addMessage({
        ticketId,
        senderType: "system",
        message: `Ticket assigned to support team member.`,
    });
    await (0, creditEconomyService_1.createAuditLog)({
        actorId: assignedBy,
        actorType: "admin",
        action: "ticket_assigned",
        resourceType: "support_ticket",
        resourceId: ticketId,
        newValue: { assigned_to: assignedTo },
    });
    logger_1.logger.info("ticket_assigned", { ticketId, assignedTo });
    return ticket;
}
// ============================================
// Messages
// ============================================
/**
 * Add message to ticket
 */
async function addMessage(params) {
    const { ticketId, senderId, senderType, message, attachments = [] } = params;
    const result = await (0, client_1.query)(`
      INSERT INTO support_messages (ticket_id, sender_id, sender_type, message, attachments)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `, [ticketId, senderId ?? null, senderType, message, JSON.stringify(attachments)]);
    // Update ticket's updated_at and potentially status
    if (senderType === "user") {
        await (0, client_1.query)(`
        UPDATE support_tickets 
        SET updated_at = NOW(),
            status = CASE WHEN status = 'waiting_user' THEN 'in_progress' ELSE status END
        WHERE id = $1
      `, [ticketId]);
    }
    else if (senderType === "admin") {
        await (0, client_1.query)(`
        UPDATE support_tickets 
        SET updated_at = NOW(),
            status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
        WHERE id = $1
      `, [ticketId]);
    }
    logger_1.logger.info("ticket_message_added", { ticketId, senderType });
    return result.rows[0];
}
/**
 * Get ticket messages
 */
async function getTicketMessages(ticketId) {
    const result = await (0, client_1.query)(`SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [ticketId]);
    return result.rows;
}
// ============================================
// Stats
// ============================================
/**
 * Get support ticket stats
 */
async function getTicketStats() {
    const statusResult = await (0, client_1.query)(`SELECT status, COUNT(*)::text as count FROM support_tickets GROUP BY status`);
    const categoryResult = await (0, client_1.query)(`SELECT category, COUNT(*)::text as count FROM support_tickets WHERE status NOT IN ('resolved', 'closed') GROUP BY category`);
    const priorityResult = await (0, client_1.query)(`SELECT priority, COUNT(*)::text as count FROM support_tickets WHERE status NOT IN ('resolved', 'closed') GROUP BY priority`);
    const resolvedTodayResult = await (0, client_1.query)(`SELECT COUNT(*)::text as count FROM support_tickets WHERE resolved_at::date = CURRENT_DATE`);
    const avgTimeResult = await (0, client_1.query)(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::text as avg_hours
      FROM support_tickets
      WHERE resolved_at IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    const stats = {};
    for (const row of statusResult.rows) {
        stats[row.status] = Number(row.count);
    }
    const byCategory = {};
    for (const row of categoryResult.rows) {
        byCategory[row.category] = Number(row.count);
    }
    const byPriority = {};
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
