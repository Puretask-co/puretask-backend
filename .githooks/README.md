# Git hooks

This repo uses **.githooks** instead of .git/hooks so hooks can be versioned.

**Enable once (per clone):**
```bash
git config core.hooksPath .githooks
```

**pre-commit** (Phase 3 guardrails):
- Blocks committing `.env`, `.env.production`, `.env.staging`, `.env.local`
- Runs `npm run lint` (commit fails if lint fails)
- Blocks new `.md` files outside allowed paths (`docs/active/`, `docs/archive/`, etc.)
