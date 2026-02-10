#!/usr/bin/env node
/**
 * Validate migration files for common issues:
 * - FK to users(id) must use TEXT (canonical), not UUID
 * - No explicit BEGIN; / COMMIT; (causes rollback issues in Neon SQL Editor)
 *
 * Usage: node scripts/validate-migrations.js
 * Exits 1 if validation fails.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "DB", "migrations");

const ERRORS = [];
const WARNINGS = [];

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // Check for BEGIN; / COMMIT;
  if (/\bBEGIN\s*;/.test(content)) {
    ERRORS.push(`${rel}: Contains BEGIN; (remove to avoid rollback issues in Neon)`);
  }
  if (/\bCOMMIT\s*;/.test(content)) {
    ERRORS.push(`${rel}: Contains COMMIT; (remove to avoid rollback issues in Neon)`);
  }

  // Check for column UUID REFERENCES users(id) on the SAME line (avoid false positives)
  lines.forEach((line, i) => {
    if (!/REFERENCES\s+users\s*\(\s*id\s*\)/i.test(line)) return;
    const m = line.match(
      /(user_id|cleaner_id|created_by|updated_by|actor_admin_user_id|decided_by|changed_by|actor_id)\s+UUID\b/gi
    );
    if (m) {
      ERRORS.push(
        `${rel}:${i + 1}: "${m[0].trim().split(/\s+/)[0]}" uses UUID but users.id is TEXT. Use TEXT for FK to users(id).`
      );
    }
  });
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanDir(full);
    } else if (e.name.endsWith(".sql")) {
      scanFile(full);
    }
  }
}

function main() {
  console.log("🔍 Validating migrations...\n");
  scanDir(MIGRATIONS_DIR);

  if (WARNINGS.length) {
    WARNINGS.forEach((w) => console.warn("⚠️ ", w));
    console.log("");
  }

  if (ERRORS.length) {
    ERRORS.forEach((e) => console.error("❌", e));
    console.error("\n❌ Migration validation failed. Fix the issues above.");
    process.exit(1);
  }

  console.log("✅ All migrations passed validation.\n");
  process.exit(0);
}

main();
