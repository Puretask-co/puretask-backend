"use strict";
// src/routes/photos.ts
// Job photos routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const jwtAuth_1 = require("../middleware/jwtAuth");
const jobPhotosService_1 = require("../services/jobPhotosService");
const photosRouter = (0, express_1.Router)();
// All routes require authentication
photosRouter.use(jwtAuth_1.jwtAuthMiddleware);
/**
 * GET /photos/job/:jobId
 * Get all photos for a job
 */
photosRouter.get("/job/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const { type } = req.query;
        let photos;
        if (type && ["before", "after"].includes(type)) {
            photos = await (0, jobPhotosService_1.getJobPhotosByType)(jobId, type);
        }
        else {
            photos = await (0, jobPhotosService_1.getJobPhotos)(jobId);
        }
        const counts = await (0, jobPhotosService_1.getPhotoCount)(jobId);
        res.json({ photos, counts });
    }
    catch (error) {
        logger_1.logger.error("get_photos_failed", {
            error: error.message,
            jobId: req.params.jobId,
        });
        res.status(500).json({
            error: { code: "GET_PHOTOS_FAILED", message: "Failed to get photos" },
        });
    }
});
/**
 * POST /photos/job/:jobId
 * Add a photo to a job
 */
const addPhotoSchema = zod_1.z.object({
    photoUrl: zod_1.z.string().url(),
    type: zod_1.z.enum(["before", "after"]),
});
photosRouter.post("/job/:jobId", (0, validation_1.validateBody)(addPhotoSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { photoUrl, type } = req.body;
        const photo = await (0, jobPhotosService_1.addJobPhoto)({
            jobId,
            cleanerId: req.user.id,
            photoUrl,
            type,
        });
        res.status(201).json({ photo });
    }
    catch (error) {
        logger_1.logger.error("add_photo_failed", {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.id,
        });
        const message = error.message;
        if (message.includes("not assigned") ||
            message.includes("can only be uploaded")) {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message },
            });
        }
        res.status(400).json({
            error: { code: "ADD_PHOTO_FAILED", message },
        });
    }
});
/**
 * POST /photos/job/:jobId/upload-url
 * Get a presigned URL for uploading a photo
 */
const uploadUrlSchema = zod_1.z.object({
    type: zod_1.z.enum(["before", "after"]),
    contentType: zod_1.z.string(),
});
photosRouter.post("/job/:jobId/upload-url", (0, validation_1.validateBody)(uploadUrlSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { type, contentType } = req.body;
        const urls = await (0, jobPhotosService_1.getUploadUrl)({
            jobId,
            cleanerId: req.user.id,
            type,
            contentType,
        });
        res.json(urls);
    }
    catch (error) {
        logger_1.logger.error("get_upload_url_failed", {
            error: error.message,
            jobId: req.params.jobId,
            userId: req.user?.id,
        });
        if (error.message.includes("Invalid file type")) {
            return res.status(400).json({
                error: { code: "INVALID_FILE_TYPE", message: error.message },
            });
        }
        res.status(500).json({
            error: { code: "GET_UPLOAD_URL_FAILED", message: "Failed to get upload URL" },
        });
    }
});
/**
 * DELETE /photos/:photoId
 * Delete a photo
 */
photosRouter.delete("/:photoId", async (req, res) => {
    try {
        const { photoId } = req.params;
        const deleted = await (0, jobPhotosService_1.deleteJobPhoto)(photoId, req.user.id);
        if (!deleted) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Photo not found or not yours" },
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error("delete_photo_failed", {
            error: error.message,
            photoId: req.params.photoId,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "DELETE_PHOTO_FAILED", message: "Failed to delete photo" },
        });
    }
});
exports.default = photosRouter;
