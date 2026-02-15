-- 045_credit_views_delta_fix.sql
-- Fix credit_ledger views: supports both delta_credits (001_init) and amount/direction (legacy) schemas.
-- If delta_credits exists: use it. Else: use amount/direction. Safe to run multiple times.

DO $$
DECLARE
  has_delta boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'delta_credits'
  ) INTO has_delta;

  IF has_delta THEN
    -- Schema uses delta_credits
    CREATE OR REPLACE VIEW user_credit_balances AS
    SELECT user_id, COALESCE(SUM(delta_credits), 0)::INTEGER AS balance_credits
    FROM credit_ledger GROUP BY user_id;

    CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id TEXT)
    RETURNS INTEGER AS $func$
    DECLARE v_balance INTEGER;
    BEGIN
      SELECT COALESCE(SUM(delta_credits), 0) INTO v_balance FROM credit_ledger WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END;
    $func$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE VIEW credit_ledger_with_balance AS
    SELECT cl.*,
      SUM(cl.delta_credits) OVER (PARTITION BY cl.user_id ORDER BY cl.created_at ROWS UNBOUNDED PRECEDING)::INTEGER AS running_balance
    FROM credit_ledger cl;

    CREATE OR REPLACE VIEW credit_summary_by_reason AS
    SELECT reason, COUNT(*) AS transaction_count,
      SUM(CASE WHEN delta_credits > 0 THEN delta_credits ELSE 0 END)::INTEGER AS total_added,
      SUM(CASE WHEN delta_credits < 0 THEN -delta_credits ELSE 0 END)::INTEGER AS total_removed,
      SUM(delta_credits)::INTEGER AS net_change
    FROM credit_ledger GROUP BY reason;
  ELSE
    -- Legacy schema uses amount/direction
    CREATE OR REPLACE VIEW user_credit_balances AS
    SELECT user_id, COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)::INTEGER AS balance_credits
    FROM credit_ledger GROUP BY user_id;

    CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id TEXT)
    RETURNS INTEGER AS $func$
    DECLARE v_balance INTEGER;
    BEGIN
      SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) INTO v_balance
      FROM credit_ledger WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END;
    $func$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE VIEW credit_ledger_with_balance AS
    SELECT cl.*,
      SUM(CASE WHEN cl.direction = 'credit' THEN cl.amount ELSE -cl.amount END) OVER
        (PARTITION BY cl.user_id ORDER BY cl.created_at ROWS UNBOUNDED PRECEDING)::INTEGER AS running_balance
    FROM credit_ledger cl;

    CREATE OR REPLACE VIEW credit_summary_by_reason AS
    SELECT reason, COUNT(*) AS transaction_count,
      SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)::INTEGER AS total_added,
      SUM(CASE WHEN direction != 'credit' THEN amount ELSE 0 END)::INTEGER AS total_removed,
      SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END)::INTEGER AS net_change
    FROM credit_ledger GROUP BY reason;
  END IF;
END
$$;
