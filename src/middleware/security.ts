// src/middleware/security.ts
// Security middleware and headers

import { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware
 * Adds common security headers to all responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // XSS Protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Remove powered by header
  res.removeHeader("X-Powered-By");
  
  // Content Security Policy (adjust as needed for your frontend)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'"
  );
  
  // Strict Transport Security (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  
  next();
}

/**
 * Sanitize user input to prevent XSS
 * Basic sanitization - for more robust protection use a library like DOMPurify
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return input;
  
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Request ID middleware
 * Adds a unique ID to each request for logging/tracing
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-request-id"] as string || generateRequestId();
  (req as any).requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

