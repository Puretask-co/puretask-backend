-- Migration 060: Add reviews, AI tables, worker_runs, Stripe idempotency (from test schema)
-- Production is canonical; these objects exist in test but not in prod.

-- 1) Reviews (reviewer_id, reviewee_id -> users.id TEXT in canonical schema)
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid NOT NULL,
  reviewer_id text NOT NULL,
  reviewee_id text NOT NULL,
  reviewer_type text NOT NULL,
  rating integer NOT NULL,
  comment text,
  is_public boolean DEFAULT true NOT NULL,
  response text,
  response_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_reviewer_type_check CHECK (reviewer_type IN ('client', 'cleaner'))
);

-- 2) AI activity log (actor_id -> users.id TEXT)
CREATE TABLE IF NOT EXISTS public.ai_activity_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id text NOT NULL,
  activity_type text NOT NULL,
  activity_description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3) AI performance metrics (cleaner_id -> users.id TEXT)
CREATE TABLE IF NOT EXISTS public.ai_performance_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  metric_date date NOT NULL,
  metric_type text NOT NULL,
  cleaner_id text,
  metric_value numeric NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4) AI suggestions (cleaner_id -> users.id TEXT)
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cleaner_id text NOT NULL,
  suggestion_type text NOT NULL,
  suggestion_data jsonb NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  feedback_rating integer,
  feedback_comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- 5) Worker runs (background job runs)
CREATE TABLE IF NOT EXISTS public.worker_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  worker_name text NOT NULL,
  status text DEFAULT 'running' NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  processed integer DEFAULT 0 NOT NULL,
  failed integer DEFAULT 0 NOT NULL,
  metadata jsonb,
  error_message text,
  lock_expires_at timestamp with time zone
);

-- 6) Stripe idempotency tables
CREATE TABLE IF NOT EXISTS public.stripe_events_processed (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  stripe_event_id text NOT NULL,
  stripe_object_id text,
  event_type text,
  status text DEFAULT 'processed' NOT NULL,
  processed_at timestamp with time zone DEFAULT now() NOT NULL,
  raw_payload jsonb
);

CREATE TABLE IF NOT EXISTS public.stripe_object_processed (
  object_id text NOT NULL,
  object_type text NOT NULL,
  processed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7) Primary keys and unique constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_pkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_job_id_key') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_job_id_key UNIQUE (job_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_activity_log_pkey') THEN
    ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_performance_metrics_pkey') THEN
    ALTER TABLE public.ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_performance_metrics_metric_date_metric_type_cleaner_id_key') THEN
    ALTER TABLE public.ai_performance_metrics
      ADD CONSTRAINT ai_performance_metrics_metric_date_metric_type_cleaner_id_key UNIQUE (metric_date, metric_type, cleaner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_suggestions_pkey') THEN
    ALTER TABLE public.ai_suggestions ADD CONSTRAINT ai_suggestions_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'worker_runs_pkey') THEN
    ALTER TABLE public.worker_runs ADD CONSTRAINT worker_runs_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_events_processed_pkey') THEN
    ALTER TABLE public.stripe_events_processed ADD CONSTRAINT stripe_events_processed_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_object_processed_pkey') THEN
    ALTER TABLE public.stripe_object_processed ADD CONSTRAINT stripe_object_processed_pkey PRIMARY KEY (object_id, object_type);
  END IF;
END$$;

-- 8) Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS idx_ai_activity_actor ON public.ai_activity_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_type ON public.ai_activity_log (activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_runs_name_started ON public.worker_runs (worker_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_runs_status ON public.worker_runs (status, started_at DESC);

-- 9) Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_job_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_reviewer_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_reviewee_id_fkey') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_activity_log_actor_id_fkey') THEN
    ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_performance_metrics_cleaner_id_fkey') THEN
    ALTER TABLE public.ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_suggestions_cleaner_id_fkey') THEN
    ALTER TABLE public.ai_suggestions ADD CONSTRAINT ai_suggestions_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;
