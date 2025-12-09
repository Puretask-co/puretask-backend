"use strict";
// src/routes/messages.ts
// Job messaging/chat routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const jwtAuth_1 = require("../middleware/jwtAuth");
const messagesService_1 = require("../services/messagesService");
const messagesRouter = (0, express_1.Router)();
// All routes require authentication
messagesRouter.use(jwtAuth_1.jwtAuthMiddleware);
/**
 * GET /messages/unread
 * Get total unread message count
 */
messagesRouter.get("/unread", async (req, res) => {
    try {
        const count = await (0, messagesService_1.getUnreadCount)(req.user.id);
        res.json({ unreadCount: count });
    }
    catch (error) {
        logger_1.logger.error("get_unread_count_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_UNREAD_FAILED", message: "Failed to get unread count" },
        });
    }
});
/**
 * GET /messages/unread/by-job
 * Get unread count grouped by job
 */
messagesRouter.get("/unread/by-job", async (req, res) => {
    try {
        const counts = await (0, messagesService_1.getUnreadCountByJob)(req.user.id);
        res.json({ unreadByJob: counts });
    }
    catch (error) {
        logger_1.logger.error("get_unread_by_job_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_UNREAD_FAILED", message: "Failed to get unread counts" },
        });
    }
});
/**
 * GET /messages/conversations
 * Get recent conversations
 */
messagesRouter.get("/conversations", async (req, res) => {
    try {
        const { limit = "20" } = req.query;
        const conversations = await (0, messagesService_1.getRecentConversations)(req.user.id, parseInt(limit, 10));
        res.json({ conversations });
    }
    catch (error) {
        logger_1.logger.error("get_conversations_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_CONVERSATIONS_FAILED", message: "Failed to get conversations" },
        });
    }
});
/**
 * GET /messages/job/:jobId
 * Get messages for a job
 */
messagesRouter.get("/job/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const { limit = "100", before } = req.query;
        const messages = await (0, messagesService_1.getJobMessages)(jobId, req.user.id, parseInt(limit, 10), before);
        res.json({ messages });
    }
    catch (error) {
        logger_1.logger.error("get_messages_failed", {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.id,
        });
        if (error.message.includes("don't have access")) {
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
 * POST /messages/job/:jobId
 * Send a message in a job chat
 */
const sendMessageSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(2000),
    receiverId: zod_1.z.string().uuid().optional(),
});
messagesRouter.post("/job/:jobId", (0, validation_1.validateBody)(sendMessageSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { body, receiverId } = req.body;
        const message = await (0, messagesService_1.sendMessage)({
            jobId,
            senderId: req.user.id,
            senderRole: req.user.role,
            receiverId,
            body,
        });
        res.status(201).json({ message });
    }
    catch (error) {
        logger_1.logger.error("send_message_failed", {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.id,
        });
        if (error.message.includes("not part of") ||
            error.message.includes("not assigned")) {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message: error.message },
            });
        }
        res.status(400).json({
            error: { code: "SEND_MESSAGE_FAILED", message: error.message },
        });
    }
});
/**
 * POST /messages/job/:jobId/read
 * Mark messages as read
 */
messagesRouter.post("/job/:jobId/read", async (req, res) => {
    try {
        const { jobId } = req.params;
        const count = await (0, messagesService_1.markMessagesAsRead)(jobId, req.user.id);
        res.json({ markedAsRead: count });
    }
    catch (error) {
        logger_1.logger.error("mark_read_failed", {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "MARK_READ_FAILED", message: "Failed to mark messages as read" },
        });
    }
});
exports.default = messagesRouter;
