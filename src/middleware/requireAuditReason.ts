// src/middleware/requireAuditReason.ts
// Section 11: Require audit reason for sensitive admin actions

import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const auditReasonSchema = z.object({
  auditReason: z.string().min(1).max(500).optional(),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * Middleware: Require audit reason in body or X-Audit-Reason header for sensitive admin actions.
 * Use on admin routes that modify financial data, user status, or dispute outcomes.
 */
export function requireAuditReason(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const headerReason = req.headers["x-audit-reason"] as string | undefined;
  const bodyCheck = auditReasonSchema.safeParse({
    auditReason: req.body?.auditReason,
    reason: req.body?.reason,
  });

  const reason =
    headerReason?.trim() ||
    (bodyCheck.success && (bodyCheck.data.auditReason || bodyCheck.data.reason));

  if (!reason || typeof reason !== "string" || reason.length < 3) {
    const requestId = (res as any).requestId ?? (res.locals as any)?.requestId;
    res.status(400).json({
      error: {
        code: "AUDIT_REASON_REQUIRED",
        message:
          "Sensitive action requires audit reason (X-Audit-Reason header or body.auditReason, min 3 chars).",
        ...(requestId ? { requestId } : {}),
      },
    });
    return;
  }

  (req as any).auditReason = reason;
  next();
}
