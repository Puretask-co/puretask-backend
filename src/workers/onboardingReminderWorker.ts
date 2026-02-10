// src/workers/onboardingReminderWorker.ts
// Worker to send onboarding reminder emails

import { sendOnboardingReminders } from "../services/onboardingReminderService";
import { logger } from "../lib/logger";
import { env } from "../config/env";

/**
 * Worker function to send onboarding reminders
 * Should be called via cron job every 6 hours
 */
async function runOnboardingReminderWorker() {
  try {
    logger.info("onboarding_reminder_worker_started");

    const result = await sendOnboardingReminders(24); // 24 hour threshold

    logger.info("onboarding_reminder_worker_completed", {
      success: result.success,
      count: result.count,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      logger.warn("onboarding_reminder_worker_errors", {
        errors: result.errors,
      });
    }

    return result;
  } catch (error: any) {
    logger.error("onboarding_reminder_worker_failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runOnboardingReminderWorker()
    .then(() => {
      logger.info("onboarding_reminder_worker_exited_successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("onboarding_reminder_worker_exited_with_error", {
        error: error.message,
      });
      process.exit(1);
    });
}

export { runOnboardingReminderWorker };
