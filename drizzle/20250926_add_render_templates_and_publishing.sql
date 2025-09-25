-- Add render templates table for super-admin managed HTML templates
CREATE TABLE "render_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "html" text NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add workflow template publishing junction table
CREATE TABLE "workflow_template_tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "is_default" boolean DEFAULT false NOT NULL,
  "published_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "published_at" timestamp DEFAULT now() NOT NULL,
  "unpublished_at" timestamp
);

-- Add unique constraint to prevent duplicate publications
CREATE UNIQUE INDEX "workflow_template_tenants_workflow_tenant_idx" ON "workflow_template_tenants"("workflow_template_id", "tenant_id");

-- Add index for tenant queries
CREATE INDEX "workflow_template_tenants_tenant_id_idx" ON "workflow_template_tenants"("tenant_id");

-- Add index for workflow template queries
CREATE INDEX "workflow_template_tenants_workflow_template_id_idx" ON "workflow_template_tenants"("workflow_template_id");