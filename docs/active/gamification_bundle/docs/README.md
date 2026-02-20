# Step 10 — Admin Control Plane + Governor + A/B + Audit/Rollback

## Includes
- Postgres migration for:
  - admin_users
  - admin_feature_flags (A/B toggles)
  - admin_reward_budget (cash caps + kill switches)
  - admin_config_versions (versioned configs with effective_at)
  - admin_audit_log (immutable)
  - region_governor_config (if missing)
- Express routes: /admin/* for gamification control plane
- Services: config versioning + rollback, budget, governor, flags
- RBAC middleware

## Integration
1) Run sql/step10_admin_control_plane_migration_v2_0.sql
2) Mount adminRouter:
   app.use(adminRouter)
3) Ensure admin auth populates req.adminUser { id, role }
4) Update runtime to load active config from admin_config_versions (see docs/runtime_config_loading.md)

## Security
- All endpoints require RBAC role checks
- Audit log is append-only and captures before/after
