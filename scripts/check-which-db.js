#!/usr/bin/env node
/**
 * Show which database DATABASE_URL points at (redacted — no passwords).
 * Run from repo root: node scripts/check-which-db.js
 * Use this to confirm you're on test vs real DB before/after switching.
 */
require("dotenv").config();

function redactUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.replace(/^postgres:\/\//, "https://"));
    const db = u.pathname ? u.pathname.replace(/^\//, "") : "";
    const host = u.hostname || "(unknown)";
    const port = u.port || "5432";
    return { host, port, database: db || "(default)", hasSsl: url.includes("sslmode=") };
  } catch {
    return { host: "(parse error)", port: "", database: "", hasSsl: false };
  }
}

function main() {
  const url = process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL;

  console.log("Current app database (DATABASE_URL):");
  if (!url || url.trim() === "") {
    console.log("  Not set.\n");
  } else {
    const r = redactUrl(url);
    console.log("  Host:     ", r.host);
    console.log("  Port:     ", r.port);
    console.log("  Database: ", r.database);
    console.log("  SSL:      ", r.hasSsl ? "yes" : "no (add ?sslmode=require for Neon)");
    console.log("");
  }

  console.log("Test DB (TEST_DATABASE_URL, used only by npm test):");
  if (!testUrl || testUrl.trim() === "") {
    console.log("  Not set. Tests use DATABASE_URL.\n");
  } else {
    const r = redactUrl(testUrl);
    console.log("  Host:     ", r.host);
    console.log("  Database: ", r.database);
    console.log("");
  }

  console.log("To switch the app to the real DB: set DATABASE_URL in .env to the real Postgres URL and restart the server.");
  console.log("To transfer data test → real: see docs/active/SETUP.md § Transfer data from test DB to real DB.");
}

main();
