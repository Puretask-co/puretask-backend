-- Fix users role constraint (run in Neon SQL Editor on test DB if client registration fails)
-- Error: "new row for relation \"users\" violates check constraint \"users_role_check\""
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
