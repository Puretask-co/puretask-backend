// src/routes/messages.ts
// Job messaging/chat routes

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { requireOwnership } from "../lib/ownership";
import {
  sendMessage,
  getJobMessages,
  markMessagesAsRead,
  getUnreadCount,
  getUnreadCountByJob,
  getRecentConversations,
} from "../services/messagesService";

const messagesRouter = Router();

messagesRouter.use(requireAuth);

/**
 * @swagger
 * /messages/unread:
 *   get:
 *     summary: Get total unread message count
 *     description: Get total count of unread messages for the current user.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount: { type: 'integer' }
 */
messagesRouter.get("/unread", async (req: AuthedRequest, res: Response) => {
  try {
    const count = await getUnreadCount(req.user!.id);
    res.json({ unreadCount: count });
  } catch (error) {
    const err = error as Error;
    logger.error("get_unread_count_failed", {
      error: err.message,
      userId: req.user?.id,
    });
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      error: {
        code: "GET_UNREAD_FAILED",
        message: "Failed to get unread count",
        ...(isDev && { details: err.message }),
      },
    });
  }
});

/**
 * @swagger
 * /messages/unread/by-job:
 *   get:
 *     summary: Get unread count by job
 *     description: Get unread message count grouped by job.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread counts by job
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadByJob:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobId: { type: 'string', format: 'uuid' }
 *                       count: { type: 'integer' }
 */
messagesRouter.get("/unread/by-job", async (req: AuthedRequest, res: Response) => {
  try {
    const counts = await getUnreadCountByJob(req.user!.id);
    res.json({ unreadByJob: counts });
  } catch (error) {
    logger.error("get_unread_by_job_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_UNREAD_FAILED", message: "Failed to get unread counts" },
    });
  }
});

/**
 * @swagger
 * /messages/conversations:
 *   get:
 *     summary: Get recent conversations
 *     description: Get list of recent conversations for the current user.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of conversations to return
 *     responses:
 *       200:
 *         description: Recent conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 */
messagesRouter.get("/conversations", async (req: AuthedRequest, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const conversations = await getRecentConversations(req.user!.id, parseInt(limit as string, 10));
    res.json({ conversations });
  } catch (error) {
    logger.error("get_conversations_failed", {
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "GET_CONVERSATIONS_FAILED", message: "Failed to get conversations" },
    });
  }
});

/**
 * @swagger
 * /messages/job/{jobId}:
 *   get:
 *     summary: Get messages for a job
 *     description: Get all messages in a job chat conversation.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Message ID to paginate before
 *     responses:
 *       200:
 *         description: Job messages
 *       403:
 *         description: Forbidden - not part of this job
 */
messagesRouter.get("/job/:jobId", requireOwnership("job", "jobId"), async (req: AuthedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { limit = "100", before } = req.query;

    const messages = await getJobMessages(
      jobId,
      req.user!.id,
      parseInt(limit as string, 10),
      before as string | undefined
    );

    res.json({ messages });
  } catch (error) {
    logger.error("get_messages_failed", {
      error: (error as Error).message,
      jobId: req.params.jobId,
      userId: req.user?.id,
    });

    if ((error as Error).message.includes("don't have access")) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You don't have access to this chat" },
      });
    }

    res.status(500).json({
      error: { code: "GET_MESSAGES_FAILED", message: "Failed to get messages" },
    });
  }
});

/**
 * @swagger
 * /messages/job/{jobId}:
 *   post:
 *     summary: Send a message
 *     description: Send a message in a job chat conversation.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               receiverId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional specific receiver ID
 *     responses:
 *       201:
 *         description: Message sent
 *       403:
 *         description: Forbidden
 */
const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  receiverId: z.string().uuid().optional(),
});

messagesRouter.post(
  "/job/:jobId",
  requireOwnership("job", "jobId"),
  validateBody(sendMessageSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { body, receiverId } = req.body;

      const senderRole =
        req.user!.role === "super_admin" ? "admin" : (req.user!.role as import("../types/db").ActorType);
      const message = await sendMessage({
        jobId,
        senderId: req.user!.id,
        senderRole,
        receiverId,
        body,
      });

      res.status(201).json({ message });
    } catch (error) {
      logger.error("send_message_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
        userId: req.user?.id,
      });

      if (
        (error as Error).message.includes("not part of") ||
        (error as Error).message.includes("not assigned")
      ) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: (error as Error).message },
        });
      }

      res.status(400).json({
        error: { code: "SEND_MESSAGE_FAILED", message: (error as Error).message },
      });
    }
  }
);

/**
 * @swagger
 * /messages/job/{jobId}/read:
 *   post:
 *     summary: Mark messages as read
 *     description: Mark all messages in a job chat as read for the current user.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Messages marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 markedAsRead: { type: 'integer' }
 */
messagesRouter.post("/job/:jobId/read", requireOwnership("job", "jobId"), async (req: AuthedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const count = await markMessagesAsRead(jobId, req.user!.id);
    res.json({ markedAsRead: count });
  } catch (error) {
    logger.error("mark_read_failed", {
      error: (error as Error).message,
      jobId: req.params.jobId,
      userId: req.user?.id,
    });
    res.status(500).json({
      error: { code: "MARK_READ_FAILED", message: "Failed to mark messages as read" },
    });
  }
});

export default messagesRouter;
