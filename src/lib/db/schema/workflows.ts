import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { agents } from "./agents";
import { user } from "./auth";
import { tenants } from "./tenants";
import { renderTemplates } from "./templates";

export type WorkflowStepType =
  | "agent"
  | "group"
  | "review_gate"
  | "translator"
  | "render";

export type WorkflowReviewInputKind = "agent" | "group";

export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    version: text("version").default("v1").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameVersionIdx: uniqueIndex("workflow_templates_name_version_idx").on(
      table.name,
      table.version
    ),
  })
);

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: text("id").primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<WorkflowStepType>()
      .notNull(),
    position: integer("position").notNull(),
    label: text("label"),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "restrict",
    }),
    renderTemplateId: uuid("render_template_id").references(() => renderTemplates.id, {
      onDelete: "restrict",
    }),
    sourceStepId: text("source_step_id"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    templatePositionIdx: uniqueIndex("workflow_steps_template_position_idx").on(
      table.templateId,
      table.position
    ),
    renderTemplateIdx: index("workflow_steps_render_template_idx").on(
      table.renderTemplateId
    ),
    renderTemplateCheck: check(
      "workflow_steps_render_template_check",
      sql`${table.type} <> 'render' OR ${table.renderTemplateId} IS NOT NULL`
    ),
  })
);

export const workflowStepGroups = pgTable(
  "workflow_step_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stepId: text("step_id")
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "cascade" }),
    memberAgentId: uuid("member_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    stepMemberIdx: uniqueIndex("workflow_step_groups_member_idx").on(
      table.stepId,
      table.memberAgentId
    ),
    stepPositionIdx: uniqueIndex("workflow_step_groups_position_idx").on(
      table.stepId,
      table.position
    ),
  })
);

export const workflowStepReviews = pgTable(
  "workflow_step_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stepId: text("step_id")
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "cascade" }),
    gateKey: text("gate_key").notNull(),
    inputKind: text("input_kind")
      .$type<WorkflowReviewInputKind>()
      .notNull(),
    title: text("title"),
    instructions: text("instructions"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    stepUniqueIdx: uniqueIndex("workflow_step_reviews_step_idx").on(table.stepId),
    gateKeyIdx: uniqueIndex("workflow_step_reviews_gate_key_idx").on(
      table.gateKey
    ),
  })
);

export const workflowAudit = pgTable(
  "workflow_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    diff: jsonb("diff")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    templateIdx: uniqueIndex("workflow_audit_template_idx").on(table.templateId, table.createdAt),
  })
);

export type TenantWorkflowStatus = "draft" | "ready";

export const tenantWorkflows = pgTable(
  "tenant_workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowTemplateId: uuid("workflow_template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    version: text("version").default("v1").notNull(),
    status: text("status")
      .$type<TenantWorkflowStatus>()
      .default("draft")
      .notNull(),
    llmTokenRefDefault: text("llm_token_ref_default"),
    clonedBy: text("cloned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    clonedAt: timestamp("cloned_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantNameIdx: uniqueIndex("tenant_workflows_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
    templateIdx: index("tenant_workflows_template_idx").on(
      table.workflowTemplateId
    ),
    tenantIdx: index("tenant_workflows_tenant_idx").on(table.tenantId),
    statusCheck: check(
      "tenant_workflows_status_check",
      sql`${table.status} in ('draft', 'ready')`
    ),
  })
);

export const tenantWorkflowSteps = pgTable(
  "tenant_workflow_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantWorkflowId: uuid("tenant_workflow_id")
      .notNull()
      .references(() => tenantWorkflows.id, { onDelete: "cascade" }),
    templateStepId: text("template_step_id")
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<WorkflowStepType>()
      .notNull(),
    position: integer("position").notNull(),
    label: text("label"),
    sourceStepId: text("source_step_id"),
    systemPromptOverride: text("system_prompt_override"),
    llmProviderOverride: text("llm_provider_override"),
    llmTokenRefOverride: text("llm_token_ref_override"),
    renderHtmlOverride: text("render_html_override"),
    configOverride: jsonb("config_override")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantWorkflowIdx: index("tenant_workflow_steps_tenant_workflow_idx").on(
      table.tenantWorkflowId
    ),
    templateIdx: index("tenant_workflow_steps_template_idx").on(
      table.templateStepId
    ),
    tenantWorkflowTemplateUniqueIdx: uniqueIndex(
      "tenant_workflow_steps_unique_idx"
    ).on(table.tenantWorkflowId, table.templateStepId),
  })
);

export type TenantWorkflow = typeof tenantWorkflows.$inferSelect;
export type CreateTenantWorkflow = typeof tenantWorkflows.$inferInsert;
export type TenantWorkflowStep = typeof tenantWorkflowSteps.$inferSelect;
export type CreateTenantWorkflowStep = typeof tenantWorkflowSteps.$inferInsert;
export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => workflowTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    version: text("version").default("v1").notNull(),
    isGlobal: boolean("is_global").default(false).notNull(),
    definition: jsonb("definition")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantNameVersionIdx: uniqueIndex("workflows_tenant_name_version_idx").on(
      table.tenantId,
      table.name,
      table.version
    ),
  })
);



