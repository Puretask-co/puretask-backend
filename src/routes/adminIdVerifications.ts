// src/routes/adminIdVerifications.ts
// Admin routes for ID verification management

import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { query } from "../db/client";

const adminIdVerificationsRouter = Router();

adminIdVerificationsRouter.use(requireAuth);
adminIdVerificationsRouter.use(requireAdmin);

/**
 * @swagger
 * /admin/id-verifications:
 *   get:
 *     summary: Get ID verifications
 *     description: Get all ID verifications with optional filtering (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, failed, all]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or document type
 *     responses:
 *       200:
 *         description: List of ID verifications
 *       403:
 *         description: Forbidden - admin only
 */
adminIdVerificationsRouter.get("/", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    let sql = `
      SELECT 
        iv.*,
        json_build_object(
          'id', cp.id,
          'first_name', cp.first_name,
          'last_name', cp.last_name,
          'user_id', cp.user_id,
          'profile_photo_url', cp.profile_photo_url
        ) as cleaner_profile
      FROM id_verifications iv
      JOIN cleaner_profiles cp ON cp.id = iv.cleaner_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (statusFilter && statusFilter !== "all") {
      sql += ` AND iv.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        cp.first_name ILIKE $${paramIndex} OR
        cp.last_name ILIKE $${paramIndex} OR
        iv.document_type ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY iv.created_at DESC`;

    const result = await query(sql, params);

    const verifications = result.rows.map((row) => ({
      ...row,
      cleaner_profile: row.cleaner_profile,
    }));

    res.json({ verifications, count: verifications.length });
  } catch (error: any) {
    logger.error("get_id_verifications_failed", { error: error.message });
    res.status(500).json({
      error: { code: "GET_VERIFICATIONS_FAILED", message: "Failed to get ID verifications" },
    });
  }
}));

/**
 * @swagger
 * /admin/id-verifications/{id}:
 *   get:
 *     summary: Get ID verification by ID
 *     description: Get a specific ID verification (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ID verification details
 *       404:
 *         description: Not found
 *       403:
 *         description: Forbidden - admin only
 */
adminIdVerificationsRouter.get("/:id", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        iv.*,
        json_build_object(
          'id', cp.id,
          'first_name', cp.first_name,
          'last_name', cp.last_name,
          'user_id', cp.user_id,
          'profile_photo_url', cp.profile_photo_url
        ) as cleaner_profile
      FROM id_verifications iv
      JOIN cleaner_profiles cp ON cp.id = iv.cleaner_id
      WHERE iv.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "ID verification not found" },
      });
      return;
    }

    res.json({
      verification: {
        ...result.rows[0],
        cleaner_profile: result.rows[0].cleaner_profile,
      },
    });
  } catch (error: any) {
    logger.error("get_id_verification_failed", { error: error.message });
    res.status(500).json({
      error: { code: "GET_VERIFICATION_FAILED", message: "Failed to get ID verification" },
    });
  }
}));

/**
 * @swagger
 * /admin/id-verifications/{id}/approve:
 *   post:
 *     summary: Approve ID verification
 *     description: Approve an ID verification (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification approved
 *       403:
 *         description: Forbidden - admin only
 * /admin/id-verifications/{id}/reject:
 *   post:
 *     summary: Reject ID verification
 *     description: Reject an ID verification (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification rejected
 *       403:
 *         description: Forbidden - admin only
 */
adminIdVerificationsRouter.patch("/:id/status", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      status: z.enum(["pending", "verified", "failed"]),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const { id } = req.params;
    const adminId = req.user!.id;

    const updateData: any = {
      status: body.status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    };

    if (body.notes) {
      updateData.notes = body.notes;
    }

    // If verified, set expiry to 5 years from now
    if (body.status === "verified") {
      updateData.verified_at = new Date().toISOString();
      updateData.expires_at = new Date(
        Date.now() + 5 * 365 * 24 * 60 * 60 * 1000
      ).toISOString();
    }

    // If failed, clear verified_at and expires_at
    if (body.status === "failed") {
      updateData.verified_at = null;
      updateData.expires_at = null;
    }

    await query(
      `UPDATE id_verifications
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = $3,
           notes = $4,
           verified_at = $5,
           expires_at = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [
        updateData.status,
        updateData.reviewed_by,
        updateData.reviewed_at,
        updateData.notes || null,
        updateData.verified_at || null,
        updateData.expires_at || null,
        id,
      ]
    );

    logger.info("id_verification_status_updated", {
      verificationId: id,
      status: body.status,
      adminId,
    });

    res.json({ success: true, status: body.status });
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
      });
      return;
    }

    logger.error("update_id_verification_status_failed", { error: error.message });
    res.status(500).json({
      error: { code: "UPDATE_STATUS_FAILED", message: "Failed to update status" },
    });
  }
}));

/**
 * @swagger
 * /admin/id-verifications/{id}/document-url:
 *   get:
 *     summary: Get document URL
 *     description: Get signed URL for ID verification document (expires in 5 minutes, admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document URL
 *       404:
 *         description: Not found
 *       403:
 *         description: Forbidden - admin only
 */
adminIdVerificationsRouter.get("/:id/document-url", authedHandler(async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT document_url FROM id_verifications WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "ID verification not found" },
      });
      return;
    }

    const documentUrl = result.rows[0].document_url;

    if (!documentUrl) {
      res.status(404).json({
        error: { code: "NO_DOCUMENT", message: "Document URL not found" },
      });
      return;
    }

    // For now, return the URL directly
    // In production with S3/Cloudinary, generate a signed URL here
    // For local storage, we can serve it directly or create a signed URL
    res.json({
      document_url: documentUrl,
      expires_in: 300, // 5 minutes
    });
  } catch (error: any) {
    logger.error("get_document_url_failed", { error: error.message });
    res.status(500).json({
      error: { code: "GET_DOCUMENT_URL_FAILED", message: "Failed to get document URL" },
    });
  }
}));

export default adminIdVerificationsRouter;
