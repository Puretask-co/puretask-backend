# Gamification bundle reference implementation

This folder contains the **PureTask Gamification Master Bundle** TypeScript code (evaluators, services, admin) merged from the bundle for reference. It is **not wired into the main API** by default.

- **Main app gamification:** `src/routes/gamification.ts`, `src/services/cleanerGoalsService.ts`, `src/services/gamificationRewardService.ts`, `src/services/rewardEffectsService.ts`, `src/workers/`, `src/config/cleanerLevels/`.
- **Bundle docs and migration mapping:** `docs/active/gamification_bundle/`, `DB/migrations/bundle_reference/`.
- **Contract configs:** `src/config/cleanerLevels/contracts/` (event_contract_v1.json, metrics_contract_v1.json, event_to_metric_mapping_v1.json).

You can run the bundle tests here or gradually align main app logic with this reference.
