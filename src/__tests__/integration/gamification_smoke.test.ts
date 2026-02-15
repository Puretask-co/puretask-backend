/**
 * Gamification + Governor API smoke tests (Step 19)
 * Validates core endpoints respond correctly.
 */

import request from "supertest";
import app from "../../index";

const BASE = "/api/v1";

describe("Gamification API smoke", () => {
  describe("Governor state (public)", () => {
    it("GET /governor/state returns ok and state", async () => {
      const res = await request(app)
        .get(`${BASE}/governor/state`)
        .query({ region_id: "__global__" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect("state" in res.body).toBe(true);
      if (res.body.state) {
        expect(res.body.state).toHaveProperty("region_id");
        expect(res.body.state).toHaveProperty("visibility_multiplier");
        expect(["undersupply", "balanced", "oversupply", "quality_risk"]).toContain(
          res.body.state.state
        );
      }
    });

    it("GET /governor/state with region_id query", async () => {
      const res = await request(app).get(`${BASE}/governor/state`).query({ region_id: "sf_ca" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("Protected endpoints return 401 without auth", () => {
    it("GET /cleaner/seasons/active requires auth", async () => {
      const res = await request(app)
        .get(`${BASE}/cleaner/seasons/active`)
        .query({ region_id: "sf_ca" });
      expect([401, 403]).toContain(res.status);
    });

    it("GET /cleaner/next-best-actions requires auth", async () => {
      const res = await request(app)
        .get(`${BASE}/cleaner/next-best-actions`)
        .query({ region_id: "sf_ca", limit: 3 });
      expect([401, 403]).toContain(res.status);
    });

    it("GET /admin/gamification/cleaners/:id/progress-debug requires admin auth", async () => {
      const res = await request(app).get(
        `${BASE}/admin/gamification/cleaners/00000000-0000-0000-0000-000000000001/progress-debug`
      );
      expect([401, 403]).toContain(res.status);
    });
  });
});
