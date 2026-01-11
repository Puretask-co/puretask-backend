#!/bin/bash
# Quick Setup Script for AI Assistant Integration

set -e

echo "🤖 PureTask AI Assistant Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

echo "📋 Step 1: Checking dependencies..."
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Warning: Node.js version should be >= 18${NC}"
fi

# Check if database connection is available
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Please set it before continuing.${NC}"
    read -p "Press enter to continue anyway or Ctrl+C to exit..."
fi

echo -e "${GREEN}✅ Environment checks passed${NC}"
echo ""

# Install dependencies
echo "📦 Step 2: Installing dependencies..."
npm install openai@^4.0.0 --save
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Check for required environment variables
echo "🔐 Step 3: Checking environment variables..."
MISSING_VARS=()

if [ -z "$OPENAI_API_KEY" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    MISSING_VARS+=("TWILIO_ACCOUNT_SID")
fi

if [ -z "$TWILIO_AUTH_TOKEN" ]; then
    MISSING_VARS+=("TWILIO_AUTH_TOKEN")
fi

if [ -z "$TWILIO_PHONE_NUMBER" ]; then
    MISSING_VARS+=("TWILIO_PHONE_NUMBER")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Add these to your .env file:"
    echo ""
    echo "OPENAI_API_KEY=sk-..."
    echo "TWILIO_ACCOUNT_SID=AC..."
    echo "TWILIO_AUTH_TOKEN=..."
    echo "TWILIO_PHONE_NUMBER=+1..."
    echo ""
    read -p "Press enter once you've added them, or Ctrl+C to exit..."
else
    echo -e "${GREEN}✅ All environment variables set${NC}"
fi
echo ""

# Run database migration
echo "🗄️  Step 4: Running database migration..."
if [ -n "$DATABASE_URL" ]; then
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" < DB/migrations/026_ai_assistant_schema.sql
        echo -e "${GREEN}✅ Database migration completed${NC}"
    else
        echo -e "${YELLOW}⚠️  psql not found. Please run the migration manually:${NC}"
        echo "   psql \$DATABASE_URL < DB/migrations/026_ai_assistant_schema.sql"
    fi
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Skipping migration.${NC}"
    echo "   Run manually: psql \$DATABASE_URL < DB/migrations/026_ai_assistant_schema.sql"
fi
echo ""

# Check if routes are registered
echo "🔌 Step 5: Checking route registration..."
if grep -q "aiRouter" src/index.ts; then
    echo -e "${GREEN}✅ AI routes already registered${NC}"
else
    echo -e "${YELLOW}⚠️  AI routes not registered yet${NC}"
    echo "   Add to src/index.ts:"
    echo "   import aiRouter from './routes/ai';"
    echo "   app.use('/ai', aiRouter);"
fi
echo ""

# Verify files exist
echo "📁 Step 6: Verifying files..."
REQUIRED_FILES=(
    "src/services/aiCommunication.ts"
    "src/services/aiScheduling.ts"
    "src/routes/ai.ts"
    "DB/migrations/026_ai_assistant_schema.sql"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file ${RED}(missing)${NC}"
        ALL_PRESENT=false
    fi
done

if [ "$ALL_PRESENT" = false ]; then
    echo ""
    echo -e "${RED}❌ Some required files are missing${NC}"
    exit 1
fi
echo ""

# Create API adapter if it doesn't exist
echo "🔧 Step 7: Creating frontend API adapter..."
mkdir -p src/frontend/lib

if [ ! -f "src/frontend/lib/aiApi.ts" ]; then
    cat > src/frontend/lib/aiApi.ts << 'EOF'
// AI API Adapter for Frontend
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('token');
}

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export const aiApi = {
  getSettings: () => apiCall('/ai/settings'),
  updateSettings: (settings: any) => apiCall('/ai/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),
  suggestSlots: (params: any) => apiCall('/ai/suggest-slots', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  processClientResponse: (data: any) => apiCall('/ai/process-client-response', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendMessage: (data: any) => apiCall('/ai/send-message', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getInsights: () => apiCall('/ai/insights'),
  generateResponse: (params: any) => apiCall('/ai/generate-response', {
    method: 'POST',
    body: JSON.stringify(params)
  })
};
EOF
    echo -e "${GREEN}✅ Created src/frontend/lib/aiApi.ts${NC}"
else
    echo -e "${GREEN}✅ API adapter already exists${NC}"
fi
echo ""

# Summary
echo "================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "================================"
echo ""
echo "📚 Next Steps:"
echo ""
echo "1. Copy frontend components:"
echo "   Copy all components from base44_project/src/components/ai/"
echo "   to your project's frontend components folder"
echo ""
echo "2. Update component imports:"
echo "   Replace: import { base44 } from '@/api/base44Client';"
echo "   With:    import { aiApi } from '@/lib/aiApi';"
echo ""
echo "3. Start your server and test:"
echo "   npm run dev"
echo ""
echo "4. Test AI endpoints:"
echo "   curl http://localhost:4000/api/ai/settings -H \"Authorization: Bearer TOKEN\""
echo ""
echo "📖 Full documentation: docs/AI_ASSISTANT_INTEGRATION_GUIDE.md"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"

