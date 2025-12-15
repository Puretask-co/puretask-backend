-- 905_users_fk_text_consistency.sql
-- Canonical rule: users.id is TEXT. Any FK pointing to users(id) must be TEXT.
-- This is a documentation migration (no schema changes needed if baseline is correct).

COMMENT ON COLUMN users.id IS 'Canonical: users.id is TEXT. All FKs to users(id) must also be TEXT. No UUID columns should reference this.';

-- If you still have UUID columns referencing users, you must fix them in baseline (not here)
-- because type conversions are not V1-safe additive changes.

