// src/routes/uploads.ts
// Signed PUT URL for S3/R2 job photo uploads (client uploads directly to bucket).

import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { requireAuth, type AuthedRequest } from "../middleware/authCanonical";
import { ensureOwnership } from "../lib/ownership";
import { buildJobPhotoKey, signPutObject } from "../lib/storage";
import { sendSuccess } from "../lib/response";
import { asyncHandler } from "../lib/errors";

const router = Router();

const SignSchema = z.object({
  jobId: z.string().min(1),
  kind: z.enum(["before", "after", "client_dispute"]),
  contentType: z.string().min(3),
  fileName: z.string().min(1),
  bytes: z.number().int().positive(),
});

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_PREFIX = "image/";

router.post(
  "/sign",
  requireAuth,
  validateBody(SignSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = req.body as z.infer<typeof SignSchema>;

    await ensureOwnership("job", parsed.jobId, req.user!.id, req.user!.role);

    if (!parsed.contentType.startsWith(ALLOWED_IMAGE_PREFIX)) {
      return res.status(400).json({ error: "Only image uploads allowed." });
    }
    if (parsed.bytes > MAX_BYTES) {
      return res.status(400).json({ error: "File too large (max 15MB)." });
    }

    let key: string;
    let putUrl: string;
    let publicUrl: string | undefined;
    try {
      key = buildJobPhotoKey({
        jobId: parsed.jobId,
        kind: parsed.kind,
        originalFileName: parsed.fileName,
      });
      const result = await signPutObject({
        key,
        contentType: parsed.contentType,
        expiresInSeconds: 10 * 60,
      });
      putUrl = result.putUrl;
      publicUrl = result.publicUrl;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.startsWith("Missing env:")) {
        return res.status(503).json({
          error: "Storage not configured",
          code: "STORAGE_NOT_CONFIGURED",
          message: "Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY (and optionally STORAGE_ENDPOINT for R2) in the environment.",
        });
      }
      throw err;
    }

    sendSuccess(res, { putUrl, key, publicUrl });
  })
);

export default router;
