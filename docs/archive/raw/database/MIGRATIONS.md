# MIGRATIONS.md

## Order of Operations

1. Apply `DB/migrations/000_CONSOLIDATED_SCHEMA.sql` **first** (baseline).
2. Then apply incremental migrations in order:
   - `019_comprehensive_schema_additions.sql`
   - `020_*` (if present)
   - `021_*` (if present)
   - `022_schema_enhancements.sql`
   - `023_cleaner_portal_invoicing.sql`

## Warnings
- Do **NOT** run older incremental migrations on top of `000_CONSOLIDATED_SCHEMA.sql`; they are superseded.
- Always back up the target database before applying migrations.

## Environment Guidance
- **Development**: Apply baseline + incremental set locally; verify with `npm run test:smoke`.
- **Staging**: Mirror production order; validate API critical paths and Stripe webhooks.
- **Production**: Apply during a maintenance window; monitor logs and webhook processing closely.

