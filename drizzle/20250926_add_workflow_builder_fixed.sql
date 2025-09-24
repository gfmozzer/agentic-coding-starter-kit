CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "version" text DEFAULT 'v1' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT workflow_templates_name_version_idx UNIQUE ("name", "version")
);

CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE cascade,
  "type" text NOT NULL CHECK ("type" in ('agent','group','review_gate','translator','render')),
  "position" integer NOT NULL,
  "label" text,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE restrict,
  "source_step_id" text,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT workflow_steps_template_position_idx UNIQUE ("template_id", "position")
);

CREATE TABLE IF NOT EXISTS "workflow_step_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "step_id" text NOT NULL REFERENCES "workflow_steps"("id") ON DELETE cascade,
  "member_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE restrict,
  "position" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT workflow_step_groups_member_idx UNIQUE ("step_id", "member_agent_id"),
  CONSTRAINT workflow_step_groups_position_idx UNIQUE ("step_id", "position")
);

CREATE TABLE IF NOT EXISTS "workflow_step_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "step_id" text NOT NULL REFERENCES "workflow_steps"("id") ON DELETE cascade,
  "gate_key" text NOT NULL,
  "input_kind" text NOT NULL CHECK ("input_kind" in ('agent','group')),
  "title" text,
  "instructions" text,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT workflow_step_reviews_step_idx UNIQUE ("step_id")
);

CREATE INDEX IF NOT EXISTS workflow_step_reviews_gate_key_idx ON "workflow_step_reviews" ("gate_key");

CREATE TABLE IF NOT EXISTS "workflow_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "workflow_templates"("id") ON DELETE cascade,
  "changed_by" text REFERENCES "user"("id") ON DELETE set null,
  "diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_audit_template_idx ON "workflow_audit" ("template_id");

-- Add foreign key constraint after table creation to avoid circular dependency
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_steps_source_step_id_fkey' 
        AND table_name = 'workflow_steps'
    ) THEN
        ALTER TABLE "workflow_steps" 
        ADD CONSTRAINT workflow_steps_source_step_id_fkey 
        FOREIGN KEY ("source_step_id") REFERENCES "workflow_steps"("id") ON DELETE set null;
    END IF;
END $$;

ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "template_id" uuid REFERENCES "workflow_templates"("id") ON DELETE set null;