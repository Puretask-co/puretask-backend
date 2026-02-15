-- 044_admin_rbac.sql
-- Add admin sub-roles for RBAC: support_agent, support_lead, ops_finance
-- Section 11: support_agent (view only), support_lead (+refunds/override), ops_finance (+holds/payouts)
-- Uses DO block to safely add enum values (avoids error if already present)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'user_role' AND e.enumlabel = 'super_admin') THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'user_role' AND e.enumlabel = 'support_agent') THEN
    ALTER TYPE user_role ADD VALUE 'support_agent';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'user_role' AND e.enumlabel = 'support_lead') THEN
    ALTER TYPE user_role ADD VALUE 'support_lead';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON e.enumtypid = t.oid
                 WHERE t.typname = 'user_role' AND e.enumlabel = 'ops_finance') THEN
    ALTER TYPE user_role ADD VALUE 'ops_finance';
  END IF;
END
$$;

COMMENT ON TYPE user_role IS 'User roles: client, cleaner, admin, super_admin; admin sub-roles: support_agent, support_lead, ops_finance';
