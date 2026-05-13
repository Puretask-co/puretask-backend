# Archived 2026-05-13

These files were previously at the repo root but contradict the canonical docs in `docs/active/`. Archived to reduce confusion and stop new developers from following obsolete guidance discovered via search.

**Do not restore without first confirming the content matches the current architecture in `docs/active/ARCHITECTURE.md` and `docs/active/RUNBOOK.md`.**

- `IMPLEMENTATION_GUIDE.md` — placeholder/empty.
- `NEXT_5_MOVES.md`, `NEXT_5_STRATEGIC_MOVES.md` — old strategic plans recommending logging/APM tools that contradict the live stack (project uses a custom logger plus Sentry).
- `SERVER_STARTUP_GUIDE.md` — outdated local-dev guide; current source of truth is `docs/active/SETUP.md`.

If any of these contain content worth preserving, lift it into the canonical doc and add a Decision Record entry rather than restoring the root file.
