// src/__tests__/integration/api/protected-route-auth.test.ts
// Phase 2: Auth smoke tests — protected route returns 401 without token, 200 with valid token

import request from "supertest";
import express, { Request, Response } from "express";
import { requireAuth, AuthedRequest } from "../../../middleware/authCanonical";
import * as authLib from "../../../lib/auth";

jest.mock("../../../lib/auth");
jest.mock("../../../lib/logger", () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

const app = express();
app.use(express.json());

// Minimal protected route (mirrors real usage)
app.get("/protected", requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  res.status(200).json({ ok: true, userId: user.id, role: user.role });
});

describe("Protected route auth (Phase 2 smoke)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe("UNAUTHENTICATED");
    expect(res.body?.error?.message).toMatch(/authorization/i);
  });

  it("returns 401 when Authorization is not Bearer", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Basic xyz");
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 when token is invalid or expired", async () => {
    (authLib.verifyAuthToken as jest.Mock).mockRejectedValue(new Error("invalid"));
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
    expect(res.body?.error?.code).toBe("INVALID_TOKEN");
  });

  it("returns 200 and user when token is valid", async () => {
    const mockUser = { id: "user-1", role: "client" as const, email: null };
    (authLib.verifyAuthToken as jest.Mock).mockResolvedValue(mockUser);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.userId).toBe("user-1");
    expect(res.body?.role).toBe("client");
  });
});
