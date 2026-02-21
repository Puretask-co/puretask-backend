# Gamification: Canonical Spec (uploaded bundle)

The **canonical gamification spec** for PureTask is the uploaded bundle. Use these documents as the source of truth for rules, events, metrics, and enforcement. Implementation in this repo follows this spec; see [ARCHITECTURE §3](../ARCHITECTURE.md) for where it lives in code and DB.

---

## Canonical documents (in `docs/`)

| Document | Purpose |
|----------|---------|
| [PURETASK_GAMIFICATION_CURSOR_CONTEXT.md](docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md) | **Lead spec:** what the system is, locked product truths, core rules (meaningful login, message, photo, on-time, good-faith), architecture, key constants, definition of done. |
| [event_contract_v1.md](docs/event_contract_v1.md) | Event stream: required fields, event types, payloads. What to emit for metrics and anti-gaming. |
| [metrics_contract_v1.md](docs/metrics_contract_v1.md) | Every metric key, calculation, config knobs (15 min, 25 chars, 250 m, 18 h, 6/7 days), edge cases. |
| [spec_enforcement_matrix_v1.md](docs/spec_enforcement_matrix_v1.md) | Merge-gate checklist: spec → config/DB/code/API/tests. Use for QA and rollout. |
| [runtime_config_loading.md](docs/runtime_config_loading.md) | How runtime loads active config from DB, poll interval, rollback semantics. |
| [reward_meanings_and_fairness.md](docs/reward_meanings_and_fairness.md) | What rewards mean in practice (visibility, early exposure, add-on spotlight, maintenance pause). |
| [admin_ui_wireframe_spec.md](docs/admin_ui_wireframe_spec.md) | Admin UI expectations for config, budget, governor, audit. |
| [MIGRATION_RUN_ORDER.md](docs/MIGRATION_RUN_ORDER.md) | Bundle SQL run order (reference only; production uses backend 043–056). |

Contract JSON (event, metrics, event→metric mapping) lives in **`src/config/cleanerLevels/contracts/`**. Reference code: **`src/gamification-bundle/`**. Bundle SQL (do not run as-is): **`DB/migrations/bundle_reference/`**.
