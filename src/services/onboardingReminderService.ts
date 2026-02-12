// src/services/onboardingReminderService.ts
// Email reminder service for abandoned onboarding

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import sgMail from "@sendgrid/mail";

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

/**
 * Step display name mapping
 */
function getStepDisplayName(step: string | null): string {
  const stepNames: Record<string, string> = {
    terms: "Terms & Agreements",
    "basic-info": "Basic Information",
    "phone-verification": "Phone Verification",
    "face-verification": "Profile Photo",
    "id-verification": "ID Verification",
    "background-consent": "Background Check",
    "service-areas": "Service Areas",
    availability: "Availability",
    rates: "Rates & Pricing",
    review: "Final Review",
  };
  return stepNames[step || "terms"] || "Getting Started";
}

/**
 * Get abandoned onboarding cleaners
 */
export async function getAbandonedOnboardingCleaners(
  hoursThreshold: number = 24
): Promise<Array<{
  id: string;
  user_id: string;
  first_name: string | null;
  onboarding_current_step: string | null;
  onboarding_started_at: Date;
  email: string;
}>> {
  try {
    const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    const result = await query(
      `SELECT 
        cp.id,
        cp.user_id,
        cp.first_name,
        cp.onboarding_current_step,
        cp.onboarding_started_at,
        u.email
      FROM cleaner_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.onboarding_completed_at IS NULL
        AND cp.onboarding_started_at < $1
        AND (cp.onboarding_reminder_sent_at IS NULL 
             OR cp.onboarding_reminder_sent_at < cp.onboarding_started_at)
      ORDER BY cp.onboarding_started_at ASC`,
      [thresholdDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      first_name: row.first_name,
      onboarding_current_step: row.onboarding_current_step,
      onboarding_started_at: row.onboarding_started_at,
      email: row.email,
    }));
  } catch (error: any) {
    logger.error("get_abandoned_onboarding_cleaners_failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Send onboarding reminder email
 */
export async function sendOnboardingReminder(
  cleaner: {
    id: string;
    user_id: string;
    first_name: string | null;
    email: string;
    onboarding_current_step: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!env.SENDGRID_API_KEY) {
      logger.warn("sendgrid_not_configured", { cleanerId: cleaner.id });
      return { success: false, error: "SendGrid not configured" };
    }

    const firstName = cleaner.first_name || "there";
    const stepName = getStepDisplayName(cleaner.onboarding_current_step);
    const onboardingUrl = `${env.FRONTEND_URL || "https://app.puretask.com"}/cleaner/onboarding`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your PureTask Onboarding</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Complete Your Onboarding</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi ${firstName},
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                We noticed you started your PureTask cleaner onboarding but haven't completed it yet. You were last at: <strong>${stepName}</strong>.
              </p>
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Complete your onboarding now to start receiving job offers from clients!
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${onboardingUrl}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Continue Onboarding →</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need help, please contact our support team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} PureTask. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const msg = {
      to: cleaner.email,
      from: env.SENDGRID_FROM_EMAIL || "noreply@puretask.com",
      subject: "Complete Your PureTask Onboarding",
      html: emailHtml,
    };

    await sgMail.send(msg);

    // Mark reminder as sent
    await query(
      `UPDATE cleaner_profiles 
       SET onboarding_reminder_sent_at = NOW() 
       WHERE id = $1`,
      [cleaner.id]
    );

    logger.info("onboarding_reminder_sent", {
      cleanerId: cleaner.id,
      email: cleaner.email,
      step: cleaner.onboarding_current_step,
    });

    return { success: true };
  } catch (error: any) {
    logger.error("send_onboarding_reminder_failed", {
      cleanerId: cleaner.id,
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Send reminders to all abandoned cleaners
 */
export async function sendOnboardingReminders(
  hoursThreshold: number = 24
): Promise<{
  success: boolean;
  count: number;
  errors: Array<{ cleanerId: string; error: string }>;
}> {
  try {
    const cleaners = await getAbandonedOnboardingCleaners(hoursThreshold);
    const errors: Array<{ cleanerId: string; error: string }> = [];

    for (const cleaner of cleaners) {
      const result = await sendOnboardingReminder(cleaner);
      if (!result.success) {
        errors.push({
          cleanerId: cleaner.id,
          error: result.error || "Unknown error",
        });
      }
    }

    logger.info("onboarding_reminders_sent", {
      total: cleaners.length,
      successful: cleaners.length - errors.length,
      failed: errors.length,
    });

    return {
      success: true,
      count: cleaners.length - errors.length,
      errors,
    };
  } catch (error: any) {
    logger.error("send_onboarding_reminders_failed", {
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      count: 0,
      errors: [{ cleanerId: "unknown", error: error.message }],
    };
  }
}
