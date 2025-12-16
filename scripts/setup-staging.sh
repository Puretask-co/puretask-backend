#!/bin/bash
# Setup Staging Environment for PureTask Backend
# Usage: ./scripts/setup-staging.sh

set -e  # Exit on error

echo "🔧 Setting up PureTask Backend Staging Environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found.${NC}"
    echo "   Install it: npm install -g @railway/cli"
    echo "   Or visit: https://docs.railway.app/develop/cli"
    exit 1
fi

# Check if logged in to Railway
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway.${NC}"
    railway login
fi

echo -e "${BLUE}📋 Staging Environment Setup Checklist${NC}"
echo ""

# Step 1: Create Railway project
echo -e "${YELLOW}Step 1: Create Railway Project${NC}"
read -p "  Create a new Railway project? (yes/no): " create_project
if [ "$create_project" = "yes" ]; then
    railway init --name "puretask-backend-staging"
    echo -e "${GREEN}✅ Project created${NC}"
else
    echo "  ℹ️  Linking to existing project..."
    railway link
fi

# Step 2: Create Neon database
echo ""
echo -e "${YELLOW}Step 2: Database Setup${NC}"
echo "  📝 Create a Neon database for staging:"
echo "     1. Go to https://console.neon.tech"
echo "     2. Create a new project: 'puretask-staging'"
echo "     3. Copy the connection string"
echo ""
read -p "  Have you created the Neon database? (yes/no): " db_created

if [ "$db_created" = "yes" ]; then
    read -p "  Enter DATABASE_URL (or press Enter to set in Railway dashboard): " db_url
    
    if [ -n "$db_url" ]; then
        railway variables set DATABASE_URL="$db_url" --environment staging
        echo -e "${GREEN}✅ DATABASE_URL set${NC}"
    else
        echo "  ℹ️  Set DATABASE_URL in Railway dashboard:"
        echo "     Railway Dashboard → Your Project → Variables → Add Variable"
    fi
else
    echo -e "${YELLOW}⚠️  Create database first, then run this script again${NC}"
fi

# Step 3: Run database migrations
echo ""
echo -e "${YELLOW}Step 3: Database Migrations${NC}"
read -p "  Run database migrations now? (yes/no): " run_migrations

if [ "$run_migrations" = "yes" ]; then
    if [ -z "$db_url" ]; then
        read -p "  Enter DATABASE_URL: " db_url
    fi
    
    if [ -n "$db_url" ]; then
        echo "  Running migrations..."
        export DATABASE_URL="$db_url"
        
        # Run base schema
        echo "  ✓ Running base schema..."
        psql "$db_url" -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql || {
            echo -e "${YELLOW}⚠️  Using Neon SQL Editor is recommended${NC}"
            echo "     Copy and paste: DB/migrations/000_CONSOLIDATED_SCHEMA.sql"
        }
        
        # Run hardening migrations
        echo "  ✓ Running V1 hardening migrations..."
        psql "$db_url" -f docs/NEON_V1_HARDENING_MIGRATIONS.sql || {
            echo -e "${YELLOW}⚠️  Using Neon SQL Editor is recommended${NC}"
            echo "     Copy and paste: docs/NEON_V1_HARDENING_MIGRATIONS.sql"
        }
        
        # Fix stripe_events table
        echo "  ✓ Fixing stripe_events table..."
        psql "$db_url" -f docs/FIX_STRIPE_EVENTS_COLUMN.sql || {
            echo -e "${YELLOW}⚠️  Using Neon SQL Editor is recommended${NC}"
            echo "     Copy and paste: docs/FIX_STRIPE_EVENTS_COLUMN.sql"
        }
        
        echo -e "${GREEN}✅ Migrations complete${NC}"
    else
        echo -e "${YELLOW}⚠️  DATABASE_URL not provided. Run migrations manually:${NC}"
        echo "     See docs/DEPLOYMENT_CHECKLIST.md"
    fi
fi

# Step 4: Set environment variables
echo ""
echo -e "${YELLOW}Step 4: Environment Variables${NC}"
echo "  📝 Required environment variables:"
echo ""
echo "  Required:"
echo "    - DATABASE_URL (already set above)"
echo "    - JWT_SECRET (generate: openssl rand -hex 32)"
echo "    - STRIPE_SECRET_KEY (test key: sk_test_...)"
echo "    - STRIPE_WEBHOOK_SECRET (from Stripe dashboard)"
echo "    - N8N_WEBHOOK_SECRET (generate: openssl rand -hex 32)"
echo ""
echo "  Recommended for staging:"
echo "    - NODE_ENV=staging"
echo "    - BOOKINGS_ENABLED=true"
echo "    - PAYOUTS_ENABLED=false (enable after testing)"
echo "    - CREDITS_ENABLED=true"
echo "    - REFUNDS_ENABLED=true"
echo "    - WORKERS_ENABLED=true"
echo ""

read -p "  Set environment variables now? (yes/no): " set_vars

if [ "$set_vars" = "yes" ]; then
    # Generate secrets
    JWT_SECRET=$(openssl rand -hex 32)
    N8N_SECRET=$(openssl rand -hex 32)
    
    echo "  Setting variables in Railway..."
    railway variables set JWT_SECRET="$JWT_SECRET" --environment staging
    railway variables set N8N_WEBHOOK_SECRET="$N8N_SECRET" --environment staging
    railway variables set NODE_ENV=staging --environment staging
    railway variables set BOOKINGS_ENABLED=true --environment staging
    railway variables set PAYOUTS_ENABLED=false --environment staging
    railway variables set CREDITS_ENABLED=true --environment staging
    railway variables set REFUNDS_ENABLED=true --environment staging
    railway variables set WORKERS_ENABLED=true --environment staging
    
    echo -e "${GREEN}✅ Environment variables set${NC}"
    echo ""
    echo "  ⚠️  You still need to set:"
    echo "     - STRIPE_SECRET_KEY (get from Stripe dashboard)"
    echo "     - STRIPE_WEBHOOK_SECRET (get from Stripe dashboard)"
    echo ""
    echo "  Set them in Railway dashboard or run:"
    echo "     railway variables set STRIPE_SECRET_KEY='sk_test_...' --environment staging"
    echo "     railway variables set STRIPE_WEBHOOK_SECRET='whsec_...' --environment staging"
fi

# Step 5: Configure Stripe webhook
echo ""
echo -e "${YELLOW}Step 5: Stripe Webhook Configuration${NC}"
echo "  📝 Configure Stripe webhook:"
echo "     1. Go to https://dashboard.stripe.com/test/webhooks"
echo "     2. Click 'Add endpoint'"
echo "     3. Endpoint URL: https://your-staging-url.railway.app/stripe/webhook"
echo "     4. Select events (see docs/DEPLOYMENT_CHECKLIST.md)"
echo "     5. Copy webhook secret to STRIPE_WEBHOOK_SECRET"
echo ""
read -p "  Press Enter when Stripe webhook is configured..."

# Step 6: Deploy
echo ""
echo -e "${YELLOW}Step 6: Deploy to Staging${NC}"
read -p "  Deploy now? (yes/no): " deploy_now

if [ "$deploy_now" = "yes" ]; then
    ./scripts/deploy-staging.sh
else
    echo "  ℹ️  Deploy later with: ./scripts/deploy-staging.sh"
fi

# Summary
echo ""
echo -e "${GREEN}✅ Staging Environment Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify deployment: railway logs --environment staging"
echo "  2. Test health endpoint: curl https://your-url.railway.app/health"
echo "  3. Run smoke tests: npm run test:smoke"
echo "  4. Schedule workers (see docs/WORKER_SCHEDULE.md)"
echo ""
echo "Useful commands:"
echo "  - View logs: railway logs --environment staging"
echo "  - View variables: railway variables --environment staging"
echo "  - Open dashboard: railway open --environment staging"

