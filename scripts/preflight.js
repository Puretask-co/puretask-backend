// Preflight: GET /health and /health/ready. Usage: PREFLIGHT_URL=https://api.example.com node scripts/preflight.js
const base = process.env.PREFLIGHT_URL || process.argv[2];
if (!base) {
  console.error("Usage: PREFLIGHT_URL=<base-url> node scripts/preflight.js");
  process.exit(1);
}
const baseUrl = base.replace(/\/$/, "");

async function check(path) {
  try {
    const res = await fetch(baseUrl + path, { method: "GET" });
    return { path, ok: res.ok, status: res.status };
  } catch (err) {
    return { path, ok: false, error: err.message };
  }
}

(async () => {
  console.log("Preflight:", baseUrl);
  const [health, ready] = await Promise.all([check("/health"), check("/health/ready")]);
  let failed = false;
  for (const r of [health, ready]) {
    if (r.ok) console.log("  GET", r.path, r.status, "OK");
    else {
      console.log("  GET", r.path, "FAIL", r.status || r.error);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
})();
