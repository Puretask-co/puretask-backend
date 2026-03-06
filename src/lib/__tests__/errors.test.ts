// src/lib/__tests__/errors.test.ts
// Unit tests for src/lib/errors.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { Response } from "express";
import {
  ErrorCode,
  AppError,
  Errors,
  sendError,
  asyncHandler,
} from "../errors";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// =====================================================================
// Helpers
// =====================================================================

function makeRes(extras: Record<string, unknown> = {}) {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {},
    ...extras,
  } as unknown as Response;
}

function jsonBody(res: Response) {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

// =====================================================================
// AppError
// =====================================================================

describe("AppError", () => {
  it("extends Error", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "not found", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("sets name to AppError", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "not found");
    expect(err.name).toBe("AppError");
  });

  it("stores code, message, statusCode, and details", () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, "bad input", 400, { field: "email" });
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.message).toBe("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: "email" });
  });

  it("defaults statusCode to 500", () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, "oops");
    expect(err.statusCode).toBe(500);
  });

  it("toJSON includes code and message", () => {
    const err = new AppError(ErrorCode.FORBIDDEN, "no access", 403);
    expect(err.toJSON()).toEqual({
      error: { code: ErrorCode.FORBIDDEN, message: "no access" },
    });
  });

  it("toJSON includes details when present", () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, "invalid", 400, ["field required"]);
    expect(err.toJSON().error.details).toEqual(["field required"]);
  });

  it("toJSON omits details when undefined", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "missing", 404);
    expect(err.toJSON().error).not.toHaveProperty("details");
  });

  it("toJSON omits details when null", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "missing", 404, null);
    expect(err.toJSON().error).not.toHaveProperty("details");
  });
});

// =====================================================================
// Errors factory
// =====================================================================

describe("Errors.unauthenticated", () => {
  it("returns 401 AppError with UNAUTHENTICATED code", () => {
    const err = Errors.unauthenticated();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
  });

  it("uses default message", () => {
    expect(Errors.unauthenticated().message).toBe("Authentication required");
  });

  it("accepts custom message", () => {
    expect(Errors.unauthenticated("please log in").message).toBe("please log in");
  });
});

describe("Errors.forbidden", () => {
  it("returns 403 AppError with FORBIDDEN code", () => {
    const err = Errors.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
  });

  it("accepts custom message", () => {
    expect(Errors.forbidden("admins only").message).toBe("admins only");
  });
});

describe("Errors.notFound", () => {
  it("returns 404 AppError with NOT_FOUND code", () => {
    const err = Errors.notFound();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("uses default resource name", () => {
    expect(Errors.notFound().message).toBe("Resource not found");
  });

  it("uses custom resource name without id", () => {
    expect(Errors.notFound("User").message).toBe("User not found");
  });

  it("includes id in message when provided", () => {
    expect(Errors.notFound("Job", "abc-123").message).toBe("Job with ID abc-123 not found");
  });
});

describe("Errors.validation", () => {
  it("returns 400 AppError with VALIDATION_ERROR code", () => {
    const err = Errors.validation("invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("attaches details when provided", () => {
    const err = Errors.validation("bad", { field: "email" });
    expect(err.details).toEqual({ field: "email" });
  });
});

describe("Errors.conflict", () => {
  it("returns 409 AppError with CONFLICT code", () => {
    const err = Errors.conflict("already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(ErrorCode.CONFLICT);
    expect(err.message).toBe("already exists");
  });
});

describe("Errors.invalidState", () => {
  it("returns 400 AppError with INVALID_STATE code", () => {
    const err = Errors.invalidState("wrong state");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.INVALID_STATE);
  });
});

describe("Errors.insufficientCredits", () => {
  it("returns 402 AppError with INSUFFICIENT_CREDITS code", () => {
    const err = Errors.insufficientCredits(100, 50);
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe(ErrorCode.INSUFFICIENT_CREDITS);
  });

  it("includes required and available in message", () => {
    const err = Errors.insufficientCredits(100, 50);
    expect(err.message).toContain("100");
    expect(err.message).toContain("50");
  });
});

describe("Errors.internal", () => {
  it("returns 500 AppError with INTERNAL_ERROR code", () => {
    const err = Errors.internal();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("uses default message", () => {
    expect(Errors.internal().message).toBe("Internal server error");
  });
});

describe("Errors.database", () => {
  it("returns 500 AppError with DATABASE_ERROR code", () => {
    const err = Errors.database();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe(ErrorCode.DATABASE_ERROR);
  });

  it("uses default message", () => {
    expect(Errors.database().message).toBe("Database operation failed");
  });
});

// =====================================================================
// sendError
// =====================================================================

describe("sendError", () => {
  describe("AppError", () => {
    it("responds with AppError statusCode and JSON body", () => {
      const res = makeRes();
      sendError(res, new AppError(ErrorCode.NOT_FOUND, "not found", 404));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(jsonBody(res).error.code).toBe(ErrorCode.NOT_FOUND);
      expect(jsonBody(res).error.message).toBe("not found");
    });

    it("includes details from AppError", () => {
      const res = makeRes();
      sendError(res, new AppError(ErrorCode.VALIDATION_ERROR, "bad", 400, { x: 1 }));
      expect(jsonBody(res).error.details).toEqual({ x: 1 });
    });

    it("includes requestId from res.locals", () => {
      const res = makeRes();
      res.locals.requestId = "req-123";
      sendError(res, Errors.notFound());
      expect(jsonBody(res).error.requestId).toBe("req-123");
    });

    it("includes requestId from context argument", () => {
      const res = makeRes();
      sendError(res, Errors.notFound(), { requestId: "ctx-456" });
      expect(jsonBody(res).error.requestId).toBe("ctx-456");
    });
  });

  describe("ZodError", () => {
    it("responds with 400 VALIDATION_ERROR", () => {
      const res = makeRes();
      const zodErr = z.object({ name: z.string() }).safeParse({ name: 123 });
      sendError(res, (zodErr as any).error);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonBody(res).error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("includes zod issues in details", () => {
      const res = makeRes();
      const zodErr = z.object({ age: z.number() }).safeParse({ age: "bad" });
      sendError(res, (zodErr as any).error);
      expect(Array.isArray(jsonBody(res).error.details)).toBe(true);
    });
  });

  describe("generic Error", () => {
    it("responds with 500 for plain Error", () => {
      const res = makeRes();
      sendError(res, new Error("something broke"));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(jsonBody(res).error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it("uses statusCode from error object when present", () => {
      const res = makeRes();
      const err = Object.assign(new Error("not found"), { statusCode: 404, code: "NOT_FOUND" });
      sendError(res, err);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(jsonBody(res).error.code).toBe("NOT_FOUND");
    });
  });

  describe("unknown error", () => {
    it("responds with 500 for non-Error values", () => {
      const res = makeRes();
      sendError(res, "something weird");
      expect(res.status).toHaveBeenCalledWith(500);
      expect(jsonBody(res).error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(jsonBody(res).error.message).toBe("An unexpected error occurred");
    });

    it("handles null thrown values", () => {
      const res = makeRes();
      sendError(res, null);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

// =====================================================================
// asyncHandler
// =====================================================================

describe("asyncHandler", () => {
  it("calls the handler and resolves normally", async () => {
    const res = makeRes();
    const fn = vi.fn().mockResolvedValue(undefined);
    const req = { path: "/test", method: "GET", user: { id: "u1" } };
    const next = vi.fn();

    await asyncHandler(fn)(req as any, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls sendError when handler rejects with AppError", async () => {
    const res = makeRes();
    const err = Errors.notFound("Job", "123");
    const fn = vi.fn().mockRejectedValue(err);
    const req = { path: "/jobs/123", method: "GET", user: { id: "u1" } };

    await asyncHandler(fn)(req as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(jsonBody(res).error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("calls sendError when handler rejects with generic Error", async () => {
    const res = makeRes();
    const fn = vi.fn().mockRejectedValue(new Error("unexpected"));
    const req = { path: "/test", method: "POST", user: undefined };

    await asyncHandler(fn)(req as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
