-- Update agents table to global catalog and add audit trail
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_tenant_id_tenants_id_fk";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "temperature";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "system_message";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "output_type";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "webhook_url";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "token_ref_override";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "responsible_keys";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "metadata";

ALTER TABLE "agents" RENAME COLUMN "type" TO "kind";
ALTER TABLE "agents" RENAME COLUMN "model" TO "default_model";
ALTER TABLE "agents" RENAME COLUMN "provider" TO "default_provider";

ALTER TABLE "agents" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "system_prompt" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "default_provider" SET DEFAULT 'openai';
ALTER TABLE "agents" ALTER COLUMN "default_model" SET DEFAULT 'gpt-4.1-mini';
ALTER TABLE "agents" ALTER COLUMN "default_provider" SET NOT NULL;
ALTER TABLE "agents" ALTER COLUMN "default_model" SET NOT NULL;

ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "input_example" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "output_schema_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "agents" ALTER COLUMN "output_schema_json" SET NOT NULL;

DROP INDEX IF EXISTS "agents_tenant_name_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "agents_kind_name_idx" ON "agents" ("kind", "name");

-- Remove tenant-based RLS policy from agents
DROP POLICY IF EXISTS tenant_isolation ON "agents";
ALTER TABLE "agents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "agents" NO FORCE ROW LEVEL SECURITY;

-- Audit table to track agent changes
CREATE TABLE IF NOT EXISTS "agent_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "public"."agents"("id") ON DELETE cascade,
  "changed_by" text REFERENCES "public"."user"("id") ON DELETE set null,
  "diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_audit_agent_idx" ON "agent_audit" ("agent_id");
