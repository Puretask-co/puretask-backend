// scripts/analyze-bundle.js
// Bundle size analysis script

const fs = require("fs");
const path = require("path");

/**
 * Analyze bundle sizes
 */
function analyzeBundle() {
  const distPath = path.join(__dirname, "../dist");
  
  if (!fs.existsSync(distPath)) {
    console.log("❌ dist folder not found. Run 'npm run build' first.");
    return;
  }

  const files = getAllFiles(distPath);
  const sizes = files.map((file) => ({
    path: path.relative(distPath, file),
    size: fs.statSync(file).size,
    sizeKB: (fs.statSync(file).size / 1024).toFixed(2),
    sizeMB: (fs.statSync(file).size / (1024 * 1024)).toFixed(2),
  }));

  // Sort by size
  sizes.sort((a, b) => b.size - a.size);

  console.log("\n📦 Bundle Size Analysis\n");
  console.log("=".repeat(80));
  console.log(`${"File".padEnd(50)} ${"Size".padStart(10)} ${"KB".padStart(10)} ${"MB".padStart(10)}`);
  console.log("=".repeat(80));

  let totalSize = 0;
  sizes.forEach((file) => {
    totalSize += file.size;
    console.log(
      `${file.path.padEnd(50)} ${file.size.toString().padStart(10)} ${file.sizeKB.padStart(10)} ${file.sizeMB.padStart(10)}`
    );
  });

  console.log("=".repeat(80));
  console.log(
    `Total: ${totalSize.toString().padStart(10)} ${(totalSize / 1024).toFixed(2).padStart(10)} ${(totalSize / (1024 * 1024)).toFixed(2).padStart(10)}`
  );
  console.log("=".repeat(80));

  // Warn if bundle is too large
  const totalMB = totalSize / (1024 * 1024);
  if (totalMB > 10) {
    console.log("\n⚠️  Warning: Bundle size exceeds 10MB. Consider code splitting.");
  } else if (totalMB > 5) {
    console.log("\n⚠️  Warning: Bundle size exceeds 5MB. Consider optimization.");
  } else {
    console.log("\n✅ Bundle size is reasonable.");
  }
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Run analysis
analyzeBundle();
