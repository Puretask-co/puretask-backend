/**
 * Copy gamification contract JSON files to dist so they are available at runtime
 * when using STRICT_EVENT_CONTRACT or loading contracts from __dirname.
 * Run after tsc (e.g. in build script).
 */
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src", "config", "cleanerLevels", "contracts");
const destDir = path.join(__dirname, "..", "dist", "config", "cleanerLevels", "contracts");

if (!fs.existsSync(srcDir)) {
  console.warn("copy-contracts: src dir not found, skipping:", srcDir);
  process.exit(0);
}

if (!fs.existsSync(path.join(__dirname, "..", "dist"))) {
  console.warn("copy-contracts: dist not found (run tsc first), skipping");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  fs.copyFileSync(src, dest);
}
console.log("copy-contracts: copied", files.length, "file(s) to dist/config/cleanerLevels/contracts/");
