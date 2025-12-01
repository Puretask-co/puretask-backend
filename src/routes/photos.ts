// src/routes/photos.ts
// Job photos routes

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../middleware/jwtAuth";
import {
  addJobPhoto,
  getJobPhotos,
  getJobPhotosByType,
  deleteJobPhoto,
  getUploadUrl,
  getPhotoCount,
} from "../services/jobPhotosService";

const photosRouter = Router();

// All routes require authentication
photosRouter.use(jwtAuthMiddleware);

/**
 * GET /photos/job/:jobId
 * Get all photos for a job
 */
photosRouter.get(
  "/job/:jobId",
  async (req: JWTAuthedRequest, res: Response) => {
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
 * POST /photos/job/:jobId
 * Add a photo to a job
 */
const addPhotoSchema = z.object({
  photoUrl: z.string().url(),
  type: z.enum(["before", "after"]),
});

photosRouter.post(
  "/job/:jobId",
  validateBody(addPhotoSchema),
  async (req: JWTAuthedRequest, res: Response) => {
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
 * POST /photos/job/:jobId/upload-url
 * Get a presigned URL for uploading a photo
 */
const uploadUrlSchema = z.object({
  type: z.enum(["before", "after"]),
  contentType: z.string(),
});

photosRouter.post(
  "/job/:jobId/upload-url",
  validateBody(uploadUrlSchema),
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type, contentType } = req.body;

      const urls = await getUploadUrl({
        jobId,
        cleanerId: req.user!.id,
        type,
        contentType,
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
 * DELETE /photos/:photoId
 * Delete a photo
 */
photosRouter.delete(
  "/:photoId",
  async (req: JWTAuthedRequest, res: Response) => {
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

