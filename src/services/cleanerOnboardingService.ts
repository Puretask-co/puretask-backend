// src/services/cleanerOnboardingService.ts
// Enhanced cleaner onboarding service for 10-step flow

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { uploadFile, validateFile, PROFILE_PHOTO_TYPES, ID_DOCUMENT_TYPES } from "./fileUploadService";

/**
 * Save agreements (Step 1)
 */
export async function saveAgreements(
  cleanerId: string,
  agreements: {
    terms_of_service: boolean;
    independent_contractor: boolean;
  },
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!agreements.terms_of_service || !agreements.independent_contractor) {
      return { success: false, error: "Both agreements must be accepted" };
    }

    // Save terms of service agreement
    await query(
      `INSERT INTO cleaner_agreements (cleaner_id, agreement_type, ip_address, user_agent)
       VALUES ($1, 'terms_of_service', $2, $3)
       ON CONFLICT DO NOTHING`,
      [cleanerId, ipAddress, userAgent]
    );

    // Save independent contractor agreement
    await query(
      `INSERT INTO cleaner_agreements (cleaner_id, agreement_type, ip_address, user_agent)
       VALUES ($1, 'independent_contractor', $2, $3)
       ON CONFLICT DO NOTHING`,
      [cleanerId, ipAddress, userAgent]
    );

    logger.info("agreements_saved", { cleanerId });
    return { success: true };
  } catch (error: any) {
    logger.error("save_agreements_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save agreements" };
  }
}

/**
 * Save basic info (Step 2)
 */
export async function saveBasicInfo(
  cleanerId: string,
  data: {
    first_name: string;
    last_name: string;
    bio: string;
    professional_headline?: string;
  }
): Promise<{ success: boolean; profile?: any; error?: string }> {
  try {
    if (!data.first_name || !data.last_name) {
      return { success: false, error: "First name and last name are required" };
    }

    if (!data.bio || data.bio.length < 20) {
      return { success: false, error: "Bio must be at least 20 characters" };
    }

    const result = await query(
      `UPDATE cleaner_profiles
       SET first_name = $1, last_name = $2, bio = $3, professional_headline = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.first_name, data.last_name, data.bio, data.professional_headline || null, cleanerId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: "Cleaner profile not found" };
    }

    logger.info("basic_info_saved", { cleanerId });
    return { success: true, profile: result.rows[0] };
  } catch (error: any) {
    logger.error("save_basic_info_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save basic info" };
  }
}

/**
 * Upload face photo (Step 4)
 */
export async function uploadFacePhoto(
  cleanerId: string,
  file: { buffer: Buffer; mimetype: string; size: number; originalname: string }
): Promise<{ success: boolean; profile_photo_url?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateFile(file, PROFILE_PHOTO_TYPES, 5 * 1024 * 1024); // 5MB max
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Get user_id for folder structure
    const profileResult = await query(
      `SELECT user_id FROM cleaner_profiles WHERE id = $1`,
      [cleanerId]
    );

    if (profileResult.rows.length === 0) {
      return { success: false, error: "Cleaner profile not found" };
    }

    const userId = profileResult.rows[0].user_id;
    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `face-${Date.now()}${ext}`;

    // Upload file
    const { url } = await uploadFile(file.buffer, userId, "profile-photos", filename);

    // Update profile
    await query(
      `UPDATE cleaner_profiles
       SET profile_photo_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [url, cleanerId]
    );

    logger.info("face_photo_uploaded", { cleanerId });
    return { success: true, profile_photo_url: url };
  } catch (error: any) {
    logger.error("upload_face_photo_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to upload photo" };
  }
}

/**
 * Upload ID verification document (Step 5)
 */
export async function uploadIDVerification(
  cleanerId: string,
  file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  documentType: "drivers_license" | "passport" | "state_id"
): Promise<{ success: boolean; id_verification_id?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateFile(file, ID_DOCUMENT_TYPES, 10 * 1024 * 1024); // 10MB max
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Validate document type
    if (!["drivers_license", "passport", "state_id"].includes(documentType)) {
      return { success: false, error: "Invalid document type" };
    }

    // Get user_id for folder structure
    const profileResult = await query(
      `SELECT user_id FROM cleaner_profiles WHERE id = $1`,
      [cleanerId]
    );

    if (profileResult.rows.length === 0) {
      return { success: false, error: "Cleaner profile not found" };
    }

    const userId = profileResult.rows[0].user_id;
    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `${documentType}-${Date.now()}${ext}`;

    // Upload file
    const { url } = await uploadFile(file.buffer, userId, "identity-documents", filename);

    // Create ID verification record
    const result = await query(
      `INSERT INTO id_verifications (cleaner_id, document_type, document_url, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [cleanerId, documentType, url]
    );

    logger.info("id_verification_uploaded", { cleanerId, documentType });
    return { success: true, id_verification_id: result.rows[0].id };
  } catch (error: any) {
    logger.error("upload_id_verification_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to upload ID document" };
  }
}

/**
 * Save background check consent (Step 6)
 */
export async function saveBackgroundCheckConsent(
  cleanerId: string,
  consents: {
    fcra_consent: boolean;
    accuracy_consent: boolean;
  },
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; background_check_id?: string; error?: string }> {
  try {
    if (!consents.fcra_consent || !consents.accuracy_consent) {
      return { success: false, error: "Both consents must be accepted" };
    }

    // Save agreement
    await query(
      `INSERT INTO cleaner_agreements (cleaner_id, agreement_type, ip_address, user_agent)
       VALUES ($1, 'background_check_consent', $2, $3)
       ON CONFLICT DO NOTHING`,
      [cleanerId, ipAddress, userAgent]
    );

    // Create background check record
    const result = await query(
      `INSERT INTO background_checks (cleaner_id, status)
       VALUES ($1, 'pending')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [cleanerId]
    );

    let backgroundCheckId = result.rows[0]?.id;

    // If record already exists, get it
    if (!backgroundCheckId) {
      const existing = await query(
        `SELECT id FROM background_checks WHERE cleaner_id = $1`,
        [cleanerId]
      );
      backgroundCheckId = existing.rows[0]?.id;
    }

    logger.info("background_check_consent_saved", { cleanerId });
    return { success: true, background_check_id: backgroundCheckId };
  } catch (error: any) {
    logger.error("save_background_check_consent_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save background check consent" };
  }
}

/**
 * Save service areas (Step 7)
 */
export async function saveServiceAreas(
  cleanerId: string,
  data: {
    zip_codes: string[];
    travel_radius_km: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.zip_codes || data.zip_codes.length === 0) {
      return { success: false, error: "At least one zip code is required" };
    }

    // Validate zip codes (5-digit US format)
    const zipRegex = /^\d{5}$/;
    for (const zip of data.zip_codes) {
      if (!zipRegex.test(zip)) {
        return { success: false, error: `Invalid zip code format: ${zip}` };
      }
    }

    // Validate travel radius
    if (data.travel_radius_km < 5 || data.travel_radius_km > 50) {
      return { success: false, error: "Travel radius must be between 5 and 50 km" };
    }

    // Delete existing service areas
    await query(`DELETE FROM cleaner_service_areas WHERE cleaner_id = $1`, [cleanerId]);

    // Insert new service areas
    for (const zipCode of data.zip_codes) {
      await query(
        `INSERT INTO cleaner_service_areas (cleaner_id, zip_code)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [cleanerId, zipCode]
      );
    }

    // Update travel radius
    await query(
      `UPDATE cleaner_profiles
       SET travel_radius_km = $1, updated_at = NOW()
       WHERE id = $2`,
      [data.travel_radius_km, cleanerId]
    );

    logger.info("service_areas_saved", { cleanerId, zipCount: data.zip_codes.length });
    return { success: true };
  } catch (error: any) {
    logger.error("save_service_areas_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save service areas" };
  }
}

/**
 * Save availability (Step 8)
 */
export async function saveAvailability(
  cleanerId: string,
  blocks: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!blocks || blocks.length === 0) {
      return { success: false, error: "At least one availability block is required" };
    }

    // Validate at least one active block
    const activeBlocks = blocks.filter((b) => b.is_active);
    if (activeBlocks.length === 0) {
      return { success: false, error: "At least one day must be enabled" };
    }

    // Delete existing availability blocks
    await query(`DELETE FROM availability_blocks WHERE cleaner_id = $1`, [cleanerId]);

    // Insert new availability blocks
    for (const block of blocks) {
      if (block.is_active) {
        await query(
          `INSERT INTO availability_blocks (cleaner_id, day_of_week, start_time, end_time, is_active)
           VALUES ($1, $2, $3, $4, $5)`,
          [cleanerId, block.day_of_week, block.start_time, block.end_time, block.is_active]
        );
      }
    }

    logger.info("availability_saved", { cleanerId, blockCount: activeBlocks.length });
    return { success: true };
  } catch (error: any) {
    logger.error("save_availability_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save availability" };
  }
}

/**
 * Save rates (Step 9)
 */
export async function saveRates(
  cleanerId: string,
  data: {
    hourly_rate_credits: number;
    travel_radius_km: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate rate (assuming 1 credit = $0.10, so $20-$100 = 200-1000 credits)
    if (data.hourly_rate_credits < 200 || data.hourly_rate_credits > 1000) {
      return { success: false, error: "Hourly rate must be between $20 and $100" };
    }

    // Validate travel radius
    if (data.travel_radius_km < 5 || data.travel_radius_km > 50) {
      return { success: false, error: "Travel radius must be between 5 and 50 km" };
    }

    await query(
      `UPDATE cleaner_profiles
       SET hourly_rate_credits = $1, travel_radius_km = $2, updated_at = NOW()
       WHERE id = $3`,
      [data.hourly_rate_credits, data.travel_radius_km, cleanerId]
    );

    logger.info("rates_saved", { cleanerId });
    return { success: true };
  } catch (error: any) {
    logger.error("save_rates_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to save rates" };
  }
}

/**
 * Complete onboarding (Step 10)
 */
export async function completeOnboarding(cleanerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify all steps are complete
    const progressResult = await query(
      `SELECT cleaner_onboarding_progress($1) as progress`,
      [cleanerId]
    );

    const progress = progressResult.rows[0].progress;
    const completedSteps = progress.completed;
    const totalSteps = progress.total;

    if (completedSteps < 9) {
      return {
        success: false,
        error: `Please complete all steps. Currently ${completedSteps}/${totalSteps} steps completed.`,
      };
    }

    // Mark onboarding as complete
    await query(
      `UPDATE cleaner_profiles
       SET onboarding_completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [cleanerId]
    );

    logger.info("onboarding_completed", { cleanerId });
    return { success: true };
  } catch (error: any) {
    logger.error("complete_onboarding_failed", { cleanerId, error: error.message });
    return { success: false, error: "Failed to complete onboarding" };
  }
}

/**
 * Get onboarding progress
 */
export async function getOnboardingProgress(cleanerId: string): Promise<any> {
  try {
    const result = await query(
      `SELECT 
        cleaner_onboarding_progress($1) as progress,
        onboarding_current_step
      FROM cleaner_profiles
      WHERE id = $1`,
      [cleanerId]
    );

    if (result.rows.length === 0) {
      return { completed: 0, total: 10, percentage: 0, current_step: "terms" };
    }

    return {
      ...result.rows[0].progress,
      current_step: result.rows[0].onboarding_current_step || "terms",
    };
  } catch (error: any) {
    logger.error("get_onboarding_progress_failed", { cleanerId, error: error.message });
    return { completed: 0, total: 10, percentage: 0, current_step: "terms" };
  }
}

import path from "path";
