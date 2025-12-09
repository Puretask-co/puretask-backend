-- 023_cleaner_portal_invoicing.sql
-- Cleaner Portal: Previous Clients + Invoicing Module

-- ============================================
-- CLEANER CLIENT NOTES
-- Private notes cleaners keep about their clients
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_client_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes           TEXT,
  preferences     TEXT,  -- Pet info, parking, entry instructions
  is_favorite     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cleaner_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_client_notes_cleaner ON cleaner_client_notes(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_client_notes_client ON cleaner_client_notes(client_id);

-- ============================================
-- INVOICES
-- Cleaner-initiated invoices to clients
-- ============================================

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'pending_approval',  -- Waiting admin approval if over threshold
  'sent',              -- Sent to client, awaiting payment
  'paid',
  'declined',          -- Client declined
  'cancelled',         -- Cleaner cancelled
  'expired'            -- Auto-expired after X days
);

CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number      TEXT NOT NULL UNIQUE,
  cleaner_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,  -- Optional: link to specific job
  
  -- Amounts
  subtotal_cents      INTEGER NOT NULL DEFAULT 0,
  tax_cents           INTEGER NOT NULL DEFAULT 0,
  total_cents         INTEGER NOT NULL DEFAULT 0,
  total_credits       INTEGER NOT NULL DEFAULT 0,  -- Calculated from cents
  
  -- Status
  status              invoice_status NOT NULL DEFAULT 'draft',
  
  -- Descriptions
  title               TEXT,
  description         TEXT,
  notes_to_client     TEXT,
  
  -- Admin approval (if required)
  requires_approval   BOOLEAN DEFAULT false,
  approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  denial_reason       TEXT,
  
  -- Payment
  payment_intent_id   TEXT,
  paid_at             TIMESTAMPTZ,
  paid_via            TEXT,  -- 'credits' or 'card'
  
  -- Expiry
  due_date            DATE,
  expires_at          TIMESTAMPTZ,
  
  -- Metadata
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_cleaner ON invoices(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ============================================
-- INVOICE LINE ITEMS
-- Individual items on an invoice
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents     INTEGER NOT NULL,  -- quantity * unit_price_cents
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================
-- INVOICE STATUS HISTORY
-- Audit trail for invoice status changes
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  old_status      invoice_status,
  new_status      invoice_status NOT NULL,
  changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type      TEXT NOT NULL,  -- 'cleaner', 'client', 'admin', 'system'
  reason          TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_status_history_invoice ON invoice_status_history(invoice_id);

-- ============================================
-- CLEANER CLIENT SUMMARY VIEW
-- Aggregated view of cleaner-client relationships
-- ============================================

CREATE OR REPLACE VIEW cleaner_client_summary AS
SELECT 
  j.cleaner_id,
  j.client_id,
  u.email AS client_email,
  u.first_name AS client_first_name,
  u.last_name AS client_last_name,
  cp.phone AS client_phone,
  
  -- Job stats
  COUNT(DISTINCT j.id) AS jobs_completed,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS jobs_successful,
  SUM(EXTRACT(EPOCH FROM (j.actual_end_at - j.actual_start_at)) / 3600) AS total_hours_worked,
  MAX(j.scheduled_start_at) AS last_job_date,
  MIN(j.scheduled_start_at) AS first_job_date,
  
  -- Earnings
  COALESCE(SUM(p.amount_cents), 0) AS total_earnings_cents,
  
  -- Addresses
  ARRAY_AGG(DISTINCT j.address) FILTER (WHERE j.address IS NOT NULL) AS addresses_serviced,
  
  -- Most common address
  MODE() WITHIN GROUP (ORDER BY j.address) AS primary_address,
  
  -- Client indicators (sanitized)
  CASE 
    WHEN crs.risk_band IN ('normal', 'mild') THEN 'reliable'
    WHEN crs.risk_band = 'elevated' THEN 'may_need_confirmation'
    ELSE 'caution'
  END AS client_indicator,
  
  -- Favorites
  COALESCE(ccn.is_favorite, false) AS is_favorite,
  ccn.notes AS cleaner_notes,
  ccn.preferences AS cleaner_preferences
  
FROM jobs j
JOIN users u ON u.id = j.client_id
LEFT JOIN client_profiles cp ON cp.user_id = j.client_id
LEFT JOIN payouts p ON p.job_id = j.id AND p.cleaner_id = j.cleaner_id
LEFT JOIN client_risk_scores crs ON crs.client_id = j.client_id
LEFT JOIN cleaner_client_notes ccn ON ccn.cleaner_id = j.cleaner_id AND ccn.client_id = j.client_id

WHERE j.cleaner_id IS NOT NULL
  AND j.status IN ('completed', 'awaiting_approval')

GROUP BY 
  j.cleaner_id, 
  j.client_id, 
  u.email, 
  u.first_name, 
  u.last_name,
  cp.phone,
  crs.risk_band,
  ccn.is_favorite,
  ccn.notes,
  ccn.preferences;

-- ============================================
-- INVOICE NUMBER SEQUENCE
-- For generating sequential invoice numbers
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- ============================================
-- HELPER FUNCTION: Generate Invoice Number
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONFIGURATION
-- ============================================

-- Invoice approval threshold (in cents) - invoices over this require admin approval
-- Default: $100 = 10000 cents
INSERT INTO feature_flags (key, value, description)
VALUES ('INVOICE_APPROVAL_THRESHOLD_CENTS', '10000', 'Invoices over this amount require admin approval')
ON CONFLICT (key) DO NOTHING;

-- Invoice expiry days
INSERT INTO feature_flags (key, value, description)
VALUES ('INVOICE_EXPIRY_DAYS', '30', 'Days until unpaid invoice expires')
ON CONFLICT (key) DO NOTHING;

-- Tax rate (percentage * 100, e.g., 8.25% = 825)
INSERT INTO feature_flags (key, value, description)
VALUES ('INVOICE_TAX_RATE_BPS', '0', 'Tax rate in basis points (0 = no tax)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE cleaner_client_notes IS 'Private notes cleaners keep about their clients';
COMMENT ON TABLE invoices IS 'Cleaner-initiated invoices to clients';
COMMENT ON TABLE invoice_line_items IS 'Individual line items on an invoice';
COMMENT ON TABLE invoice_status_history IS 'Audit trail for invoice status changes';
COMMENT ON VIEW cleaner_client_summary IS 'Aggregated view of cleaner-client relationships for the cleaner portal';

