// src/routes/messages.ts
// Job messaging/chat routes

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../middleware/jwtAuth";
import {
  sendMessage,
  getJobMessages,
  markMessagesAsRead,
  getUnreadCount,
  getUnreadCountByJob,
  getRecentConversations,
} from "../services/messagesService";

const messagesRouter = Router();

// All routes require authentication
messagesRouter.use(jwtAuthMiddleware);

/**
 * GET /messages/unread
 * Get total unread message count
 */
messagesRouter.get(
  "/unread",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const count = await getUnreadCount(req.user!.id);
      res.json({ unreadCount: count });
    } catch (error) {
      logger.error("get_unread_count_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_UNREAD_FAILED", message: "Failed to get unread count" },
      });
    }
  }
);

/**
 * GET /messages/unread/by-job
 * Get unread count grouped by job
 */
messagesRouter.get(
  "/unread/by-job",
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

/**
 * GET /messages/conversations
 * Get recent conversations
 */
messagesRouter.get(
  "/conversations",
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { limit = "20" } = req.query;
      const conversations = await getRecentConversations(
        req.user!.id,
        parseInt(limit as string, 10)
      );
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
  }
);

/**
 * GET /messages/job/:jobId
 * Get messages for a job
 */
messagesRouter.get(
  "/job/:jobId",
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

/**
 * POST /messages/job/:jobId
 * Send a message in a job chat
 */
const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  receiverId: z.string().uuid().optional(),
});

messagesRouter.post(
  "/job/:jobId",
  validateBody(sendMessageSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { body, receiverId } = req.body;

      const message = await sendMessage({
        jobId,
        senderId: req.user!.id,
        senderRole: req.user!.role,
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

      if ((error as Error).message.includes("not part of") ||
          (error as Error).message.includes("not assigned")) {
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
 * POST /messages/job/:jobId/read
 * Mark messages as read
 */
messagesRouter.post(
  "/job/:jobId/read",
  async (req: JWTAuthedRequest, res: Response) => {
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
  }
);

export default messagesRouter;

