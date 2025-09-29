-- Restructures review storage replacing review_sessions with review_gates and new key_audit shape.
DROP TABLE IF EXISTS review_sessions CASCADE;
DROP TABLE IF EXISTS key_audit CASCADE;

CREATE TABLE IF NOT EXISTS review_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  gate_id text NOT NULL,
  input_kind text NOT NULL,
  ref_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  key_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  keys_translated jsonb,
  keys_reviewed jsonb,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb,
  reviewer_id text REFERENCES "user"(id) ON DELETE SET NULL,
  opened_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  closed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS review_gates_job_gate_unique_idx ON review_gates (job_id, gate_id);
CREATE INDEX IF NOT EXISTS review_gates_tenant_idx ON review_gates (tenant_id);
CREATE INDEX IF NOT EXISTS review_gates_job_idx ON review_gates (job_id);
CREATE INDEX IF NOT EXISTS review_gates_status_idx ON review_gates (status);

ALTER TABLE review_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_gates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON review_gates;
CREATE POLICY tenant_isolation ON review_gates
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS key_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_gate_id uuid NOT NULL REFERENCES review_gates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  gate_id text NOT NULL,
  key_name text NOT NULL,
  old_value text,
  new_value text,
  source_agent_id text,
  edited_by text REFERENCES "user"(id) ON DELETE SET NULL,
  edited_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS key_audit_tenant_idx ON key_audit (tenant_id);
CREATE INDEX IF NOT EXISTS key_audit_review_gate_idx ON key_audit (review_gate_id);
CREATE INDEX IF NOT EXISTS key_audit_job_idx ON key_audit (job_id);

ALTER TABLE key_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON key_audit;
CREATE POLICY tenant_isolation ON key_audit
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
