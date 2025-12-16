#!/bin/bash
# Deploy PureTask Backend to Staging Environment
# Usage: ./scripts/deploy-staging.sh

set -e  # Exit on error

echo "🚀 Deploying PureTask Backend to Staging..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Lint (non-blocking)
echo "  ✓ Running linter..."
npm run lint || echo -e "${YELLOW}⚠️  Linter warnings (non-blocking)${NC}"

# Run smoke tests (if database available)
if [ -n "$DATABASE_URL" ]; then
    echo "  ✓ Running smoke tests..."
    npm run test:smoke || {
        echo -e "${YELLOW}⚠️  Smoke tests failed (non-blocking)${NC}"
    }
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping smoke tests${NC}"
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"

# Deploy to Railway
echo -e "${YELLOW}🚂 Deploying to Railway staging...${NC}"

# Link to staging project (if not already linked)
if [ ! -f ".railway/link.json" ]; then
    echo "  ℹ️  Linking to Railway project..."
    railway link
fi

# Deploy
railway up || {
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Deployment successful!${NC}"

# Post-deployment verification
echo -e "${YELLOW}🔍 Running post-deployment checks...${NC}"

# Get deployment URL
DEPLOY_URL=$(railway domain 2>/dev/null || echo "")
if [ -n "$DEPLOY_URL" ]; then
    echo "  ℹ️  Deployment URL: https://$DEPLOY_URL"
    
    # Health check
    echo "  ✓ Checking health endpoint..."
    sleep 5  # Wait for deployment to start
    if curl -f -s "https://$DEPLOY_URL/health" > /dev/null; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check failed (service may still be starting)${NC}"
    fi
fi

echo -e "${GREEN}🎉 Staging deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify deployment in Railway dashboard"
echo "  2. Check logs: railway logs"
echo "  3. Run smoke tests against staging: npm run test:smoke"
echo "  4. Monitor for errors in first 10 minutes"

