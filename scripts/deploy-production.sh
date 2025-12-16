#!/bin/bash
# Deploy PureTask Backend to Production Environment
# Usage: ./scripts/deploy-production.sh
# 
# WARNING: This script deploys to PRODUCTION. Use with caution.

set -e  # Exit on error

echo "🚀 Deploying PureTask Backend to PRODUCTION..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Confirmation prompt
read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found. Install it from https://docs.railway.app/develop/cli${NC}"
    exit 1
fi

# Check if logged in to Railway
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway. Logging in...${NC}"
    railway login
fi

# Pre-deployment checks
echo -e "${YELLOW}📋 Running pre-deployment checks...${NC}"

# Type check
echo "  ✓ Running TypeScript type check..."
npm run typecheck || {
    echo -e "${RED}❌ TypeScript type check failed${NC}"
    exit 1
}

# Build
echo "  ✓ Building production bundle..."
npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

# Lint
echo "  ✓ Running linter..."
npm run lint || {
    echo -e "${RED}❌ Linter failed${NC}"
    exit 1
}

# Run all tests
echo "  ✓ Running test suite..."
npm run test:smoke || {
    echo -e "${RED}❌ Smoke tests failed${NC}"
    exit 1
}

npm run test:v1-hardening || {
    echo -e "${RED}❌ V1 hardening tests failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"

# Verify production environment variables
echo -e "${YELLOW}🔐 Verifying production environment...${NC}"
echo "  ⚠️  Ensure the following are set in Railway:"
echo "     - DATABASE_URL (production database)"
echo "     - JWT_SECRET (64+ characters)"
echo "     - STRIPE_SECRET_KEY (live key: sk_live_...)"
echo "     - STRIPE_WEBHOOK_SECRET"
echo "     - Production guard flags (BOOKINGS_ENABLED, etc.)"
read -p "  Press Enter to continue after verifying environment variables..."

# Deploy to Railway production
echo -e "${YELLOW}🚂 Deploying to Railway production...${NC}"

# Link to production project
if [ ! -f ".railway/link.json" ]; then
    echo "  ℹ️  Linking to Railway production project..."
    railway link --environment production
fi

# Deploy
railway up --environment production || {
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Deployment successful!${NC}"

# Post-deployment verification
echo -e "${YELLOW}🔍 Running post-deployment checks...${NC}"

# Get deployment URL
DEPLOY_URL=$(railway domain --environment production 2>/dev/null || echo "")
if [ -n "$DEPLOY_URL" ]; then
    echo "  ℹ️  Production URL: https://$DEPLOY_URL"
    
    # Health check
    echo "  ✓ Checking health endpoint..."
    sleep 10  # Wait for deployment to start
    if curl -f -s "https://$DEPLOY_URL/health" > /dev/null; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        exit 1
    fi
    
    # Readiness check
    echo "  ✓ Checking readiness endpoint..."
    if curl -f -s "https://$DEPLOY_URL/health/ready" > /dev/null; then
        echo -e "${GREEN}✅ Readiness check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Readiness check failed (check database connection)${NC}"
    fi
fi

echo -e "${GREEN}🎉 Production deployment complete!${NC}"
echo ""
echo "⚠️  IMPORTANT: Monitor the following for the next 30 minutes:"
echo "  1. Railway logs: railway logs --environment production"
echo "  2. Error rates in monitoring dashboard"
echo "  3. Database connection health"
echo "  4. Stripe webhook delivery"
echo "  5. Background worker execution"
echo ""
echo "If issues are detected, refer to docs/DEPLOYMENT_CHECKLIST.md for rollback steps."

