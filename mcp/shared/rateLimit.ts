import { Request, Response, NextFunction } from "express";

type WindowBucket = {
  count: number;
  resetAt: number;
};

const buckets: Record<string, WindowBucket> = {};

export function rateLimit({ limit, windowMs, scope }: { limit: number; windowMs: number; scope: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${scope}:${req.ip || "unknown"}`;
    const now = Date.now();
    const bucket = buckets[key];
    if (!bucket || now > bucket.resetAt) {
      buckets[key] = { count: 1, resetAt: now + windowMs };
      return next();
    }
    if (bucket.count >= limit) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: bucket.resetAt - now });
      return;
    }
    bucket.count += 1;
    next();
  };
}

