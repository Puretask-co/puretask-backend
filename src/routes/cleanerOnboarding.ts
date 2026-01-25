// src/routes/cleanerOnboarding.ts
// Enhanced cleaner onboarding routes (10-step flow)

import { Router, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
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

// All routes require authentication as cleaner
onboardingRouter.use(jwtAuthMiddleware);
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
onboardingRouter.patch("/current-step", async (req: JWTAuthedRequest, res: Response) => {
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

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
      });
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
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
      });
    }

    logger.error("save_current_step_failed", { error: error.message });
    res.status(500).json({
      error: { code: "SAVE_STEP_FAILED", message: "Failed to save current step" },
    });
  }
});

/**
 * GET /cleaner/onboarding/progress
 * Get onboarding progress
 */
onboardingRouter.get("/progress", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
      });
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
});

/**
 * POST /cleaner/onboarding/agreements
 * Step 1: Save terms of service and independent contractor agreements
 */
onboardingRouter.post("/agreements", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      terms_of_service: z.boolean(),
      independent_contractor: z.boolean(),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
      });
    }

    const cleanerId = profileResult.rows[0].id;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] as string;
    const userAgent = req.headers["user-agent"];

    const result = await saveAgreements(cleanerId, body, ipAddress, userAgent);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "SAVE_AGREEMENTS_FAILED", message: result.error },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    if (error.issues) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
      });
    }

    logger.error("save_agreements_failed", { error: error.message });
    res.status(500).json({
      error: { code: "SAVE_AGREEMENTS_FAILED", message: "Failed to save agreements" },
    });
  }
});

/**
 * POST /cleaner/onboarding/basic-info
 * Step 2: Save basic info (name, bio, professional headline)
 */
onboardingRouter.post("/basic-info", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      bio: z.string().min(20),
      professional_headline: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

/**
 * POST /cleaner/onboarding/phone/send-otp
 * Step 3: Send OTP code to phone number
 */
onboardingRouter.post("/phone/send-otp", async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * POST /cleaner/onboarding/phone/verify-otp
 * Step 3: Verify OTP code
 */
onboardingRouter.post("/phone/verify-otp", async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * POST /cleaner/onboarding/face-photo
 * Step 4: Upload face photo
 */
onboardingRouter.post("/face-photo", upload.single("file"), async (req: JWTAuthedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: "NO_FILE", message: "No file uploaded" },
      });
    }

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

/**
 * POST /cleaner/onboarding/id-verification
 * Step 5: Upload ID verification document
 */
onboardingRouter.post("/id-verification", upload.single("file"), async (req: JWTAuthedRequest, res: Response) => {
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

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
      error: { code: "UPLOAD_ID_VERIFICATION_FAILED", message: "Failed to upload ID verification" },
    });
  }
});

/**
 * POST /cleaner/onboarding/background-consent
 * Step 6: Save background check consent
 */
onboardingRouter.post("/background-consent", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      fcra_consent: z.boolean(),
      accuracy_consent: z.boolean(),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        error: { code: "PROFILE_NOT_FOUND", message: "Cleaner profile not found" },
      });
    }

    const cleanerId = profileResult.rows[0].id;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] as string;
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
      error: { code: "SAVE_BACKGROUND_CONSENT_FAILED", message: "Failed to save background check consent" },
    });
  }
});

/**
 * POST /cleaner/onboarding/service-areas
 * Step 7: Save service areas (zip codes)
 */
onboardingRouter.post("/service-areas", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      zip_codes: z.array(z.string().regex(/^\d{5}$/, "Invalid zip code format")).min(1),
      travel_radius_km: z.number().min(5).max(50),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

/**
 * POST /cleaner/onboarding/availability
 * Step 8: Save availability schedule
 */
onboardingRouter.post("/availability", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      blocks: z.array(
        z.object({
          day_of_week: z.number().int().min(0).max(6),
          start_time: z.string(),
          end_time: z.string(),
          is_active: z.boolean(),
        })
      ).min(1),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

/**
 * POST /cleaner/onboarding/rates
 * Step 9: Save hourly rate and travel radius
 */
onboardingRouter.post("/rates", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const schema = z.object({
      hourly_rate_credits: z.number().int().min(200).max(1000),
      travel_radius_km: z.number().min(5).max(50),
    });

    const body = schema.parse(req.body);

    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

/**
 * POST /cleaner/onboarding/complete
 * Step 10: Complete onboarding
 */
onboardingRouter.post("/complete", async (req: JWTAuthedRequest, res: Response) => {
  try {
    const profileResult = await query(
      `SELECT id FROM cleaner_profiles WHERE user_id = $1`,
      [req.user!.id]
    );

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
});

export default onboardingRouter;
