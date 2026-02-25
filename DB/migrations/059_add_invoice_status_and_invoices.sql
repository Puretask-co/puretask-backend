-- Migration 059: Add invoice_status enum and invoice tables (from test schema)
-- Production is canonical; these objects exist in test but not in prod.
-- Run on both prod and test so both have the same schema.

-- 1) Enum for invoice status (must exist before tables that use it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.invoice_status AS ENUM (
      'draft',
      'pending_approval',
      'sent',
      'paid',
      'declined',
      'cancelled',
      'expired'
    );
  END IF;
END$$;

-- 2) Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 3) Invoices table (cleaner_id, client_id, approved_by match prod users.id type UUID)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_number text NOT NULL,
  cleaner_id uuid NOT NULL,
  client_id uuid NOT NULL,
  job_id uuid,
  subtotal_cents integer DEFAULT 0 NOT NULL,
  tax_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  total_credits integer DEFAULT 0 NOT NULL,
  status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
  title text,
  description text,
  notes_to_client text,
  requires_approval boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamp with time zone,
  denial_reason text,
  payment_intent_id text,
  paid_at timestamp with time zone,
  paid_via text,
  due_date date,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.invoices IS 'Cleaner-initiated invoices to clients';

-- 4) Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1 NOT NULL,
  unit_price_cents integer NOT NULL,
  total_cents integer NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.invoice_line_items IS 'Individual line items on an invoice';

-- 5) Invoice status history
CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  old_status public.invoice_status,
  new_status public.invoice_status NOT NULL,
  changed_by uuid,
  actor_type text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.invoice_status_history IS 'Audit trail for invoice status changes';

-- 6) Primary keys and unique constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_pkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_invoice_number_key') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_pkey') THEN
    ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_status_history_pkey') THEN
    ALTER TABLE public.invoice_status_history ADD CONSTRAINT invoice_status_history_pkey PRIMARY KEY (id);
  END IF;
END$$;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_cleaner ON public.invoices (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON public.invoices (job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_history_invoice ON public.invoice_status_history (invoice_id);

-- 8) Foreign keys (skip if constraint already exists to allow idempotent re-runs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_cleaner_id_fkey') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_client_id_fkey') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_job_id_fkey') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_approved_by_fkey') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_invoice_id_fkey') THEN
    ALTER TABLE public.invoice_line_items
      ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_status_history_invoice_id_fkey') THEN
    ALTER TABLE public.invoice_status_history
      ADD CONSTRAINT invoice_status_history_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_status_history_changed_by_fkey') THEN
    ALTER TABLE public.invoice_status_history
      ADD CONSTRAINT invoice_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END$$;
