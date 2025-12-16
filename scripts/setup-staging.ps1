# Setup Staging Environment for PureTask Backend (PowerShell)
# Usage: .\scripts\setup-staging.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Setting up PureTask Backend Staging Environment..." -ForegroundColor Cyan

# Check if Railway CLI is installed
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Railway CLI not found." -ForegroundColor Red
    Write-Host "   Install it: npm install -g @railway/cli" -ForegroundColor Yellow
    Write-Host "   Or visit: https://docs.railway.app/develop/cli" -ForegroundColor Yellow
    exit 1
}

# Check if logged in to Railway
try {
    railway whoami | Out-Null
} catch {
    Write-Host "⚠️  Not logged in to Railway. Logging in..." -ForegroundColor Yellow
    railway login
}

Write-Host "`n📋 Staging Environment Setup Checklist" -ForegroundColor Blue
Write-Host ""

# Step 1: Create Railway project
Write-Host "Step 1: Create Railway Project" -ForegroundColor Yellow
$createProject = Read-Host "  Create a new Railway project? (yes/no)"
if ($createProject -eq "yes") {
    railway init --name "puretask-backend-staging"
    Write-Host "✅ Project created" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Linking to existing project..." -ForegroundColor Cyan
    railway link
}

# Step 2: Create Neon database
Write-Host "`nStep 2: Database Setup" -ForegroundColor Yellow
Write-Host "  📝 Create a Neon database for staging:" -ForegroundColor Cyan
Write-Host "     1. Go to https://console.neon.tech" -ForegroundColor White
Write-Host "     2. Create a new project: 'puretask-staging'" -ForegroundColor White
Write-Host "     3. Copy the connection string" -ForegroundColor White
Write-Host ""
$dbCreated = Read-Host "  Have you created the Neon database? (yes/no)"

if ($dbCreated -eq "yes") {
    $dbUrl = Read-Host "  Enter DATABASE_URL (or press Enter to set in Railway dashboard)"
    
    if ($dbUrl) {
        railway variables set "DATABASE_URL=$dbUrl" --environment staging
        Write-Host "✅ DATABASE_URL set" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  Set DATABASE_URL in Railway dashboard:" -ForegroundColor Cyan
        Write-Host "     Railway Dashboard → Your Project → Variables → Add Variable" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  Create database first, then run this script again" -ForegroundColor Yellow
}

# Step 3: Run database migrations
Write-Host "`nStep 3: Database Migrations" -ForegroundColor Yellow
$runMigrations = Read-Host "  Run database migrations now? (yes/no)"

if ($runMigrations -eq "yes") {
    if (-not $dbUrl) {
        $dbUrl = Read-Host "  Enter DATABASE_URL"
    }
    
    if ($dbUrl) {
        Write-Host "  Running migrations..." -ForegroundColor Cyan
        Write-Host "  ⚠️  Using Neon SQL Editor is recommended for Windows" -ForegroundColor Yellow
        Write-Host "     Copy and paste these files in Neon SQL Editor:" -ForegroundColor White
        Write-Host "     1. DB/migrations/000_CONSOLIDATED_SCHEMA.sql" -ForegroundColor White
        Write-Host "     2. docs/NEON_V1_HARDENING_MIGRATIONS.sql" -ForegroundColor White
        Write-Host "     3. docs/FIX_STRIPE_EVENTS_COLUMN.sql" -ForegroundColor White
    } else {
        Write-Host "⚠️  DATABASE_URL not provided. Run migrations manually:" -ForegroundColor Yellow
        Write-Host "     See docs/DEPLOYMENT_CHECKLIST.md" -ForegroundColor White
    }
}

# Step 4: Set environment variables
Write-Host "`nStep 4: Environment Variables" -ForegroundColor Yellow
Write-Host "  📝 Required environment variables:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Required:" -ForegroundColor White
Write-Host "    - DATABASE_URL (already set above)" -ForegroundColor Gray
Write-Host "    - JWT_SECRET (generate: openssl rand -hex 32)" -ForegroundColor Gray
Write-Host "    - STRIPE_SECRET_KEY (test key: sk_test_...)" -ForegroundColor Gray
Write-Host "    - STRIPE_WEBHOOK_SECRET (from Stripe dashboard)" -ForegroundColor Gray
Write-Host "    - N8N_WEBHOOK_SECRET (generate: openssl rand -hex 32)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Recommended for staging:" -ForegroundColor White
Write-Host "    - NODE_ENV=staging" -ForegroundColor Gray
Write-Host "    - BOOKINGS_ENABLED=true" -ForegroundColor Gray
Write-Host "    - PAYOUTS_ENABLED=false (enable after testing)" -ForegroundColor Gray
Write-Host "    - CREDITS_ENABLED=true" -ForegroundColor Gray
Write-Host "    - REFUNDS_ENABLED=true" -ForegroundColor Gray
Write-Host "    - WORKERS_ENABLED=true" -ForegroundColor Gray
Write-Host ""

$setVars = Read-Host "  Set environment variables now? (yes/no)"

if ($setVars -eq "yes") {
    # Generate secrets (using Node.js if openssl not available)
    Write-Host "  Generating secrets..." -ForegroundColor Cyan
    
    # Try to generate JWT_SECRET
    try {
        $jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    } catch {
        Write-Host "  ⚠️  Could not generate secret. Please generate manually:" -ForegroundColor Yellow
        Write-Host "     openssl rand -hex 32" -ForegroundColor White
        $jwtSecret = Read-Host "  Enter JWT_SECRET"
    }
    
    # Try to generate N8N_SECRET
    try {
        $n8nSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    } catch {
        $n8nSecret = Read-Host "  Enter N8N_WEBHOOK_SECRET"
    }
    
    Write-Host "  Setting variables in Railway..." -ForegroundColor Cyan
    railway variables set "JWT_SECRET=$jwtSecret" --environment staging
    railway variables set "N8N_WEBHOOK_SECRET=$n8nSecret" --environment staging
    railway variables set "NODE_ENV=staging" --environment staging
    railway variables set "BOOKINGS_ENABLED=true" --environment staging
    railway variables set "PAYOUTS_ENABLED=false" --environment staging
    railway variables set "CREDITS_ENABLED=true" --environment staging
    railway variables set "REFUNDS_ENABLED=true" --environment staging
    railway variables set "WORKERS_ENABLED=true" --environment staging
    
    Write-Host "✅ Environment variables set" -ForegroundColor Green
    Write-Host ""
    Write-Host "  ⚠️  You still need to set:" -ForegroundColor Yellow
    Write-Host "     - STRIPE_SECRET_KEY (get from Stripe dashboard)" -ForegroundColor White
    Write-Host "     - STRIPE_WEBHOOK_SECRET (get from Stripe dashboard)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Set them in Railway dashboard or run:" -ForegroundColor Cyan
    Write-Host "     railway variables set STRIPE_SECRET_KEY='sk_test_...' --environment staging" -ForegroundColor White
    Write-Host "     railway variables set STRIPE_WEBHOOK_SECRET='whsec_...' --environment staging" -ForegroundColor White
}

# Step 5: Configure Stripe webhook
Write-Host "`nStep 5: Stripe Webhook Configuration" -ForegroundColor Yellow
Write-Host "  📝 Configure Stripe webhook:" -ForegroundColor Cyan
Write-Host "     1. Go to https://dashboard.stripe.com/test/webhooks" -ForegroundColor White
Write-Host "     2. Click 'Add endpoint'" -ForegroundColor White
Write-Host "     3. Endpoint URL: https://your-staging-url.railway.app/stripe/webhook" -ForegroundColor White
Write-Host "     4. Select events (see docs/DEPLOYMENT_CHECKLIST.md)" -ForegroundColor White
Write-Host "     5. Copy webhook secret to STRIPE_WEBHOOK_SECRET" -ForegroundColor White
Write-Host ""
Read-Host "  Press Enter when Stripe webhook is configured..."

# Step 6: Deploy
Write-Host "`nStep 6: Deploy to Staging" -ForegroundColor Yellow
$deployNow = Read-Host "  Deploy now? (yes/no)"

if ($deployNow -eq "yes") {
    Write-Host "  Deploying..." -ForegroundColor Cyan
    railway up --environment staging
} else {
    Write-Host "  ℹ️  Deploy later with: railway up --environment staging" -ForegroundColor Cyan
}

# Summary
Write-Host ""
Write-Host "✅ Staging Environment Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify deployment: railway logs --environment staging" -ForegroundColor White
Write-Host "  2. Test health endpoint: curl https://your-url.railway.app/health" -ForegroundColor White
Write-Host "  3. Run smoke tests: npm run test:smoke" -ForegroundColor White
Write-Host "  4. Schedule workers (see docs/WORKER_SCHEDULE.md)" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  - View logs: railway logs --environment staging" -ForegroundColor White
Write-Host "  - View variables: railway variables --environment staging" -ForegroundColor White
Write-Host "  - Open dashboard: railway open --environment staging" -ForegroundColor White

