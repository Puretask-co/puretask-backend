#!/usr/bin/env bash
# Removes Stripe test key pattern from SECURITY_GUARDRAILS.md in ALL commits.
# Run from repo root in Git Bash: bash scripts/rewrite-history-remove-secret.sh
set -e
echo "Rewriting history to remove secret from SECURITY_GUARDRAILS.md (all locations)..."
git filter-branch -f --tree-filter '
  for f in docs/active/SECURITY_GUARDRAILS.md docs/active/00-CRITICAL/SECURITY_GUARDRAILS.md; do
    if [ -f "$f" ]; then
      sed -i "s/sk_test_[^\"]*/<redacted>/g" "$f"
    fi
  done
' --tag-name-filter cat -- --all
echo ""
echo "Done. Next steps:"
echo "  1. git push origin --force --all"
echo "  2. git push origin --force --tags"
echo ""
echo "WARNING: History was rewritten. Anyone who cloned must re-clone or rebase."
