// src/lib/__tests__/response.test.ts
// Unit tests for src/lib/response.ts and src/lib/urlBuilder.ts

import { describe, it, expect, vi } from "vitest";
import { Response } from "express";
import { sendSuccess, sendPaginatedSuccess, sendCreated, sendNoContent } from "../response";

vi.mock("../../config/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    JWT_SECRET: "test-secret",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    N8N_WEBHOOK_SECRET: "n8n_x",
    APP_URL: "https://app.puretask.com",
    NODE_ENV: "test",
    JWT_EXPIRES_IN: "30d",
    BCRYPT_SALT_ROUNDS: 10,
    BOOKINGS_ENABLED: true,
    PAYOUTS_ENABLED: false,
    CREDITS_ENABLED: true,
    REFUNDS_ENABLED: true,
    WORKERS_ENABLED: true,
    USE_EVENT_BASED_NOTIFICATIONS: false,
  },
}));

// =====================================================================
// Helpers
// =====================================================================

function makeRes(extras: Record<string, unknown> = {}) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    location: vi.fn().mockReturnThis(),
    locals: {},
    ...extras,
  } as unknown as Response;
  return res;
}

function jsonBody(res: Response) {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

// =====================================================================
// sendSuccess
// =====================================================================

describe("sendSuccess", () => {
  it("sends json with data wrapped in a data key", () => {
    const res = makeRes();
    sendSuccess(res, { id: "123", name: "Alice" });
    expect(jsonBody(res)).toEqual({ data: { id: "123", name: "Alice" } });
  });

  it("includes meta when provided", () => {
    const res = makeRes();
    sendSuccess(res, [1, 2, 3], { count: 3 });
    expect(jsonBody(res).meta).toEqual({ count: 3 });
  });

  it("omits meta when not provided", () => {
    const res = makeRes();
    sendSuccess(res, { ok: true });
    expect(jsonBody(res)).not.toHaveProperty("meta");
  });

  it("includes requestId from res.locals", () => {
    const res = makeRes();
    res.locals.requestId = "req-abc";
    sendSuccess(res, {});
    expect(jsonBody(res).requestId).toBe("req-abc");
  });

  it("includes requestId from res.requestId", () => {
    const res = makeRes({ requestId: "req-xyz" });
    sendSuccess(res, {});
    expect(jsonBody(res).requestId).toBe("req-xyz");
  });

  it("omits requestId when not present", () => {
    const res = makeRes();
    sendSuccess(res, {});
    expect(jsonBody(res)).not.toHaveProperty("requestId");
  });

  it("handles array data", () => {
    const res = makeRes();
    sendSuccess(res, ["a", "b", "c"]);
    expect(jsonBody(res).data).toEqual(["a", "b", "c"]);
  });

  it("handles null data", () => {
    const res = makeRes();
    sendSuccess(res, null);
    expect(jsonBody(res).data).toBeNull();
  });
});

// =====================================================================
// sendPaginatedSuccess
// =====================================================================

describe("sendPaginatedSuccess", () => {
  it("sends data and pagination fields", () => {
    const res = makeRes();
    sendPaginatedSuccess(res, ["a", "b"], 10, 2, 0);
    const body = jsonBody(res);
    expect(body.data).toEqual(["a", "b"]);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.offset).toBe(0);
    expect(body.pagination.total).toBe(10);
  });

  it("sets hasMore true when more items remain", () => {
    const res = makeRes();
    sendPaginatedSuccess(res, ["a", "b"], 10, 2, 0);
    expect(jsonBody(res).pagination.hasMore).toBe(true); // 0 + 2 < 10
  });

  it("sets hasMore false on last page", () => {
    const res = makeRes();
    sendPaginatedSuccess(res, ["i", "j"], 10, 2, 8);
    expect(jsonBody(res).pagination.hasMore).toBe(false); // 8 + 2 = 10
  });

  it("includes requestId from res.locals", () => {
    const res = makeRes();
    res.locals.requestId = "req-page";
    sendPaginatedSuccess(res, [], 0, 10, 0);
    expect(jsonBody(res).requestId).toBe("req-page");
  });

  it("omits requestId when not present", () => {
    const res = makeRes();
    sendPaginatedSuccess(res, [], 0, 10, 0);
    expect(jsonBody(res)).not.toHaveProperty("requestId");
  });
});

// =====================================================================
// sendCreated
// =====================================================================

describe("sendCreated", () => {
  it("responds with 201 status", () => {
    const res = makeRes();
    sendCreated(res, { id: "new-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("sends data in response body", () => {
    const res = makeRes();
    sendCreated(res, { id: "new-1" });
    expect(jsonBody(res).data).toEqual({ id: "new-1" });
  });

  it("sets Location header when provided", () => {
    const res = makeRes();
    sendCreated(res, { id: "new-1" }, "/jobs/new-1");
    expect(res.location).toHaveBeenCalledWith("/jobs/new-1");
  });

  it("does not set Location header when not provided", () => {
    const res = makeRes();
    sendCreated(res, { id: "new-1" });
    expect(res.location).not.toHaveBeenCalled();
  });

  it("includes requestId from res.locals", () => {
    const res = makeRes();
    res.locals.requestId = "req-create";
    sendCreated(res, {});
    expect(jsonBody(res).requestId).toBe("req-create");
  });

  it("omits requestId when not present", () => {
    const res = makeRes();
    sendCreated(res, {});
    expect(jsonBody(res)).not.toHaveProperty("requestId");
  });
});

// =====================================================================
// sendNoContent
// =====================================================================

describe("sendNoContent", () => {
  it("responds with 204 status", () => {
    const res = makeRes();
    sendNoContent(res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("calls send with no body", () => {
    const res = makeRes();
    sendNoContent(res);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });
});

// =====================================================================
// urlBuilder (imported here to share the env mock)
// =====================================================================

import {
  buildClientJobUrl,
  buildCleanerJobUrl,
  buildJobUrl,
  buildCheckInUrl,
  buildPaymentUrl,
  buildSubscriptionUrl,
  buildSupportUrl,
  buildPasswordResetUrl,
  buildRoleCorrectJobUrl,
} from "../urlBuilder";

const BASE = "https://app.puretask.com";

describe("buildClientJobUrl", () => {
  it("builds correct client job URL", () => {
    expect(buildClientJobUrl("job-123")).toBe(`${BASE}/client/jobs/job-123`);
  });
});

describe("buildCleanerJobUrl", () => {
  it("builds correct cleaner job URL", () => {
    expect(buildCleanerJobUrl("job-456")).toBe(`${BASE}/cleaner/jobs/job-456`);
  });
});

describe("buildJobUrl", () => {
  it("builds generic job URL", () => {
    expect(buildJobUrl("job-789")).toBe(`${BASE}/jobs/job-789`);
  });
});

describe("buildCheckInUrl", () => {
  it("builds correct check-in URL", () => {
    expect(buildCheckInUrl("job-abc")).toBe(`${BASE}/cleaner/jobs/job-abc/check-in`);
  });
});

describe("buildPaymentUrl", () => {
  it("returns base billing URL with no returnTo", () => {
    expect(buildPaymentUrl()).toBe(`${BASE}/client/billing`);
  });

  it("appends encoded returnTo param when provided", () => {
    const url = buildPaymentUrl("/client/jobs/123");
    expect(url).toBe(`${BASE}/client/billing?returnTo=%2Fclient%2Fjobs%2F123`);
  });

  it("encodes special characters in returnTo", () => {
    const url = buildPaymentUrl("/path?foo=bar&baz=qux");
    expect(url).toContain("returnTo=");
    expect(url).not.toContain("&baz"); // should be encoded
  });
});

describe("buildSubscriptionUrl", () => {
  it("builds correct subscription URL", () => {
    expect(buildSubscriptionUrl()).toBe(`${BASE}/client/subscription`);
  });
});

describe("buildSupportUrl", () => {
  it("builds correct support URL", () => {
    expect(buildSupportUrl()).toBe(`${BASE}/support`);
  });
});

describe("buildPasswordResetUrl", () => {
  it("builds URL with encoded token", () => {
    expect(buildPasswordResetUrl("abc123")).toBe(`${BASE}/auth/reset-password?token=abc123`);
  });

  it("encodes special characters in token", () => {
    const url = buildPasswordResetUrl("tok+en/val=ue");
    expect(url).toContain("token=tok%2Ben%2Fval%3Due");
  });
});

describe("buildRoleCorrectJobUrl", () => {
  it("returns client URL for client role", () => {
    expect(buildRoleCorrectJobUrl("job-1", "client")).toBe(`${BASE}/client/jobs/job-1`);
  });

  it("returns cleaner URL for cleaner role", () => {
    expect(buildRoleCorrectJobUrl("job-1", "cleaner")).toBe(`${BASE}/cleaner/jobs/job-1`);
  });

  it("returns client URL for admin role", () => {
    expect(buildRoleCorrectJobUrl("job-1", "admin")).toBe(`${BASE}/client/jobs/job-1`);
  });
});
