# 🚀 PureTask Terminal Commands Guide

A complete, beginner-friendly reference for all terminal commands you'll need while working on PureTask.

> **💡 Tip for Windows Users:** If you see errors about "scripts disabled", use `node` directly instead of `npm`. All commands below are Windows PowerShell compatible.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Server Management](#-server-management)
3. [Testing](#-testing)
4. [Database](#-database)
5. [Port & Process Management](#-port--process-management)
6. [TypeScript & Building](#-typescript--building)
7. [Dependencies & Packages](#-dependencies--packages)
8. [Background Workers](#-background-workers)
9. [Stripe Integration](#-stripe-integration)
10. [Git & Version Control](#-git--version-control)
11. [Docker](#-docker)
12. [Debugging & Troubleshooting](#-debugging--troubleshooting)
13. [Environment & Configuration](#-environment--configuration)
14. [API Testing with cURL](#-api-testing-with-curl)
15. [Common Workflows](#-common-workflows)

---

## ⚡ Quick Start

### First Time Setup
```powershell
# 1. Install all dependencies
npm install

# 2. Copy environment template (then edit .env with your values)
copy ENV_EXAMPLE.md .env

# 3. Start the server
node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts
```

### Daily Development
```powershell
# Start server (run this every time you begin working)
node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts

# Check if it's running
curl http://localhost:4000/health
```

---

## 🖥️ Server Management

### Starting the Server

```powershell
# Standard start (recommended for development)
node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts

# With auto-reload on file changes (if npm works)
npm run dev

# Start production build
node dist/index.js
```

### Stopping the Server

```powershell
# Press Ctrl+C in the terminal where server is running
# OR kill it manually:

# Find what's using port 4000
netstat -ano | findstr :4000

# Kill by process ID (replace 12345 with actual PID)
taskkill /PID 12345 /F

# Nuclear option: kill ALL Node processes
taskkill /IM node.exe /F
```

### Checking Server Status

```powershell
# Is server alive?
curl http://localhost:4000/health

# Detailed status with metrics
curl http://localhost:4000/status/summary

# Is database connected?
curl http://localhost:4000/status/ready

# Simple ping
curl http://localhost:4000/status/ping
```

---

## 🧪 Testing

### Run Tests

```powershell
# Run ALL tests
node node_modules/vitest/vitest.mjs run

# Run only smoke tests (quick sanity checks)
node node_modules/vitest/vitest.mjs run src/tests/smoke

# Run only integration tests (full flow tests)
node node_modules/vitest/vitest.mjs run src/tests/integration

# Run only unit tests
node node_modules/vitest/vitest.mjs run src/tests/unit

# Run a specific test file
node node_modules/vitest/vitest.mjs run src/tests/smoke/health.test.ts
```

### Test Modes

```powershell
# Watch mode - reruns tests when files change
node node_modules/vitest/vitest.mjs

# With code coverage report
node node_modules/vitest/vitest.mjs run --coverage

# Verbose output (see all test details)
node node_modules/vitest/vitest.mjs run --reporter=verbose
```

### Before Running Tests

```powershell
# ⚠️ IMPORTANT: Stop the dev server first!
taskkill /IM node.exe /F

# Then run tests
node node_modules/vitest/vitest.mjs run src/tests/smoke
```

---

## 🗄️ Database

### Connection Testing

```powershell
# Check if DB is reachable (when server is running)
curl http://localhost:4000/status/ready

# Direct PostgreSQL connection test (requires psql installed)
psql $env:DATABASE_URL -c "SELECT 1"
```

### Migrations

```powershell
# Run all pending migrations (if script exists)
node scripts/migrate.js

# Verify current schema
node scripts/verifySchema.js

# Check schema integrity
psql $env:DATABASE_URL -f scripts/verify_integrity.sql
```

### Database Queries (requires psql)

```powershell
# Connect to database
psql $env:DATABASE_URL

# Once connected, useful queries:
# \dt                    -- List all tables
# \d tablename           -- Describe a table
# SELECT * FROM users;   -- Query data
# \q                     -- Quit
```

### Neon Database (Cloud)

```powershell
# If your Neon DB is paused, it will auto-wake when you:
# 1. Visit https://console.neon.tech and click your project
# 2. Make any query to the database
# 3. Start your server (it tries to connect)

# Check connection string is set
echo $env:DATABASE_URL
```

---

## 🔌 Port & Process Management

### Finding What's Using a Port

```powershell
# Check port 4000
netstat -ano | findstr :4000

# Check port 3000
netstat -ano | findstr :3000

# Check all listening ports
netstat -ano | findstr LISTENING
```

### Killing Processes

```powershell
# Kill specific process by PID
taskkill /PID 12345 /F

# Kill all Node.js processes
taskkill /IM node.exe /F

# Kill by window title (if you named your terminal)
taskkill /FI "WINDOWTITLE eq PureTask*" /F
```

### Checking Running Processes

```powershell
# List all Node processes
tasklist | findstr node

# Detailed process info
Get-Process node

# Show process using most CPU
Get-Process | Sort-Object CPU -Descending | Select-Object -First 5
```

---

## 📦 TypeScript & Building

### Type Checking

```powershell
# Check for TypeScript errors (no output = no errors!)
node node_modules/typescript/bin/tsc --noEmit

# Check a specific file
node node_modules/typescript/bin/tsc --noEmit src/index.ts
```

### Building

```powershell
# Compile TypeScript to JavaScript
node node_modules/typescript/bin/tsc

# Watch mode (auto-rebuild on changes)
node node_modules/typescript/bin/tsc --watch

# Clean build (delete dist first)
Remove-Item -Recurse -Force dist; node node_modules/typescript/bin/tsc
```

### Linting (Code Quality)

```powershell
# Run ESLint (if configured)
node node_modules/eslint/bin/eslint.js src/

# Auto-fix issues
node node_modules/eslint/bin/eslint.js src/ --fix

# Check specific file
node node_modules/eslint/bin/eslint.js src/index.ts
```

---

## 📦 Dependencies & Packages

### Installing

```powershell
# Install all dependencies from package.json
npm install

# Install a specific package
npm install express

# Install as dev dependency (only for development)
npm install --save-dev vitest

# Install globally (available everywhere)
npm install -g typescript
```

### Managing Packages

```powershell
# See all installed packages
npm list

# See top-level packages only
npm list --depth=0

# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update a specific package
npm update express

# Remove a package
npm uninstall express
```

### Troubleshooting Dependencies

```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Fix permission issues (run as admin)
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
```

---

## ⚙️ Background Workers

PureTask has several background jobs. Run these as needed:

### Job Management

```powershell
# Auto-cancel stale/expired jobs
node node_modules/ts-node/dist/bin.js src/workers/autoCancelJobs.ts

# Detect stuck jobs
node node_modules/ts-node/dist/bin.js src/workers/stuckJobDetection.ts

# Expire old job offers
node node_modules/ts-node/dist/bin.js src/workers/autoExpireAwaitingApproval.ts
```

### Payments & Payouts

```powershell
# Process weekly payouts to cleaners
node node_modules/ts-node/dist/bin.js src/workers/processPayouts.ts

# Retry failed payouts
node node_modules/ts-node/dist/bin.js src/workers/payoutRetry.ts

# Weekly payout batch
node node_modules/ts-node/dist/bin.js src/workers/payoutWeekly.ts
```

### Webhooks & Events

```powershell
# Retry failed webhook deliveries
node node_modules/ts-node/dist/bin.js src/workers/webhookRetry.ts

# Retry failed events
node node_modules/ts-node/dist/bin.js src/workers/retryFailedEvents.ts

# Retry failed notifications
node node_modules/ts-node/dist/bin.js src/workers/retryFailedNotifications.ts
```

### Scoring & Analytics

```powershell
# Recalculate reliability scores
node node_modules/ts-node/dist/bin.js src/workers/reliabilityRecalc.ts

# Nightly score recomputation
node node_modules/ts-node/dist/bin.js src/workers/nightlyScoreRecompute.ts

# Update cleaning scores
node node_modules/ts-node/dist/bin.js src/workers/cleaningScores.ts

# Check goal progress
node node_modules/ts-node/dist/bin.js src/workers/goalChecker.ts
```

### Maintenance

```powershell
# Daily backup
node node_modules/ts-node/dist/bin.js src/workers/backupDaily.ts

# Clean up old photos
node node_modules/ts-node/dist/bin.js src/workers/photoRetentionCleanup.ts

# Credit economy maintenance
node node_modules/ts-node/dist/bin.js src/workers/creditEconomyMaintenance.ts

# Expire boosts
node node_modules/ts-node/dist/bin.js src/workers/expireBoosts.ts
```

### Reports

```powershell
# KPI daily snapshot
node node_modules/ts-node/dist/bin.js src/workers/kpiDailySnapshot.ts

# Weekly summary
node node_modules/ts-node/dist/bin.js src/workers/weeklySummary.ts
```

---

## 💳 Stripe Integration

### Stripe CLI (Install First)

Download from: https://stripe.com/docs/stripe-cli

```powershell
# Login to Stripe
stripe login

# Check connection
stripe config --list
```

### Webhook Testing

```powershell
# Forward webhooks to your local server
stripe listen --forward-to localhost:4000/stripe/webhook

# Forward with specific events only
stripe listen --forward-to localhost:4000/stripe/webhook --events payment_intent.succeeded,charge.refunded
```

### Trigger Test Events

```powershell
# Payment successful
stripe trigger payment_intent.succeeded

# Payment failed
stripe trigger payment_intent.payment_failed

# Refund issued
stripe trigger charge.refunded

# Payout successful
stripe trigger payout.paid

# Payout failed
stripe trigger payout.failed

# Subscription renewed
stripe trigger invoice.paid

# Subscription payment failed
stripe trigger invoice.payment_failed

# Customer updated
stripe trigger customer.updated

# Dispute/Chargeback
stripe trigger charge.dispute.created
stripe trigger charge.dispute.closed

# Connect account updated
stripe trigger account.updated
```

### Stripe Dashboard

```powershell
# Open Stripe dashboard in browser
start https://dashboard.stripe.com/test/payments

# Open webhooks page
start https://dashboard.stripe.com/test/webhooks
```

---

## 📝 Git & Version Control

### Daily Git Workflow

```powershell
# Check current status
git status

# See what changed
git diff

# Stage all changes
git add .

# Stage specific file
git add src/index.ts

# Commit with message
git commit -m "Add new feature"

# Push to remote
git push

# Pull latest changes
git pull
```

### Branches

```powershell
# List all branches
git branch -a

# Create new branch
git checkout -b feature/my-new-feature

# Switch to existing branch
git checkout main

# Delete local branch
git branch -d feature/old-branch

# Delete remote branch
git push origin --delete feature/old-branch
```

### Undoing Changes

```powershell
# Discard changes in a file
git checkout -- src/index.ts

# Unstage a file
git reset HEAD src/index.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) ⚠️ DANGEROUS
git reset --hard HEAD~1
```

### Viewing History

```powershell
# View commit history
git log

# View history one line per commit
git log --oneline

# View history with graph
git log --oneline --graph --all

# See who changed what
git blame src/index.ts
```

---

## 🐳 Docker

### Building & Running

```powershell
# Build the Docker image
docker build -t puretask-backend .

# Run with docker-compose
docker-compose up

# Run in background (detached)
docker-compose up -d

# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### Container Management

```powershell
# List running containers
docker ps

# List all containers
docker ps -a

# View logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs backend

# Execute command in container
docker exec -it puretask-backend sh
```

### Cleanup

```powershell
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove everything unused
docker system prune

# Nuclear cleanup (⚠️ removes everything)
docker system prune -a --volumes
```

---

## 🔍 Debugging & Troubleshooting

### Common Issues

```powershell
# "Port already in use"
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# "Cannot find module"
npm install

# "TypeScript errors"
node node_modules/typescript/bin/tsc --noEmit

# "Database connection failed"
# Check your .env file has correct DATABASE_URL
# Wake up Neon database at console.neon.tech
curl http://localhost:4000/status/ready

# "Permission denied" / "Scripts disabled"
# Use node directly instead of npm
node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts
```

### Viewing Logs

```powershell
# Server logs appear in the terminal where it's running

# If using PM2 for production:
pm2 logs

# Docker logs:
docker-compose logs -f
```

### Memory & Performance

```powershell
# Check Node memory usage
Get-Process node | Select-Object WorkingSet64

# Run with more memory (if needed)
node --max-old-space-size=4096 node_modules/ts-node/dist/bin.js src/index.ts
```

---

## ⚙️ Environment & Configuration

### Environment Variables

```powershell
# View an environment variable
echo $env:DATABASE_URL

# Set temporarily (current session only)
$env:PORT = "4001"

# Set permanently (user level)
[Environment]::SetEnvironmentVariable("PORT", "4001", "User")
```

### .env File

```powershell
# Create .env from template
copy ENV_EXAMPLE.md .env

# Edit .env file
notepad .env

# Or with VS Code
code .env
```

### Check Configuration

```powershell
# View current Node version
node --version

# View npm version
npm --version

# View TypeScript version
node node_modules/typescript/bin/tsc --version

# View all environment variables
Get-ChildItem Env:
```

---

## 🌐 API Testing with cURL

### Health & Status

```powershell
# Health check
curl http://localhost:4000/health

# Status summary
curl http://localhost:4000/status/summary

# Readiness (includes DB check)
curl http://localhost:4000/status/ready
```

### Authentication

```powershell
# Register a new user
curl -X POST http://localhost:4000/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123","role":"client"}'

# Login
curl -X POST http://localhost:4000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user (replace TOKEN)
curl http://localhost:4000/auth/me `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Jobs

```powershell
# List jobs (with auth header)
curl http://localhost:4000/jobs `
  -H "x-user-id: YOUR_USER_ID" `
  -H "x-user-role: client"

# Create a job
curl -X POST http://localhost:4000/jobs `
  -H "Content-Type: application/json" `
  -H "x-user-id: YOUR_USER_ID" `
  -H "x-user-role: client" `
  -d '{"cleaning_type":"basic","estimated_hours":2,"scheduled_start_at":"2025-12-15T10:00:00Z"}'
```

### Admin Endpoints

```powershell
# Admin KPIs
curl http://localhost:4000/admin/kpis `
  -H "x-user-id: ADMIN_ID" `
  -H "x-user-role: admin"

# Admin jobs list
curl http://localhost:4000/admin/jobs `
  -H "x-user-id: ADMIN_ID" `
  -H "x-user-role: admin"
```

---

## 🔄 Common Workflows

### Starting Fresh Each Day

```powershell
# 1. Pull latest code
git pull

# 2. Install any new dependencies
npm install

# 3. Check for TypeScript errors
node node_modules/typescript/bin/tsc --noEmit

# 4. Start the server
node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts

# 5. Verify it's running
curl http://localhost:4000/health
```

### Before Committing Code

```powershell
# 1. Check TypeScript compiles
node node_modules/typescript/bin/tsc --noEmit

# 2. Stop server, run tests
taskkill /IM node.exe /F
node node_modules/vitest/vitest.mjs run

# 3. Stage and commit
git add .
git commit -m "Your descriptive message"
git push
```

### Debugging a Problem

```powershell
# 1. Check server is running
curl http://localhost:4000/health

# 2. Check database connection
curl http://localhost:4000/status/ready

# 3. Check for TypeScript errors
node node_modules/typescript/bin/tsc --noEmit

# 4. Look at server logs (in the terminal where it's running)

# 5. Check port isn't blocked
netstat -ano | findstr :4000
```

### Deploying Updates

```powershell
# 1. Build the TypeScript
node node_modules/typescript/bin/tsc

# 2. Run tests
node node_modules/vitest/vitest.mjs run

# 3. Commit and push
git add .
git commit -m "Release: description of changes"
git push

# 4. (On server) Pull and restart
git pull
npm install
node dist/index.js
```

---

## 📚 Quick Reference Card

| Task | Command |
|------|---------|
| Start server | `node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts` |
| Stop server | `taskkill /IM node.exe /F` |
| Check health | `curl http://localhost:4000/health` |
| Run tests | `node node_modules/vitest/vitest.mjs run` |
| Type check | `node node_modules/typescript/bin/tsc --noEmit` |
| Build | `node node_modules/typescript/bin/tsc` |
| Install deps | `npm install` |
| Git status | `git status` |
| Git commit | `git add . && git commit -m "message"` |
| Git push | `git push` |
| Find port usage | `netstat -ano \| findstr :4000` |
| Kill by PID | `taskkill /PID XXXX /F` |

---

## 🆘 Getting Help

```powershell
# Node help
node --help

# npm help
npm help

# TypeScript help
node node_modules/typescript/bin/tsc --help

# Vitest help
node node_modules/vitest/vitest.mjs --help

# Git help
git help
git help <command>
```

---

*Last updated: December 2025*
*For PureTask Backend v1.0*

