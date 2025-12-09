"use strict";
// src/services/messagesService.ts
// Job messaging/chat service
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
exports.getJobMessages = getJobMessages;
exports.markMessagesAsRead = markMessagesAsRead;
exports.getUnreadCount = getUnreadCount;
exports.getUnreadCountByJob = getUnreadCountByJob;
exports.getRecentConversations = getRecentConversations;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
/**
 * Send a message in a job chat
 */
async function sendMessage(input) {
    const { jobId, senderId, senderRole, receiverId, body } = input;
    // Verify sender has access to job
    const jobResult = await (0, client_1.query)(`SELECT client_id, cleaner_id, status FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw new Error("Job not found");
    }
    const job = jobResult.rows[0];
    // Verify sender is part of the job
    if (senderRole === "client" &&
        job.client_id !== senderId) {
        throw new Error("You are not part of this job");
    }
    if (senderRole === "cleaner" &&
        job.cleaner_id !== senderId) {
        throw new Error("You are not assigned to this job");
    }
    // Determine receiver
    let actualReceiverId = receiverId;
    if (!actualReceiverId) {
        // Auto-determine receiver
        if (senderRole === "client" && job.cleaner_id) {
            actualReceiverId = job.cleaner_id;
        }
        else if (senderRole === "cleaner") {
            actualReceiverId = job.client_id;
        }
    }
    // Insert message
    const result = await (0, client_1.query)(`
      INSERT INTO messages (
        job_id,
        sender_role,
        sender_id,
        receiver_id,
        body,
        sent_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [jobId, senderRole, senderId, actualReceiverId, body]);
    logger_1.logger.info("message_sent", {
        jobId,
        senderId,
        senderRole,
        messageId: result.rows[0].id,
    });
    return result.rows[0];
}
/**
 * Get messages for a job
 */
async function getJobMessages(jobId, userId, limit = 100, before) {
    // Verify user has access to job
    const jobResult = await (0, client_1.query)(`SELECT client_id, cleaner_id FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw new Error("Job not found");
    }
    const job = jobResult.rows[0];
    if (job.client_id !== userId && job.cleaner_id !== userId) {
        throw new Error("You don't have access to this job's messages");
    }
    // Build query
    let queryText = `
    SELECT *
    FROM messages
    WHERE job_id = $1
  `;
    const params = [jobId];
    let paramIndex = 2;
    if (before) {
        queryText += ` AND sent_at < $${paramIndex++}`;
        params.push(before);
    }
    queryText += ` ORDER BY sent_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    const result = await (0, client_1.query)(queryText, params);
    // Return in chronological order
    return result.rows.reverse();
}
/**
 * Mark messages as read
 */
async function markMessagesAsRead(jobId, userId) {
    const result = await (0, client_1.query)(`
      UPDATE messages
      SET read_at = NOW()
      WHERE job_id = $1
        AND receiver_id = $2
        AND read_at IS NULL
      RETURNING id
    `, [jobId, userId]);
    logger_1.logger.info("messages_marked_read", {
        jobId,
        userId,
        count: result.rows.length,
    });
    return result.rows.length;
}
/**
 * Get unread message count for user
 */
async function getUnreadCount(userId) {
    const result = await (0, client_1.query)(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE receiver_id = $1
        AND read_at IS NULL
    `, [userId]);
    return parseInt(result.rows[0]?.count || "0", 10);
}
/**
 * Get unread count by job
 */
async function getUnreadCountByJob(userId) {
    const result = await (0, client_1.query)(`
      SELECT job_id, COUNT(*) as count
      FROM messages
      WHERE receiver_id = $1
        AND read_at IS NULL
      GROUP BY job_id
    `, [userId]);
    return result.rows.map((row) => ({
        jobId: row.job_id,
        count: parseInt(row.count, 10),
    }));
}
/**
 * Get recent conversations for user
 */
async function getRecentConversations(userId, limit = 20) {
    // Get jobs where user is participant
    const jobsResult = await (0, client_1.query)(`
      SELECT id, client_id, cleaner_id
      FROM jobs
      WHERE (client_id = $1 OR cleaner_id = $1)
        AND status NOT IN ('cancelled')
      ORDER BY updated_at DESC
      LIMIT $2
    `, [userId, limit]);
    const conversations = [];
    for (const job of jobsResult.rows) {
        // Get last message
        const lastMsgResult = await (0, client_1.query)(`
        SELECT *
        FROM messages
        WHERE job_id = $1
        ORDER BY sent_at DESC
        LIMIT 1
      `, [job.id]);
        if (lastMsgResult.rows.length === 0)
            continue;
        // Get unread count
        const unreadResult = await (0, client_1.query)(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE job_id = $1
          AND receiver_id = $2
          AND read_at IS NULL
      `, [job.id, userId]);
        // Get other user
        const otherUserId = job.client_id === userId ? job.cleaner_id : job.client_id;
        if (!otherUserId)
            continue;
        const otherUserResult = await (0, client_1.query)(`SELECT id, full_name, role FROM users WHERE id = $1`, [otherUserId]);
        if (otherUserResult.rows.length === 0)
            continue;
        conversations.push({
            jobId: job.id,
            lastMessage: lastMsgResult.rows[0],
            unreadCount: parseInt(unreadResult.rows[0]?.count || "0", 10),
            otherUser: {
                id: otherUserResult.rows[0].id,
                name: otherUserResult.rows[0].full_name,
                role: otherUserResult.rows[0].role,
            },
        });
    }
    return conversations;
}
