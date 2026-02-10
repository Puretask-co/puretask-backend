/**
 * k6 load smoke for gamification + governor endpoints (Step 19)
 * Run: k6 run tests/load/gamification_smoke.js
 * Env: K6_BASE_URL (default http://localhost:4000), REGION_ID (default sf_ca)
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE = __ENV.K6_BASE_URL || "http://localhost:3000";
const API = BASE.includes("/api/v1") ? BASE : `${BASE.replace(/\/$/, "")}/api/v1`;
const REGION_ID = __ENV.REGION_ID || "sf_ca";

export default function () {
  // Governor state (public, no auth)
  const r1 = http.get(`${API}/governor/state?region_id=${REGION_ID}`);
  check(r1, {
    "governor status 200": (r) => r.status === 200,
    "governor has ok": (r) => {
      try {
        const b = JSON.parse(r.body);
        return b.ok === true;
      } catch {
        return false;
      }
    },
  });
  sleep(1);

  // Health (sanity)
  const r2 = http.get(`${BASE}/health`);
  check(r2, { "health 200": (r) => r.status === 200 });
  sleep(0.5);
}
