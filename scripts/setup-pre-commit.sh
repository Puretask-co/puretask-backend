#!/bin/bash
# Setup pre-commit hooks for secret scanning

set -e

echo "🔧 Setting up pre-commit hooks..."

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-commit script
if [ -f "scripts/pre-commit-secret-scan.sh" ]; then
  cp scripts/pre-commit-secret-scan.sh .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ Pre-commit hook installed (bash version)"
elif [ -f "scripts/pre-commit-secret-scan.ps1" ]; then
  # For Windows, create a wrapper
  cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
powershell.exe -ExecutionPolicy Bypass -File scripts/pre-commit-secret-scan.ps1
EOF
  chmod +x .git/hooks/pre-commit
  echo "✅ Pre-commit hook installed (PowerShell version)"
else
  echo "❌ Pre-commit script not found"
  exit 1
fi

echo "✅ Pre-commit hooks configured"
echo ""
echo "The hook will now scan for secrets before each commit."
echo "To bypass (NOT RECOMMENDED): git commit --no-verify"
