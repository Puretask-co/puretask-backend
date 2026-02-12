#!/bin/bash
# Pre-commit hook for secret scanning
# This script scans staged files for potential secrets before allowing commit

set -e

echo "🔍 Running pre-commit secret scan..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FOUND_SECRETS=0

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No files staged, skipping secret scan${NC}"
  exit 0
fi

# Patterns to detect (common secret formats)
PATTERNS=(
  "sk_live_[a-zA-Z0-9]{24,}"           # Stripe live keys
  "sk_test_[a-zA-Z0-9]{24,}"           # Stripe test keys
  "whsec_[a-zA-Z0-9]{32,}"             # Stripe webhook secrets
  "SG\\.[a-zA-Z0-9_-]{22}\\.[a-zA-Z0-9_-]{43}"  # SendGrid API keys
  "AC[a-z0-9]{32}"                     # Twilio Account SID
  "sk-[a-zA-Z0-9]{32,}"                # OpenAI API keys
  "AIza[0-9A-Za-z\\-_]{35}"            # Google API keys
  "ya29\\.[0-9A-Za-z\\-_]+"            # Google OAuth tokens
)

# Check each staged file
for file in $STAGED_FILES; do
  # Skip if file doesn't exist (deleted)
  if [ ! -f "$file" ]; then
    continue
  fi
  
  # Skip binary files
  if file "$file" | grep -q "binary"; then
    continue
  fi
  
  # Skip node_modules, dist, .git
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".git"* ]]; then
    continue
  fi
  
  # Skip .env.example (allowed)
  if [[ "$file" == *".env.example"* ]]; then
    continue
  fi
  
  # Check for .env files (should never be committed)
  if [[ "$file" == *".env"* ]] && [[ "$file" != *".env.example"* ]]; then
    echo -e "${RED}❌ ERROR: .env file detected: $file${NC}"
    echo -e "${RED}   .env files should never be committed!${NC}"
    FOUND_SECRETS=1
    continue
  fi
  
  # Check for secret patterns
  for pattern in "${PATTERNS[@]}"; do
    # Use git show to get staged content
    if git show :"$file" 2>/dev/null | grep -E "$pattern" | grep -v "YOUR_" | grep -v "REPLACE" | grep -v "example" | grep -v "placeholder" | grep -q .; then
      echo -e "${RED}❌ Potential secret detected in: $file${NC}"
      echo -e "${YELLOW}   Pattern: $pattern${NC}"
      git show :"$file" | grep -E "$pattern" | grep -v "YOUR_" | grep -v "REPLACE" | grep -v "example" | grep -v "placeholder" | head -5
      FOUND_SECRETS=1
    fi
  done
  
  # Check for common secret variable names with actual values
  if git show :"$file" 2>/dev/null | grep -E "^(JWT_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|N8N_WEBHOOK_SECRET|SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|FACEBOOK_APP_SECRET)=[^=YOURREPLACEexampleplaceholder]" | grep -v "^\s*#" | grep -q .; then
    echo -e "${RED}❌ Potential secret variable with value in: $file${NC}"
    git show :"$file" | grep -E "^(JWT_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|N8N_WEBHOOK_SECRET|SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|FACEBOOK_APP_SECRET)=[^=YOURREPLACEexampleplaceholder]" | grep -v "^\s*#" | head -5
    FOUND_SECRETS=1
  fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
  echo ""
  echo -e "${RED}❌ Secret scan failed!${NC}"
  echo -e "${YELLOW}Please remove secrets before committing.${NC}"
  echo -e "${YELLOW}If this is a false positive, add it to .gitleaks.toml allowlist${NC}"
  echo ""
  echo -e "${YELLOW}To bypass this check (NOT RECOMMENDED):${NC}"
  echo -e "${YELLOW}  git commit --no-verify${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Secret scan passed${NC}"
exit 0
