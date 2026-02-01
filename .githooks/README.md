# Git hooks

This repo uses **.githooks** instead of .git/hooks so hooks can be versioned.

**Enable once (per clone):**
```bash
git config core.hooksPath .githooks
```

**pre-commit** — Blocks new `.md` files unless they are under `docs/active/` or `docs/archive/`. Prevents doc sprawl.
