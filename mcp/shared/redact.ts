const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /\b(?:\+?\d[\d\s\-.()]{7,}\d)\b/g;
const JWT_REGEX = /\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g;

export function redactSensitive(input: string): string {
  return input
    .replace(EMAIL_REGEX, "[redacted-email]")
    .replace(PHONE_REGEX, "[redacted-phone]")
    .replace(JWT_REGEX, "[redacted-token]");
}

