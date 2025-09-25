-- Link workflow render steps to render_templates and enforce constraints
ALTER TABLE "workflow_steps"
  ADD COLUMN "render_template_id" uuid;

ALTER TABLE "workflow_steps"
  ADD CONSTRAINT "workflow_steps_render_template_id_fkey"
    FOREIGN KEY ("render_template_id")
    REFERENCES "render_templates"("id")
    ON DELETE RESTRICT;

-- Backfill new column from existing config when possible
UPDATE "workflow_steps"
SET "render_template_id" = (config ->> 'templateId')::uuid
WHERE "type" = 'render'
  AND config ? 'templateId'
  AND (config ->> 'templateId') ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$';

-- Remove deprecated templateId key from JSON config
UPDATE "workflow_steps"
SET config = config - 'templateId'
WHERE "type" = 'render'
  AND config ? 'templateId';

-- Ensure render steps always reference a template
ALTER TABLE "workflow_steps"
  ADD CONSTRAINT "workflow_steps_render_template_check"
  CHECK ("type" <> 'render' OR "render_template_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "workflow_steps_render_template_idx"
  ON "workflow_steps"("render_template_id");

-- Guarantee a single default tenant per workflow template (active publications only)
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_template_tenants_default_idx"
  ON "workflow_template_tenants"("workflow_template_id")
  WHERE "unpublished_at" IS NULL AND "is_default" = true;
