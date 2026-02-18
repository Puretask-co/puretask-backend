/**
 * Message History & Saved Messages API
 *
 * Handles: message logging, message history, saved drafts
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";

const router = Router();
router.use(requireAuth);

// ============================================
// MESSAGE HISTORY (Logging)
// ============================================

/**
 * @swagger
 * /cleaner/messages/log:
 *   post:
 *     summary: Log a sent message
 *     description: Save a sent message to history (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message_content]
 *             properties:
 *               message_content: { type: string }
 *               recipient_type: { type: string }
 *               recipient_id: { type: string }
 *               recipient_name: { type: string }
 *               template_id: { type: string }
 *               template_name: { type: string }
 *               variables_used: { type: object }
 *               booking_id: { type: string }
 *               message_type: { type: string }
 *               channel: { type: string }
 *               was_ai_generated: { type: boolean }
 *     responses:
 *       201:
 *         description: Message logged
 *       400:
 *         description: Validation error
 */
router.post("/messages/log", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const {
      message_content,
      recipient_type,
      recipient_id,
      recipient_name,
      template_id,
      template_name,
      variables_used,
      booking_id,
      message_type,
      channel,
      was_ai_generated,
    } = req.body;

    if (!message_content) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Message content is required" },
      });
    }

    // Calculate metrics
    const character_count = message_content.length;
    const word_count = message_content.trim().split(/\s+/).length;

    const result = await query(
      `INSERT INTO cleaner_message_history (
        cleaner_id,
        message_content,
        recipient_type,
        recipient_id,
        recipient_name,
        template_id,
        template_name,
        variables_used,
        booking_id,
        message_type,
        channel,
        character_count,
        word_count,
        was_ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, sent_at as "sentAt"`,
      [
        cleanerId,
        message_content,
        recipient_type || "client",
        recipient_id || null,
        recipient_name || null,
        template_id || null,
        template_name || null,
        variables_used ? JSON.stringify(variables_used) : null,
        booking_id || null,
        message_type || "general",
        channel || "manual",
        character_count,
        word_count,
        was_ai_generated || false,
      ]
    );

    res.status(201).json({
      message: "Message logged successfully",
      log: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error logging message:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to log message" },
    });
  }
});

/**
 * @swagger
 * /cleaner/messages/history:
 *   get:
 *     summary: Get message history
 *     description: Get logged messages with optional filters (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: message_type
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string }
 *       - in: query
 *         name: start_date
 *         schema: { type: string }
 *       - in: query
 *         name: end_date
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Message history list
 */
router.get("/messages/history", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { limit = 50, offset = 0, message_type, channel, start_date, end_date } = req.query;

    let sql = `
      SELECT 
        id,
        message_content as content,
        recipient_type as "recipientType",
        recipient_name as "recipientName",
        template_id as "templateId",
        template_name as "templateName",
        variables_used as "variablesUsed",
        booking_id as "bookingId",
        message_type as "messageType",
        channel,
        character_count as "characterCount",
        word_count as "wordCount",
        was_ai_generated as "wasAIGenerated",
        sent_at as "sentAt"
      FROM cleaner_message_history
      WHERE cleaner_id = $1
    `;

    const params: any[] = [cleanerId];
    let paramCount = 1;

    if (message_type) {
      paramCount++;
      sql += ` AND message_type = $${paramCount}`;
      params.push(message_type);
    }

    if (channel) {
      paramCount++;
      sql += ` AND channel = $${paramCount}`;
      params.push(channel);
    }

    if (start_date) {
      paramCount++;
      sql += ` AND sent_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      sql += ` AND sent_at <= $${paramCount}`;
      params.push(end_date);
    }

    sql += ` ORDER BY sent_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM cleaner_message_history WHERE cleaner_id = $1`,
      [cleanerId]
    );

    const countRow = countResult.rows[0] as { count: string };
    res.json({
      messages: result.rows,
      total: parseInt(countRow?.count ?? "0", 10),
      limit: parseInt(String(limit), 10),
      offset: parseInt(String(offset), 10),
    });
  } catch (error: any) {
    console.error("Error fetching message history:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch message history" },
    });
  }
});

// Get message statistics
router.get("/messages/stats", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const stats = await query(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT DATE(sent_at)) as days_active,
        AVG(character_count) as avg_character_count,
        AVG(word_count) as avg_word_count,
        SUM(CASE WHEN was_ai_generated THEN 1 ELSE 0 END) as ai_generated_count,
        COUNT(DISTINCT template_id) as unique_templates_used
      FROM cleaner_message_history
      WHERE cleaner_id = $1`,
      [cleanerId]
    );

    const byType = await query(
      `SELECT 
        message_type as type,
        COUNT(*) as count
      FROM cleaner_message_history
      WHERE cleaner_id = $1
      GROUP BY message_type
      ORDER BY count DESC`,
      [cleanerId]
    );

    const byChannel = await query(
      `SELECT 
        channel,
        COUNT(*) as count
      FROM cleaner_message_history
      WHERE cleaner_id = $1
      GROUP BY channel
      ORDER BY count DESC`,
      [cleanerId]
    );

    res.json({
      overview: stats.rows[0],
      byType: byType.rows,
      byChannel: byChannel.rows,
    });
  } catch (error: any) {
    console.error("Error fetching message stats:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch stats" },
    });
  }
});

// ============================================
// SAVED MESSAGES (Drafts/Favorites)
// ============================================

/**
 * @swagger
 * /cleaner/messages/saved:
 *   get:
 *     summary: Get saved messages
 *     description: Get all saved messages/drafts (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: savedMessages array and count
 */
router.get("/messages/saved", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        id,
        title,
        content,
        category,
        tags,
        times_used as "timesUsed",
        last_used_at as "lastUsedAt",
        is_favorite as "isFavorite",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM cleaner_saved_messages
      WHERE cleaner_id = $1
      ORDER BY is_favorite DESC, updated_at DESC`,
      [cleanerId]
    );

    res.json({
      savedMessages: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching saved messages:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch saved messages" },
    });
  }
});

// Save a new message/draft
router.post("/messages/saved", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { title, content, category, tags, is_favorite } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Title and content are required" },
      });
    }

    const result = await query(
      `INSERT INTO cleaner_saved_messages (
        cleaner_id,
        title,
        content,
        category,
        tags,
        is_favorite
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        title,
        content,
        created_at as "createdAt"`,
      [cleanerId, title, content, category || null, tags || [], is_favorite || false]
    );

    res.status(201).json({
      message: "Message saved successfully",
      savedMessage: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error saving message:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to save message" },
    });
  }
});

/**
 * @swagger
 * /cleaner/messages/saved/{id}:
 *   put:
 *     summary: Update saved message
 *     description: Update a saved message by id (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               category: { type: string }
 *               tags: { type: array }
 *               is_favorite: { type: boolean }
 *     responses:
 *       200:
 *         description: Saved message updated
 *       404:
 *         description: Not found
 */
router.put("/messages/saved/:id", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { id } = req.params;
    const { title, content, category, tags, is_favorite } = req.body;

    const result = await query(
      `UPDATE cleaner_saved_messages
       SET 
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         category = COALESCE($3, category),
         tags = COALESCE($4, tags),
         is_favorite = COALESCE($5, is_favorite),
         updated_at = NOW()
       WHERE id = $6 AND cleaner_id = $7
       RETURNING id, title, updated_at as "updatedAt"`,
      [title, content, category, tags, is_favorite, id, cleanerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Saved message not found" },
      });
    }

    res.json({
      message: "Saved message updated",
      savedMessage: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error updating saved message:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update saved message" },
    });
  }
});

// Delete saved message
router.delete("/messages/saved/:id", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM cleaner_saved_messages
       WHERE id = $1 AND cleaner_id = $2
       RETURNING id`,
      [id, cleanerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Saved message not found" },
      });
    }

    res.json({ message: "Saved message deleted" });
  } catch (error: any) {
    console.error("Error deleting saved message:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to delete saved message" },
    });
  }
});

/**
 * @swagger
 * /cleaner/messages/saved/{id}/use:
 *   post:
 *     summary: Mark saved message as used
 *     description: Increment usage count for a saved message (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usage tracked
 */
router.post("/messages/saved/:id/use", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { id } = req.params;

    await query(
      `UPDATE cleaner_saved_messages
       SET 
         times_used = times_used + 1,
         last_used_at = NOW()
       WHERE id = $1 AND cleaner_id = $2`,
      [id, cleanerId]
    );

    res.json({ message: "Usage tracked" });
  } catch (error: any) {
    console.error("Error tracking usage:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to track usage" },
    });
  }
});

export default router;
