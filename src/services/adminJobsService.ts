// src/services/adminJobsService.ts
// Admin jobs service - uses adminService.ts for most functionality

import { query } from "../db/client";
import type { Job } from "../types/db";

/**
 * List all jobs for admin view
 * Note: For more advanced filtering, use adminService.listJobsForAdmin()
 */
export async function listJobsForAdmin(): Promise<Job[]> {
  const result = await query<Job>(
    `
      SELECT *
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 500
    `
  );
  return result.rows;
}
