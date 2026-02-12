// src/lib/sanitization.ts
// Enhanced input sanitization

// Basic HTML sanitization (for server-side, use DOMPurify in production)
function basicSanitizeHtml(html: string): string {
  if (typeof html !== "string") return html;
  
  // Remove all HTML tags
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Sanitize HTML content
 * Strips all HTML tags for security
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== "string") return html;
  return basicSanitizeHtml(html);
}

/**
 * Sanitize plain text (remove HTML, trim, normalize)
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") return text;
  
  return text
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") return email;
  return email.trim().toLowerCase();
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return url;
  
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== "string") return phone;
  // Remove all non-digit characters except + at start
  return phone.replace(/[^\d+]/g, "").replace(/(?<!^)\+/g, "");
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    allowHtml?: boolean;
    allowedFields?: string[];
    maxDepth?: number;
  } = {}
): T {
  const { allowHtml = false, allowedFields, maxDepth = 10 } = options;
  
  if (maxDepth <= 0) return obj;
  
  if (typeof obj !== "object" || obj === null) {
    return typeof obj === "string" 
      ? (allowHtml ? sanitizeHtml(obj) : sanitizeText(obj)) as unknown as T
      : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => 
      sanitizeObject(item, { ...options, maxDepth: maxDepth - 1 })
    ) as unknown as T;
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip if field not allowed
    if (allowedFields && !allowedFields.includes(key)) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = allowHtml ? sanitizeHtml(value) : sanitizeText(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value, { ...options, maxDepth: maxDepth - 1 });
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Sanitize SQL injection patterns
 */
export function sanitizeSql(input: string): string {
  if (typeof input !== "string") return input;
  
  // Remove common SQL injection patterns
  return input
    .replace(/['";\\]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .replace(/;/g, "");
}

/**
 * Validate and sanitize input based on type
 */
export function sanitizeByType(
  value: any,
  type: "text" | "email" | "url" | "phone" | "html" | "sql"
): string {
  if (typeof value !== "string") return value;

  switch (type) {
    case "email":
      return sanitizeEmail(value);
    case "url":
      return sanitizeUrl(value);
    case "phone":
      return sanitizePhone(value);
    case "html":
      return sanitizeHtml(value);
    case "sql":
      return sanitizeSql(value);
    case "text":
    default:
      return sanitizeText(value);
  }
}
