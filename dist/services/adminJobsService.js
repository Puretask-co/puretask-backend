"use strict";
// src/services/adminJobsService.ts
// Admin jobs service - uses adminService.ts for most functionality
Object.defineProperty(exports, "__esModule", { value: true });
exports.listJobsForAdmin = listJobsForAdmin;
const client_1 = require("../db/client");
/**
 * List all jobs for admin view
 * Note: For more advanced filtering, use adminService.listJobsForAdmin()
 */
async function listJobsForAdmin() {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 500
    `);
    return result.rows;
}
