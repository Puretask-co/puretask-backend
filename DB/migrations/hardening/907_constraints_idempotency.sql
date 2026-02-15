-- 907_constraints_idempotency.sql
-- Section 5: Additive constraints for idempotency and data integrity.
-- Safe to run on existing DBs. 042 and 906 already define key constraints; this adds comments.

-- idempotency_keys: 039 defines the table. Ensure comment reflects Section 7 usage.
COMMENT ON TABLE idempotency_keys IS 'Section 7: Idempotency-Key header storage; 24h TTL per policy';

-- webhook_events: 042 defines UNIQUE(provider, event_id). No schema change needed.
-- durable_jobs: 906 defines uniq_durable_jobs_type_key and chk_durable_jobs_status. No schema change needed.

