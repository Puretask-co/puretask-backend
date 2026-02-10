// Secret scanning script for CI/local use
// Scans codebase for potential secrets

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Secret patterns
const PATTERNS = [
  { name: 'Stripe Live Key', pattern: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'Stripe Test Key', pattern: /sk_test_[a-zA-Z0-9]{24,}/g },
  { name: 'Stripe Webhook Secret', pattern: /whsec_[a-zA-Z0-9]{32,}/g },
  { name: 'SendGrid API Key', pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g },
  { name: 'Twilio Account SID', pattern: /AC[a-z0-9]{32}/g },
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{32,}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '.cache',
  'package-lock.json',
  '.env.example',
  'docs/archive',
];

// Allowed patterns (false positives)
const ALLOWED_PATTERNS = [
  /YOUR_/,
  /REPLACE/,
  /example/,
  /placeholder/,
  /test_/,
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isAllowed(match) {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(match));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  PATTERNS.forEach(({ name, pattern }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!isAllowed(match)) {
          const lines = content.split('\n');
          const lineIndex = content.substring(0, content.indexOf(match)).split('\n').length;
          issues.push({
            type: name,
            match: match.substring(0, 20) + '...',
            file: filePath,
            line: lineIndex,
            context: lines[lineIndex - 1]?.trim() || '',
          });
        }
      });
    }
  });

  // Check for .env files
  if (filePath.includes('.env') && !filePath.includes('.env.example')) {
    issues.push({
      type: 'Forbidden File',
      match: '.env file',
      file: filePath,
      line: 0,
      context: '.env files should never be committed',
    });
  }

  return issues;
}

function scanDirectory(dir, issues = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (shouldIgnore(filePath)) {
      return;
    }

    if (stat.isDirectory()) {
      scanDirectory(filePath, issues);
    } else if (stat.isFile() && /\.(ts|js|json|md|txt|sh|ps1|yml|yaml)$/.test(file)) {
      try {
        const fileIssues = scanFile(filePath);
        issues.push(...fileIssues);
      } catch (error) {
        // Skip binary or unreadable files
      }
    }
  });

  return issues;
}

// Main execution
console.log('🔍 Scanning for secrets...\n');

const issues = scanDirectory('.');

if (issues.length > 0) {
  console.log(`${RED}❌ Found ${issues.length} potential secret(s):${RESET}\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${RED}${index + 1}. ${issue.type}${RESET}`);
    console.log(`   File: ${issue.file}`);
    if (issue.line > 0) {
      console.log(`   Line: ${issue.line}`);
      console.log(`   Context: ${issue.context}`);
    }
    console.log(`   Match: ${issue.match}\n`);
  });

  console.log(`${YELLOW}If these are false positives, add them to .gitleaks.toml allowlist${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}✅ No secrets detected${RESET}`);
  process.exit(0);
}
