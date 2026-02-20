# Step 10 — Runtime config loading (safe + auditable)

## Why config versions?
You do NOT want admins directly editing live JSON files.
Instead, runtime loads the *active* config version from DB.

## Pattern
- Runtime process loads active versions on boot and caches.
- Also polls every N minutes (e.g. 2 min) for newer effective_at versions.
- Cache by (config_type, region_id).

## Required config types
- goals
- rewards
- governor (optional if using region_governor_config table)
- levels
- full_bundle (optional combined config)

## Rollback
Rollback creates a NEW active version with copied payload.
History remains immutable.

## A/B flags
Use admin_feature_flags to gate behavior:
- e.g. new ranking algorithm variant B in one region
- e.g. enable cash rewards only in some regions
