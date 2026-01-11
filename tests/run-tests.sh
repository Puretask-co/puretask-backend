#!/bin/bash

# Cleaner AI Settings API Test Runner
# Runs all automated tests for the Cleaner AI Settings Suite

echo "🧪 Cleaner AI Settings Test Suite"
echo "=================================="
echo ""

# Check if environment file exists
if [ ! -f .env.test ]; then
  echo "⚠️  Warning: .env.test file not found. Using .env"
  cp .env .env.test 2>/dev/null || true
fi

# Load test environment
export NODE_ENV=test
export $(cat .env.test | grep -v '^#' | xargs)

echo "📋 Test Configuration:"
echo "  API URL: ${API_URL:-http://localhost:3000}"
echo "  Test Cleaner: ${TEST_CLEANER_EMAIL:-test-cleaner@example.com}"
echo ""

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s "${API_URL:-http://localhost:3000}/health" > /dev/null; then
  echo "✅ Server is running"
else
  echo "❌ Server is not running. Please start the server first:"
  echo "   npm run dev"
  exit 1
fi

echo ""
echo "🚀 Running tests..."
echo ""

# Run Jest tests
npx jest tests/cleaner-ai-api.test.ts --verbose --detectOpenHandles

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
fi

echo ""
echo "📊 Test run complete"
exit $TEST_EXIT_CODE

