#!/usr/bin/env node
/**
 * PureTask Backend - Deployment Readiness Check
 * 
 * Run with: node scripts/check-ready.js
 * 
 * This script checks if your environment is ready for deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 PureTask Backend - Deployment Readiness Check\n');
console.log('='.repeat(50));

let allPassed = true;
const results = [];

// Helper function
function check(name, condition, errorMsg) {
  if (condition) {
    results.push({ name, status: '✅', message: 'OK' });
  } else {
    results.push({ name, status: '❌', message: errorMsg });
    allPassed = false;
  }
}

function warn(name, condition, warnMsg) {
  if (condition) {
    results.push({ name, status: '✅', message: 'OK' });
  } else {
    results.push({ name, status: '⚠️', message: warnMsg });
  }
}

// 1. Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
check('Node.js version', majorVersion >= 20, `Requires Node.js 20+, found ${nodeVersion}`);

// 2. Check if .env exists
const envExists = fs.existsSync(path.join(__dirname, '..', '.env'));
check('.env file', envExists, 'Missing .env file - copy from docs/ENV_TEMPLATE.md');

// 3. Check required env vars (if .env exists)
if (envExists) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'N8N_WEBHOOK_SECRET'
  ];
  
  for (const varName of required) {
    check(`ENV: ${varName}`, !!process.env[varName], `Missing required env var: ${varName}`);
  }
  
  // Check optional but recommended
  const optional = [
    { name: 'SENDGRID_API_KEY', desc: 'Email notifications' },
    { name: 'TWILIO_ACCOUNT_SID', desc: 'SMS notifications' },
    { name: 'ONESIGNAL_APP_ID', desc: 'Push notifications' }
  ];
  
  for (const { name, desc } of optional) {
    warn(`ENV: ${name}`, !!process.env[name], `Missing (optional for ${desc})`);
  }
}

// 4. Check package.json exists
const pkgExists = fs.existsSync(path.join(__dirname, '..', 'package.json'));
check('package.json', pkgExists, 'Missing package.json');

// 5. Check node_modules exists
const modulesExist = fs.existsSync(path.join(__dirname, '..', 'node_modules'));
check('node_modules', modulesExist, 'Run: npm install');

// 6. Check dist folder exists (for production)
const distExists = fs.existsSync(path.join(__dirname, '..', 'dist'));
warn('dist folder', distExists, 'Run: npm run build (required for production)');

// 7. Check migrations folder
const migrationsExist = fs.existsSync(path.join(__dirname, '..', 'DB', 'migrations'));
check('DB migrations', migrationsExist, 'Missing DB/migrations folder');

// 8. Check TypeScript config
const tsconfigExists = fs.existsSync(path.join(__dirname, '..', 'tsconfig.json'));
check('tsconfig.json', tsconfigExists, 'Missing tsconfig.json');

// Print results
console.log('\n📋 Check Results:\n');
for (const r of results) {
  console.log(`  ${r.status} ${r.name}: ${r.message}`);
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('\n✅ All checks passed! Ready for deployment.\n');
  console.log('Next steps:');
  console.log('  1. Run migrations: (see DEPLOYMENT_CHECKLIST.md)');
  console.log('  2. Build: npm run build');
  console.log('  3. Start: npm start\n');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above.\n');
  console.log('See docs/DEPLOYMENT_CHECKLIST.md for detailed instructions.\n');
  process.exit(1);
}

