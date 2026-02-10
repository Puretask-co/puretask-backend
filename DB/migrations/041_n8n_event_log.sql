-- Idempotency and audit log for n8n event processing (backend → n8n).
-- Use when n8n uses Postgres for idempotency (Option B) per N8N_PACK_VERIFICATION.md.
-- See docs/active/N8N_PACK_VERIFICATION.md for usage and n8n INSERT/ON CONFLICT pattern.

create table if not exists n8n_event_log (
  id bigserial primary key,
  idempotency_key text not null unique,
  event_name text not null,
  job_id uuid null,
  received_at timestamptz not null default now(),
  source text not null default 'backend_to_n8n',
  status text not null default 'processed',
  workflow_name text null,
  message text null,
  payload jsonb not null
);

create index if not exists n8n_event_log_event_name_idx on n8n_event_log(event_name);
create index if not exists n8n_event_log_job_id_idx on n8n_event_log(job_id);
create index if not exists n8n_event_log_received_at_idx on n8n_event_log(received_at);
