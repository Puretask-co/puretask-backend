# PureTask Gamification — Migration Run Order (Generated)
_Generated: 2026-02-20T10:34:36.162739Z_
This file lists SQL migrations included in this bundle, in a recommended safe order.
**Important:** Verify against your existing DB schema and migration framework before applying to production.

## Recommended order
1. `migrations/event_tables_migration_v1.sql`
2. `migrations/step6_persistence_migration_v1_3.sql`
3. `migrations/step8_reward_idempotency_migration_v1_4.sql`
4. `migrations/step9_reward_effects_views_v1_5.sql`
5. `migrations/step10_admin_control_plane_migration_v2_0.sql`

## Notes
- Run in staging first.
- If any migration already applied in your DB, ensure idempotency or skip accordingly.
- If you use a migrations table (e.g., knex/prisma/flyway), rename/move files into that framework.
