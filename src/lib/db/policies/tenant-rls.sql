-- Tenant isolation policies for multi-tenant tables
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_agents FORCE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE job_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE job_files FORCE ROW LEVEL SECURITY;
ALTER TABLE review_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE key_audit FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'tenant_members',
      'agents',
      'tenant_agents',
      'templates',
      'workflows',
      'jobs',
      'job_steps',
      'job_files',
      'review_sessions',
      'key_audit'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting(''app.tenant_id'')::uuid)
        WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid);
    ', tbl, tbl);
  END LOOP;
END $$;