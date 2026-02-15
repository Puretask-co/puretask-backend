// src/lib/logRedaction.ts
// PII and secret redaction for logging

/**
 * Fields that should be redacted from logs
 */
const REDACTED_FIELDS = [
  "password",
  "token",
  "secret",
  "authorization",
  "auth",
  "apikey",
  "api_key",
  "apisecret",
  "api_secret",
  "stripe_secret",
  "jwt_secret",
  "webhook_secret",
  "n8n_secret",
  "sendgrid_key",
  "twilio_token",
  "openai_key",
  "google_secret",
  "facebook_secret",
  "cookie",
  "session",
  "credit_card",
  "card_number",
  "cvv",
  "ssn",
  "social_security",
] as const;

/**
 * Patterns that indicate secrets (e.g., sk_live_*, whsec_*)
 */
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]{24,}/gi,
  /sk_test_[a-zA-Z0-9]{24,}/gi,
  /whsec_[a-zA-Z0-9]{32,}/gi,
  /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/gi,
  /AIza[0-9A-Za-z\-_]{35}/gi,
  /ya29\.[0-9A-Za-z\-_]+/gi,
] as const;

/**
 * Redact a value based on its type
 */
function redactValue(value: unknown): string {
  if (typeof value === "string") {
    // Check for secret patterns
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) {
        return "[REDACTED_SECRET]";
      }
    }
    // If it looks like a token/secret (long alphanumeric string)
    if (value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value)) {
      return "[REDACTED_TOKEN]";
    }
    return value;
  }
  return "[REDACTED]";
}

/**
 * Hash an email address for logging (preserves domain for debugging)
 */
export function hashEmail(email: string): string {
  if (!email || typeof email !== "string") return email;
  const [localPart, domain] = email.split("@");
  if (!domain) return email; // Not a valid email

  // Hash the local part, keep domain
  const hash = Buffer.from(localPart).toString("base64").substring(0, 8);
  return `${hash}@${domain}`;
}

/**
 * Redact sensitive fields from an object recursively
 */
export function redactSensitiveFields<T extends Record<string, any>>(
  obj: T,
  maxDepth: number = 5
): T {
  if (maxDepth <= 0 || !obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === "object" && item !== null ? redactSensitiveFields(item, maxDepth - 1) : item
    ) as unknown as T;
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if field name indicates sensitive data
    const isSensitive = REDACTED_FIELDS.some((field) => lowerKey.includes(field));

    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else if (lowerKey === "email" && typeof value === "string") {
      // Hash email addresses
      redacted[key] = hashEmail(value);
    } else if (lowerKey === "address" && typeof value === "string") {
      // Redact full addresses (keep city/state)
      const parts = value.split(",");
      if (parts.length > 1) {
        redacted[key] = `[REDACTED_ADDRESS], ${parts.slice(1).join(", ")}`;
      } else {
        redacted[key] = "[REDACTED_ADDRESS]";
      }
    } else if (lowerKey === "phone" || lowerKey === "phonenumber") {
      // Redact phone numbers (keep last 4 digits)
      if (typeof value === "string" && value.length > 4) {
        redacted[key] = `***-***-${value.slice(-4)}`;
      } else {
        redacted[key] = "[REDACTED]";
      }
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveFields(value, maxDepth - 1);
    } else if (typeof value === "string") {
      // Check string values for secret patterns
      redacted[key] = redactValue(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted as T;
}

/**
 * Redact headers that may contain sensitive data
 */
export function redactHeaders(headers: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey === "authorization" ||
      lowerKey === "cookie" ||
      lowerKey === "x-api-key" ||
      lowerKey === "x-auth-token"
    ) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Redact request body for logging
 */
export function redactRequestBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body;
  }

  return redactSensitiveFields(body);
}
