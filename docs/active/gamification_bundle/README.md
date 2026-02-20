# PureTask Gamification Master Bundle (merged reference)

The **PureTask Gamification Master Bundle** (generated 2026-02-20) is merged into this repo for reference and alignment.

**Doc evaluation (bundle vs backend):** The bundle docs were evaluated as **more complete** for canonical rules (meaningful login/message/photo/on-time/good-faith), key constants (15 min, 25 chars, 250 m, 18 h, 6/7 days), event and metrics contracts, and spec-enforcement matrix. Those rules and constants are now **canonical** in [ARCHITECTURE §3.5](../ARCHITECTURE.md) and [RUNBOOK §4](../RUNBOOK.md). Full event/metric contracts and spec matrix remain here in `docs/` for implementers and QA. Backend did not run bundle SQL (043–056 already apply).

- **This folder (`docs/active/gamification_bundle/`):** Bundle docs (Cursor context, event/metric contracts, spec matrix, migration order, admin UI wireframe). See `docs/` subfolder.
- **Migrations:** Bundle SQL is in `DB/migrations/bundle_reference/`. Do not run those on production; backend uses `043`–`056` and `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`. See `DB/migrations/bundle_reference/README.md` for mapping.
- **Configs:** Event/metric contracts are in `src/config/cleanerLevels/contracts/`. Runtime goals/levels/rewards stay in `src/config/cleanerLevels/` (goals.json, levels.json, rewards.json, etc.).
- **Code:** Bundle TypeScript (evaluators, services, admin) is in `src/gamification-bundle/`. It is reference only; main app uses `src/routes/gamification.ts`, `src/services/cleanerGoalsService.ts`, `src/services/gamificationRewardService.ts`, and workers.
