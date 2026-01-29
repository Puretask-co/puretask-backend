// src/lib/ownership.ts
// Ownership check utilities for authorization

import { AppError, ErrorCode } from "./errors";
import { query } from "../db/client";
import { UserRole } from "./auth";

/**
 * Ensure a user owns a resource or has the required role
 */
export async function ensureOwnership(
  resourceType: "job" | "user" | "payout" | "invoice" | "photo",
  resourceId: string,
  userId: string,
  role: UserRole
): Promise<void> {
  // Admins can access everything
  if (role === "admin") {
    return;
  }

  switch (resourceType) {
    case "job": {
      const result = await query<{ client_id: string; cleaner_id: string | null }>(
        `SELECT client_id, cleaner_id FROM jobs WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        throw new AppError(ErrorCode.NOT_FOUND, "Job not found", 404);
      }

      const job = result.rows[0];
      if (role === "client" && job.client_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You do not own this job", 403);
      }
      if (role === "cleaner" && job.cleaner_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You are not assigned to this job", 403);
      }
      break;
    }

    case "user": {
      if (userId !== resourceId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You can only access your own profile", 403);
      }
      break;
    }

    case "payout": {
      const result = await query<{ cleaner_id: string }>(
        `SELECT cleaner_id FROM payouts WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        throw new AppError(ErrorCode.NOT_FOUND, "Payout not found", 404);
      }

      if (role === "cleaner" && result.rows[0].cleaner_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You do not own this payout", 403);
      }
      break;
    }

    case "invoice": {
      const result = await query<{ client_id: string; cleaner_id: string }>(
        `SELECT client_id, cleaner_id FROM invoices WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found", 404);
      }

      const invoice = result.rows[0];
      if (role === "client" && invoice.client_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You do not own this invoice", 403);
      }
      if (role === "cleaner" && invoice.cleaner_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You do not own this invoice", 403);
      }
      break;
    }

    case "photo": {
      const result = await query<{ cleaner_id: string; job_id: string }>(
        `SELECT cleaner_id, job_id FROM job_photos WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        throw new AppError(ErrorCode.NOT_FOUND, "Photo not found", 404);
      }

      const photo = result.rows[0];
      if (role === "cleaner" && photo.cleaner_id !== userId) {
        throw new AppError(ErrorCode.FORBIDDEN, "You do not own this photo", 403);
      }

      // Clients can view photos for their jobs
      if (role === "client") {
        const jobResult = await query<{ client_id: string }>(
          `SELECT client_id FROM jobs WHERE id = $1`,
          [photo.job_id]
        );
        if (jobResult.rows.length === 0 || jobResult.rows[0].client_id !== userId) {
          throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this photo", 403);
        }
      }
      break;
    }
  }
}

/**
 * Check if a user owns a resource (returns boolean, doesn't throw)
 */
export async function checkOwnership(
  resourceType: "job" | "user" | "payout" | "invoice" | "photo",
  resourceId: string,
  userId: string,
  role: UserRole
): Promise<boolean> {
  try {
    await ensureOwnership(resourceType, resourceId, userId, role);
    return true;
  } catch {
    return false;
  }
}
