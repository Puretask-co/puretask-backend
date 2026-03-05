-- Migration 061: Add cleaner_agreements, cleaner_client_notes, id_verifications,
-- invalidated_tokens, message_delivery_log, phone_verifications, payout_items,
-- payout_reconciliation_flag_history (from test schema)
-- Production is canonical; user/cleaner refs use UUID to match prod.

-- 1) Cleaner agreements (cleaner_id -> cleaner_profiles.id UUID)
CREATE TABLE IF NOT EXISTS public.cleaner_agreements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cleaner_id uuid NOT NULL,
  agreement_type text NOT NULL,
  version text DEFAULT '1.0' NOT NULL,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2) Cleaner client notes (cleaner_id, client_id -> users.id UUID)
CREATE TABLE IF NOT EXISTS public.cleaner_client_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cleaner_id uuid NOT NULL,
  client_id uuid NOT NULL,
  notes text,
  preferences text,
  is_favorite boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3) ID verifications (cleaner_id -> cleaner_profiles.id, reviewed_by -> users.id)
CREATE TABLE IF NOT EXISTS public.id_verifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cleaner_id uuid NOT NULL,
  document_type text NOT NULL,
  document_url text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4) Invalidated tokens (user_id -> users.id UUID)
CREATE TABLE IF NOT EXISTS public.invalidated_tokens (
  jti text NOT NULL,
  user_id uuid NOT NULL,
  invalidated_at timestamp with time zone DEFAULT now() NOT NULL,
  reason text
);

-- 5) Message delivery log (cleaner_id, client_id -> users.id UUID)
CREATE TABLE IF NOT EXISTS public.message_delivery_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_type text NOT NULL,
  cleaner_id uuid NOT NULL,
  client_id uuid NOT NULL,
  booking_id uuid,
  channels text[] NOT NULL,
  delivery_results jsonb NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone
);

-- 6) Phone verifications (user_id -> users.id UUID)
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7) Payout items (payout_id -> payouts.id, ledger_entry_id -> credit_ledger.id)
CREATE TABLE IF NOT EXISTS public.payout_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payout_id uuid NOT NULL,
  ledger_entry_id uuid NOT NULL,
  amount integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 8) Payout reconciliation flag history (payout_id -> payouts.id, actor_id -> users.id)
CREATE TABLE IF NOT EXISTS public.payout_reconciliation_flag_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payout_id uuid NOT NULL,
  status text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 9) Primary keys and unique constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleaner_agreements_pkey') THEN
    ALTER TABLE public.cleaner_agreements ADD CONSTRAINT cleaner_agreements_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleaner_client_notes_pkey') THEN
    ALTER TABLE public.cleaner_client_notes ADD CONSTRAINT cleaner_client_notes_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'id_verifications_pkey') THEN
    ALTER TABLE public.id_verifications ADD CONSTRAINT id_verifications_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invalidated_tokens_pkey') THEN
    ALTER TABLE public.invalidated_tokens ADD CONSTRAINT invalidated_tokens_pkey PRIMARY KEY (jti);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_delivery_log_pkey') THEN
    ALTER TABLE public.message_delivery_log ADD CONSTRAINT message_delivery_log_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'phone_verifications_pkey') THEN
    ALTER TABLE public.phone_verifications ADD CONSTRAINT phone_verifications_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_items_pkey') THEN
    ALTER TABLE public.payout_items ADD CONSTRAINT payout_items_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_reconciliation_flag_history_pkey') THEN
    ALTER TABLE public.payout_reconciliation_flag_history ADD CONSTRAINT payout_reconciliation_flag_history_pkey PRIMARY KEY (id);
  END IF;
END$$;

-- 10) Unique index for payout_items ledger_entry_id (one ledger entry per payout item)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payout_items_ledger_entry ON public.payout_items (ledger_entry_id);

-- 11) Indexes
CREATE INDEX IF NOT EXISTS idx_cleaner_agreements_cleaner_id ON public.cleaner_agreements (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_cleaner_id ON public.id_verifications (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON public.payout_items (payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_recon_hist_payout ON public.payout_reconciliation_flag_history (payout_id);

-- 12) Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleaner_agreements_cleaner_id_fkey') THEN
    ALTER TABLE public.cleaner_agreements
      ADD CONSTRAINT cleaner_agreements_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleaner_client_notes_cleaner_id_fkey') THEN
    ALTER TABLE public.cleaner_client_notes
      ADD CONSTRAINT cleaner_client_notes_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cleaner_client_notes_client_id_fkey') THEN
    ALTER TABLE public.cleaner_client_notes
      ADD CONSTRAINT cleaner_client_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'id_verifications_cleaner_id_fkey') THEN
    ALTER TABLE public.id_verifications
      ADD CONSTRAINT id_verifications_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'id_verifications_reviewed_by_fkey') THEN
    ALTER TABLE public.id_verifications
      ADD CONSTRAINT id_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invalidated_tokens_user_id_fkey') THEN
    ALTER TABLE public.invalidated_tokens
      ADD CONSTRAINT invalidated_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_delivery_log_cleaner_id_fkey') THEN
    ALTER TABLE public.message_delivery_log
      ADD CONSTRAINT message_delivery_log_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_delivery_log_client_id_fkey') THEN
    ALTER TABLE public.message_delivery_log
      ADD CONSTRAINT message_delivery_log_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'phone_verifications_user_id_fkey') THEN
    ALTER TABLE public.phone_verifications
      ADD CONSTRAINT phone_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_items_payout_id_fkey') THEN
    ALTER TABLE public.payout_items
      ADD CONSTRAINT payout_items_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_items_ledger_entry_id_fkey') THEN
    ALTER TABLE public.payout_items
      ADD CONSTRAINT payout_items_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES public.credit_ledger(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_reconciliation_flag_history_payout_id_fkey') THEN
    ALTER TABLE public.payout_reconciliation_flag_history
      ADD CONSTRAINT payout_reconciliation_flag_history_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_reconciliation_flag_history_actor_id_fkey') THEN
    ALTER TABLE public.payout_reconciliation_flag_history
      ADD CONSTRAINT payout_reconciliation_flag_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END$$;
