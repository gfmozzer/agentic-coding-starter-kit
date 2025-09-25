-- Tenant workflow clone tables for operator overrides
CREATE TABLE "tenant_workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workflow_template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "description" text,
  "version" text NOT NULL DEFAULT 'v1',
  "status" text NOT NULL DEFAULT 'draft',
  "llm_token_ref_default" text,
  "cloned_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "cloned_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_workflows_status_check" CHECK ("status" in ('draft', 'ready'))
);

CREATE UNIQUE INDEX "tenant_workflows_tenant_name_idx" ON "tenant_workflows" ("tenant_id", "name");
CREATE INDEX "tenant_workflows_template_idx" ON "tenant_workflows" ("workflow_template_id");
CREATE INDEX "tenant_workflows_tenant_idx" ON "tenant_workflows" ("tenant_id");

CREATE TABLE "tenant_workflow_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_workflow_id" uuid NOT NULL REFERENCES "tenant_workflows"("id") ON DELETE CASCADE,
  "template_step_id" text NOT NULL REFERENCES "workflow_steps"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "position" integer NOT NULL,
  "label" text,
  "source_step_id" text,
  "system_prompt_override" text,
  "llm_provider_override" text,
  "llm_token_ref_override" text,
  "render_html_override" text,
  "config_override" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_workflow_steps_type_check" CHECK ("type" in ('agent', 'group', 'review_gate', 'translator', 'render'))
);

CREATE UNIQUE INDEX "tenant_workflow_steps_unique_idx" ON "tenant_workflow_steps" ("tenant_workflow_id", "template_step_id");
CREATE INDEX "tenant_workflow_steps_tenant_workflow_idx" ON "tenant_workflow_steps" ("tenant_workflow_id");
CREATE INDEX "tenant_workflow_steps_template_idx" ON "tenant_workflow_steps" ("template_step_id");
