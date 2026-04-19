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
const SKIP_DIRECTORIES = new Set([
  // Reference-only SQL snapshots; not part of canonical migration execution.
  "archive",
  "bundle_reference",
]);

const ERRORS = [];
const WARNINGS = [];
const USER_FK_COLUMNS = [
  "user_id",
  "cleaner_id",
  "client_id",
  "reviewer_id",
  "reviewee_id",
  "approved_by",
  "changed_by",
  "actor_id",
  "reviewed_by",
  "created_by",
  "updated_by",
  "actor_admin_user_id",
  "decided_by",
];

function extractTableColumnTypes(content) {
  const tableColumnTypes = new Map();
  const createTableRegex =
    /CREATE TABLE IF NOT EXISTS\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\);\s*/gi;

  let createTableMatch;
  while ((createTableMatch = createTableRegex.exec(content)) !== null) {
    const table = createTableMatch[1].toLowerCase();
    const body = createTableMatch[2];
    const columnTypes = new Map();

    for (const line of body.split("\n")) {
      const decl = line.match(
        /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+(uuid|text|citext)\b/i
      );
      if (!decl) continue;
      columnTypes.set(decl[1].toLowerCase(), decl[2].toLowerCase());
    }

    tableColumnTypes.set(table, columnTypes);
  }

  return tableColumnTypes;
}

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

  // Check inline UUID FK definitions to users(id)
  lines.forEach((line, i) => {
    if (!/REFERENCES\s+users\s*\(\s*id\s*\)/i.test(line)) return;
    const m = line.match(
      new RegExp(`(${USER_FK_COLUMNS.join("|")})\\s+UUID\\b`, "gi")
    );
    if (m) {
      ERRORS.push(
        `${rel}:${i + 1}: "${m[0].trim().split(/\s+/)[0]}" uses UUID but users.id is TEXT. Use TEXT for FK to users(id).`
      );
    }
  });

  // Check multi-line ALTER TABLE ... FOREIGN KEY (...) REFERENCES users(id) definitions.
  const tableColumnTypes = extractTableColumnTypes(content);
  const alterTableRegex = /ALTER TABLE[\s\S]*?;\s*/gi;
  let alterMatch;
  while ((alterMatch = alterTableRegex.exec(content)) !== null) {
    const stmt = alterMatch[0];
    if (!/REFERENCES\s+(?:public\.)?users\s*\(\s*id\s*\)/i.test(stmt)) continue;

    const tableMatch = stmt.match(
      /ALTER TABLE\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i
    );
    const fkMatch = stmt.match(
      /FOREIGN KEY\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*REFERENCES\s+(?:public\.)?users\s*\(\s*id\s*\)/i
    );
    if (!tableMatch || !fkMatch) continue;

    const table = tableMatch[1].toLowerCase();
    const column = fkMatch[1].toLowerCase();
    const declaredType = tableColumnTypes.get(table)?.get(column);
    if (declaredType !== "uuid") continue;

    const lineNumber = content.slice(0, alterMatch.index).split("\n").length;
    ERRORS.push(
      `${rel}:${lineNumber}: "${column}" uses UUID but users.id is TEXT. Use TEXT for FK to users(id).`
    );
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  if (SKIP_DIRECTORIES.has(path.basename(dir))) return;
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
