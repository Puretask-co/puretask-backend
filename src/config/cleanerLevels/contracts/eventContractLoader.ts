/**
 * Loads event_contract_v1.json and exposes allowed event types + optional validation.
 * Use for new data switch: ensure only contract-compliant events are ingested.
 * See docs/active/BUNDLE_SWITCH_GAP_ANALYSIS.md and gamification_bundle/docs/event_contract_v1.md.
 */

import path from "path";
import fs from "fs";

export interface EventContractEvent {
  event_type: string;
  title?: string;
  description?: string;
  required_fields?: Record<string, string>;
  optional_fields?: Record<string, string>;
  produces_metrics?: string[];
}

export interface EventContract {
  version: string;
  generated_at?: string;
  common_required_fields?: Record<string, string>;
  events: EventContractEvent[];
}

let _contract: EventContract | null = null;

function loadContract(): EventContract {
  if (_contract) return _contract;
  const candidates = [
    path.join(__dirname, "event_contract_v1.json"),
    path.join(process.cwd(), "src", "config", "cleanerLevels", "contracts", "event_contract_v1.json"),
    path.join(process.cwd(), "dist", "config", "cleanerLevels", "contracts", "event_contract_v1.json"),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        _contract = JSON.parse(raw) as EventContract;
        return _contract;
      }
    } catch {
      continue;
    }
  }
  throw new Error(
    "event_contract_v1.json not found. Tried: " + candidates.join("; ")
  );
}

/**
 * Returns all event_type strings from the contract (allowed event types).
 */
export function getAllowedEventTypes(): string[] {
  const c = loadContract();
  return c.events.map((e) => e.event_type);
}

/**
 * Returns true if event_type is in the contract.
 */
export function isAllowedEventType(event_type: string): boolean {
  const allowed = getAllowedEventTypes();
  return allowed.includes(event_type);
}

/**
 * Basic validation: event_type must be in contract; source must be valid if provided.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * Use optionally before recordEvent to enforce contract for new data.
 */
export function validateEventForContract(evt: {
  event_type: string;
  source?: string;
  occurred_at?: unknown;
}): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!evt.event_type || typeof evt.event_type !== "string") {
    errors.push("event_type is required and must be a string");
    return { valid: false, errors };
  }
  if (!isAllowedEventType(evt.event_type)) {
    errors.push(`event_type "${evt.event_type}" is not in the event contract (allowed: ${getAllowedEventTypes().join(", ")})`);
    return { valid: false, errors };
  }
  const validSources = ["mobile", "web", "server", "admin", "system"];
  if (evt.source != null && !validSources.includes(evt.source)) {
    errors.push(`source must be one of: ${validSources.join(", ")}`);
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
