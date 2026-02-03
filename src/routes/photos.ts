// src/routes/photos.ts
// Job photos routes

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import {
  addJobPhoto,
  getJobPhotos,
  getJobPhotosByType,
  deleteJobPhoto,
  getUploadUrl,
  getPhotoCount,
} from "../services/jobPhotosService";

const photosRouter = Router();

photosRouter.use(requireAuth);

/**
 * @swagger
 * /photos/job/{jobId}:
 *   get:
 *     summary: Get job photos
 *     description: Get all photos for a job, optionally filtered by type (before/after).
 *     tags: [Photos]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [before, after]
 *         description: Filter by photo type
 *     responses:
 *       200:
 *         description: Job photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 *                 counts:
 *                   type: object
 *                   properties:
 *                     before: { type: 'integer' }
 *                     after: { type: 'integer' }
 */
photosRouter.get(
  "/job/:jobId",
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type } = req.query;

      let photos;
      if (type && ["before", "after"].includes(type as string)) {
        photos = await getJobPhotosByType(jobId, type as "before" | "after");
      } else {
        photos = await getJobPhotos(jobId);
      }

      const counts = await getPhotoCount(jobId);

      res.json({ photos, counts });
    } catch (error) {
      logger.error("get_photos_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
      });
      res.status(500).json({
        error: { code: "GET_PHOTOS_FAILED", message: "Failed to get photos" },
      });
    }
  }
);

/**
 * @swagger
 * /photos/job/{jobId}:
 *   post:
 *     summary: Add photo to job
 *     description: Add a before or after photo to a job.
 *     tags: [Photos]
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
 *               - photoUrl
 *               - type
 *             properties:
 *               photoUrl:
 *                 type: string
 *                 format: uri
 *               type:
 *                 type: string
 *                 enum: [before, after]
 *     responses:
 *       201:
 *         description: Photo added
 *       403:
 *         description: Forbidden - not assigned to this job
 */
const addPhotoSchema = z.object({
  photoUrl: z.string().url(),
  type: z.enum(["before", "after"]),
});

photosRouter.post(
  "/job/:jobId",
  validateBody(addPhotoSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { photoUrl, type } = req.body;

      const photo = await addJobPhoto({
        jobId,
        cleanerId: req.user!.id,
        photoUrl,
        type,
      });

      res.status(201).json({ photo });
    } catch (error) {
      logger.error("add_photo_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
        userId: req.user?.id,
      });

      const message = (error as Error).message;
      if (
        message.includes("not assigned") ||
        message.includes("can only be uploaded")
      ) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message },
        });
      }

      res.status(400).json({
        error: { code: "ADD_PHOTO_FAILED", message },
      });
    }
  }
);

/**
 * @swagger
 * /photos/job/{jobId}/upload-url:
 *   post:
 *     summary: Get photo upload URL
 *     description: Get a presigned URL for uploading a photo directly to storage.
 *     tags: [Photos]
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
 *               - type
 *               - contentType
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [before, after]
 *               contentType:
 *                 type: string
 *                 example: image/jpeg
 *               fileSize:
 *                 type: integer
 *                 maximum: 10485760
 *                 description: File size in bytes (max 10MB)
 *     responses:
 *       200:
 *         description: Upload URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl: { type: 'string', format: 'uri' }
 *                 photoUrl: { type: 'string', format: 'uri' }
 *       400:
 *         description: Invalid file type or size
 */
const uploadUrlSchema = z.object({
  type: z.enum(["before", "after"]),
  contentType: z.string(),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024).optional(), // Max 10MB
});

photosRouter.post(
  "/job/:jobId/upload-url",
  validateBody(uploadUrlSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type, contentType, fileSize } = req.body;

      const urls = await getUploadUrl({
        jobId,
        cleanerId: req.user!.id,
        type,
        contentType,
        fileSize,
      });

      res.json(urls);
    } catch (error) {
      logger.error("get_upload_url_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
        userId: req.user?.id,
      });

      if ((error as Error).message.includes("Invalid file type")) {
        return res.status(400).json({
          error: { code: "INVALID_FILE_TYPE", message: (error as Error).message },
        });
      }

      res.status(500).json({
        error: { code: "GET_UPLOAD_URL_FAILED", message: "Failed to get upload URL" },
      });
    }
  }
);

/**
 * @swagger
 * /photos/{photoId}:
 *   delete:
 *     summary: Delete photo
 *     description: Delete a photo from a job.
 *     tags: [Photos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Photo deleted
 *       404:
 *         description: Photo not found or not yours
 */
photosRouter.delete(
  "/:photoId",
  async (req: AuthedRequest, res: Response) => {
    try {
      const { photoId } = req.params;
      const deleted = await deleteJobPhoto(photoId, req.user!.id);

      if (!deleted) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Photo not found or not yours" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("delete_photo_failed", {
        error: (error as Error).message,
        photoId: req.params.photoId,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "DELETE_PHOTO_FAILED", message: "Failed to delete photo" },
      });
    }
  }
);

export default photosRouter;

