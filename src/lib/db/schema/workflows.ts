import { sql } from "drizzle-orm";
import {
  boolean,
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
