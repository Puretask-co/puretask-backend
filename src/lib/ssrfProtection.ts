// src/lib/ssrfProtection.ts
// Section 8: Block SSRF outbound calls - allowlist hostnames, block private IPs

import { URL } from "url";
import { logger } from "./logger";

/**
 * Private/reserved IP ranges and hostnames that must be blocked for SSRF protection.
 * Includes: localhost, loopback, link-local, private (10.x, 172.16-31.x, 192.168.x), 
 * cloud metadata (169.254.169.254), etc.
 */
const BLOCKED_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private class B
  /^192\.168\./,               // Private class C
  /^169\.254\./,               // Link-local / cloud metadata
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-9])\./, // Carrier-grade NAT
  /^224\./,                    // Multicast
  /^240\./,                    // Reserved
  /^localhost$/i,
  /^::1$/,                     // IPv6 loopback
  /^fe80:/i,                   // IPv6 link-local
  /^fc00:/i,                   // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,          // IPv6 ULA
];

/**
 * Allowlist of hostnames that are permitted for outbound HTTP. Empty = allow all public.
 * Set via env OUTBOUND_ALLOWED_HOSTS=api.stripe.com,api.sendgrid.com,n8n.cloud
 */
function getAllowedHosts(): string[] {
  const env = process.env.OUTBOUND_ALLOWED_HOSTS;
  if (!env) return [];
  return env.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/**
 * Resolve hostname to IP and check if it's in a blocked range.
 * For hostnames, we check common metadata/local hostnames.
 */
function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "metadata" || lower === "metadata.google.internal") {
    return true;
  }
  if (lower.endsWith(".local") || lower.endsWith(".internal")) {
    return true;
  }
  return false;
}

/**
 * Check if an IP address is in a blocked range.
 */
function isBlockedIp(ip: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(ip)) return true;
  }
  return false;
}

/**
 * Validate URL for SSRF before making outbound request.
 * Throws if URL is unsafe. Call this before http.request/fetch.
 */
export function validateOutboundUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("SSRF: Invalid URL");
  }

  const allowedHosts = getAllowedHosts();
  const hostname = parsed.hostname.toLowerCase();

  // If allowlist is set, host must be in it
  if (allowedHosts.length > 0) {
    const allowed = allowedHosts.some(
      (h) => hostname === h || hostname.endsWith("." + h)
    );
    if (!allowed) {
      logger.warn("ssrf_blocked_host_not_allowed", { hostname, url: urlStr });
      throw new Error("SSRF: Host not in allowlist");
    }
  }

  // Block known dangerous hostnames
  if (isBlockedHostname(hostname)) {
    logger.warn("ssrf_blocked_hostname", { hostname, url: urlStr });
    throw new Error("SSRF: Blocked hostname");
  }

  // Block IP literals in private ranges
  const isIpv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isIpv6 = hostname.includes(":");
  if (isIpv4 || isIpv6) {
    if (isBlockedIp(hostname)) {
      logger.warn("ssrf_blocked_ip", { hostname, url: urlStr });
      throw new Error("SSRF: Blocked IP range");
    }
  }

  // Only allow http/https
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("SSRF: Only HTTP/HTTPS allowed");
  }
}
