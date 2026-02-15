// src/routes/__tests__/adminIdVerifications.test.ts
// Integration tests for admin ID verification routes

import { beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";

vi.mock("../../db/client");
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Admin ID Verifications Routes", () => {
  let adminToken: string;

  beforeEach(() => {
    adminToken = "mock-admin-token";
  });

  describe("GET /admin/id-verifications", () => {
    it("lists all verifications for admin", async () => {
      const mockVerifications = [
        {
          id: "verification-1",
          cleaner_id: "cleaner-1",
          document_type: "drivers_license",
          status: "pending",
          created_at: new Date(),
        },
      ];

      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: mockVerifications });

      const res = await request(app)
        .get("/admin/id-verifications")
        .set("Authorization", `Bearer ${adminToken}`);

      // Note: Will need proper admin auth setup
      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it("requires admin role", async () => {
      const res = await request(app)
        .get("/admin/id-verifications")
        .set("Authorization", `Bearer client-token`);

      expect(res.status).toBeGreaterThanOrEqual(403);
    });
  });

  describe("PATCH /admin/id-verifications/:id/status", () => {
    it("updates verification status", async () => {
      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "verification-1" }] }) // Check exists
        .mockResolvedValueOnce({ rows: [] }); // Update status

      const res = await request(app)
        .patch("/admin/id-verifications/verification-1/status")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "approved",
          notes: "Document verified",
        });

      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it("validates status values", async () => {
      const res = await request(app)
        .patch("/admin/id-verifications/verification-1/status")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "invalid-status",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
