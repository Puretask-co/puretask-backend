# Archived migrations (legacy / reference only)

**These are copies.** The same files also remain in the parent `DB/migrations/` folder; nothing is deleted. This folder is for reference and to keep legacy/reference files grouped.

Files here are **not** part of the canonical migration path for new databases. Do not run them for new DBs.

## Contents

- **legacy/** — Copies of old consolidated schema (001–019), appendix (043–906), and one-off rename patches. Superseded by `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` and `000_MASTER_MIGRATION.sql`.
  - `000_CONSOLIDATED_SCHEMA.sql` — Legacy snapshot 001–019. Use COMPLETE instead.
  - `_appendix_043_to_906.sql` — Reference; content is inlined in COMPLETE.
  - `000_rename_event_name_to_event_type.sql` — One-off column rename.
  - `000_rename_scheduled_columns.sql` — One-off column renames.
  - `000_rename_scheduled_columns_simple.sql` — Simpler rename variant.
- **README_CONSOLIDATED_SCHEMAS.md** — Old schema guide. See parent `README.md` and `docs/active/MASTER_MIGRATIONS.md` for current docs.
- **000_COMPLETE_CONSOLIDATED_SCHEMA.sql.bak** — Backup copy of COMPLETE (if present).

## Canonical path for new DBs

Run **000_MASTER_MIGRATION.sql** (generate with `npm run db:generate:master-migration`)  
or run **000_COMPLETE_CONSOLIDATED_SCHEMA.sql** → **000_COMPLETE_VIEWS_PATCH.sql** → **019** → **057–061** in order.

See `docs/active/MASTER_MIGRATIONS.md` and `docs/active/SETUP.md`.
