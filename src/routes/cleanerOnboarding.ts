// src/routes/cleanerOnboarding.ts
// Enhanced cleaner onboarding routes (10-step flow)

import { Router, Response } from "express";
import multer from "multer";
import { z } from "zod";
import {
  requireAuth,
  requireRole,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { query } from "../db/client";
import {
  saveAgreements,
  saveBasicInfo,
  uploadFacePhoto,
  uploadIDVerification,
  saveBackgroundCheckConsent,
  saveServiceAreas,
  saveAvailability,
  saveRates,
  completeOnboarding,
  getOnboardingProgress,
} from "../services/cleanerOnboardingService";
import { sendOTP, verifyOTP } from "../services/phoneVerificationService";

const onboardingRouter = Router();

onboardingRouter.use(requireAuth);
onboardingRouter.use(requireRole("cleaner", "admin"));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * PATCH /cleaner/onboarding/current-step
 * Save current onboarding step (for persistence)
 */
onboardingRouter.patch(
  "/current-step",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        step: z.enum([
          "terms",
          "basic-info",
          "phone-verification",
          "face-verification",
          "id-verification",
          "background-consent",
          "service-areas",
          "availability",
          "rates",
          "review",
        ]),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
        return;
      }

      const cleanerId = profileResult.rows[0].id;

      await query(
        `UPDATE cleaner_profiles
       SET onboarding_current_step = $1, updated_at = NOW()
       WHERE id = $2`,
        [body.step, cleanerId]
      );

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
        return;
      }

      logger.error("save_current_step_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_STEP_FAILED", message: "Failed to save current step" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/progress:
 *   get:
 *     summary: Get onboarding progress
 *     description: Get onboarding progress for the current cleaner.
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding progress
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.get(
  "/progress",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
        return;
      }

      const cleanerId = profileResult.rows[0].id;
      const progress = await getOnboardingProgress(cleanerId);

      res.json({ progress });
    } catch (error: any) {
      logger.error("get_onboarding_progress_failed", { error: error.message });
      res.status(500).json({
        error: { code: "GET_PROGRESS_FAILED", message: "Failed to get onboarding progress" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/terms:
 *   post:
 *     summary: Step 1 - Save agreements
 *     description: Save terms of service and independent contractor agreements (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - terms_of_service
 *               - independent_contractor
 *             properties:
 *               terms_of_service:
 *                 type: boolean
 *               independent_contractor:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agreements saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/agreements",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        terms_of_service: z.boolean(),
        independent_contractor: z.boolean(),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string);
      const userAgent = req.headers["user-agent"];

      const result = await saveAgreements(cleanerId, body, ipAddress, userAgent);

      if (!result.success) {
        res.status(400).json({
          error: { code: "SAVE_AGREEMENTS_FAILED", message: result.error },
        });
        return;
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
        return;
      }

      logger.error("save_agreements_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_AGREEMENTS_FAILED", message: "Failed to save agreements" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/basic-info:
 *   post:
 *     summary: Step 2 - Save basic info
 *     description: Save basic info (name, bio, professional headline) (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - last_name
 *               - bio
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               bio:
 *                 type: string
 *                 minLength: 20
 *               professional_headline:
 *                 type: string
 *     responses:
 *       200:
 *         description: Basic info saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/basic-info",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        bio: z.string().min(20),
        professional_headline: z.string().optional(),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const result = await saveBasicInfo(cleanerId, body);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SAVE_BASIC_INFO_FAILED", message: result.error },
        });
      }

      res.json({ success: true, profile: result.profile });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("save_basic_info_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_BASIC_INFO_FAILED", message: "Failed to save basic info" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/phone-send-otp:
 *   post:
 *     summary: Step 3a - Send phone OTP
 *     description: Send OTP code to phone number for verification (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number
 *             properties:
 *               phone_number:
 *                 type: string
 *                 pattern: '^\+[1-9]\d{1,14}$'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/phone/send-otp",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        phone_number: z.string().regex(/^\+[1-9]\d{1,14}$/, "Invalid phone number format"),
      });

      const body = schema.parse(req.body);
      const result = await sendOTP(req.user!.id, body.phone_number);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SEND_OTP_FAILED", message: result.error },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("send_otp_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SEND_OTP_FAILED", message: "Failed to send OTP" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/phone-verify-otp:
 *   post:
 *     summary: Step 3b - Verify phone OTP
 *     description: Verify OTP code for phone verification (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number
 *               - otp_code
 *             properties:
 *               phone_number:
 *                 type: string
 *                 pattern: '^\+[1-9]\d{1,14}$'
 *               otp_code:
 *                 type: string
 *                 length: 6
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/phone/verify-otp",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        phone_number: z.string().regex(/^\+[1-9]\d{1,14}$/, "Invalid phone number format"),
        otp_code: z.string().length(6, "OTP code must be 6 digits"),
      });

      const body = schema.parse(req.body);
      const result = await verifyOTP(req.user!.id, body.phone_number, body.otp_code);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "VERIFY_OTP_FAILED", message: result.error },
        });
      }

      res.json({ success: true, verified: result.verified });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("verify_otp_failed", { error: error.message });
      res.status(500).json({
        error: { code: "VERIFY_OTP_FAILED", message: "Failed to verify OTP" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/face-photo:
 *   post:
 *     summary: Step 4 - Upload face photo
 *     description: Upload face photo for profile (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Face photo uploaded successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/face-photo",
  upload.single("file"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { code: "NO_FILE", message: "No file uploaded" },
        });
      }

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const file = {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname,
      };

      const result = await uploadFacePhoto(cleanerId, file);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "UPLOAD_FACE_PHOTO_FAILED", message: result.error },
        });
      }

      res.json({ success: true, profile_photo_url: result.profile_photo_url });
    } catch (error: any) {
      logger.error("upload_face_photo_failed", { error: error.message });
      res.status(500).json({
        error: { code: "UPLOAD_FACE_PHOTO_FAILED", message: "Failed to upload face photo" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/id-verification:
 *   post:
 *     summary: Step 5 - Upload ID verification
 *     description: Upload ID verification document (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - document_type
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               document_type:
 *                 type: string
 *                 enum: [drivers_license, passport, state_id]
 *     responses:
 *       200:
 *         description: ID verification uploaded successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/id-verification",
  upload.single("file"),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { code: "NO_FILE", message: "No file uploaded" },
        });
      }

      const schema = z.object({
        document_type: z.enum(["drivers_license", "passport", "state_id"]),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const file = {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname,
      };

      const result = await uploadIDVerification(cleanerId, file, body.document_type);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "UPLOAD_ID_VERIFICATION_FAILED", message: result.error },
        });
      }

      res.json({ success: true, id_verification_id: result.id_verification_id });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("upload_id_verification_failed", { error: error.message });
      res.status(500).json({
        error: {
          code: "UPLOAD_ID_VERIFICATION_FAILED",
          message: "Failed to upload ID verification",
        },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/background-consent:
 *   post:
 *     summary: Step 6 - Save background check consent
 *     description: Save background check consent (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcra_consent
 *               - accuracy_consent
 *             properties:
 *               fcra_consent:
 *                 type: boolean
 *               accuracy_consent:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Background check consent saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/background-consent",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        fcra_consent: z.boolean(),
        accuracy_consent: z.boolean(),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string);
      const userAgent = req.headers["user-agent"];

      const result = await saveBackgroundCheckConsent(cleanerId, body, ipAddress, userAgent);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SAVE_BACKGROUND_CONSENT_FAILED", message: result.error },
        });
      }

      res.json({ success: true, background_check_id: result.background_check_id });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("save_background_consent_failed", { error: error.message });
      res.status(500).json({
        error: {
          code: "SAVE_BACKGROUND_CONSENT_FAILED",
          message: "Failed to save background check consent",
        },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/service-areas:
 *   post:
 *     summary: Step 7 - Save service areas
 *     description: Save service areas (zip codes) (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zip_codes
 *               - travel_radius_km
 *             properties:
 *               zip_codes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   pattern: '^\d{5}$'
 *                 minItems: 1
 *               travel_radius_km:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 50
 *     responses:
 *       200:
 *         description: Service areas saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/service-areas",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        zip_codes: z.array(z.string().regex(/^\d{5}$/, "Invalid zip code format")).min(1),
        travel_radius_km: z.number().min(5).max(50),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const result = await saveServiceAreas(cleanerId, body);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SAVE_SERVICE_AREAS_FAILED", message: result.error },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("save_service_areas_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_SERVICE_AREAS_FAILED", message: "Failed to save service areas" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/availability:
 *   post:
 *     summary: Step 8 - Save availability
 *     description: Save availability schedule (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blocks
 *             properties:
 *               blocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - day_of_week
 *                     - start_time
 *                     - end_time
 *                     - is_active
 *                   properties:
 *                     day_of_week:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 6
 *                     start_time:
 *                       type: string
 *                     end_time:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Availability saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/availability",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        blocks: z
          .array(
            z.object({
              day_of_week: z.number().int().min(0).max(6),
              start_time: z.string(),
              end_time: z.string(),
              is_active: z.boolean(),
            })
          )
          .min(1),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const result = await saveAvailability(cleanerId, body.blocks);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SAVE_AVAILABILITY_FAILED", message: result.error },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("save_availability_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_AVAILABILITY_FAILED", message: "Failed to save availability" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/step/rates:
 *   post:
 *     summary: Step 9 - Save rates
 *     description: Save hourly rate and travel radius (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hourly_rate_credits
 *               - travel_radius_km
 *             properties:
 *               hourly_rate_credits:
 *                 type: integer
 *                 minimum: 200
 *                 maximum: 1000
 *               travel_radius_km:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 50
 *     responses:
 *       200:
 *         description: Rates saved successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/rates",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const schema = z.object({
        hourly_rate_credits: z.number().int().min(200).max(1000),
        travel_radius_km: z.number().min(5).max(50),
      });

      const body = schema.parse(req.body);

      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const result = await saveRates(cleanerId, body);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "SAVE_RATES_FAILED", message: result.error },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.issues) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
        });
      }

      logger.error("save_rates_failed", { error: error.message });
      res.status(500).json({
        error: { code: "SAVE_RATES_FAILED", message: "Failed to save rates" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/complete:
 *   post:
 *     summary: Complete onboarding
 *     description: Complete the onboarding process (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
onboardingRouter.post(
  "/complete",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
        req.user!.id,
      ]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
        });
      }

      const cleanerId = profileResult.rows[0].id;
      const result = await completeOnboarding(cleanerId);

      if (!result.success) {
        return res.status(400).json({
          error: { code: "COMPLETE_ONBOARDING_FAILED", message: result.error },
        });
      }

      res.json({
        success: true,
        onboarding_completed_at: new Date().toISOString(),
        redirect_to: "/cleaner/dashboard",
      });
    } catch (error: any) {
      logger.error("complete_onboarding_failed", { error: error.message });
      res.status(500).json({
        error: { code: "COMPLETE_ONBOARDING_FAILED", message: "Failed to complete onboarding" },
      });
    }
  })
);

export default onboardingRouter;
