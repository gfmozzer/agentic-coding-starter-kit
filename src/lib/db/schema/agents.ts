import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

export type AgentKind = "ocr" | "structured" | "translator" | "render";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    kind: text("kind")
      .$type<AgentKind>()
      .notNull(),
    systemPrompt: text("system_prompt").notNull(),
    inputExample: text("input_example"),
    outputSchemaJson: jsonb("output_schema_json")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    defaultProvider: text("default_provider")
      .default("openai")
      .notNull(),
    defaultModel: text("default_model")
      .default("gpt-4.1-mini")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    kindNameIdx: uniqueIndex("agents_kind_name_idx").on(table.kind, table.name),
  })
);

export const agentAudit = pgTable(
  "agent_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
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
    agentIdx: index("agent_audit_agent_idx").on(table.agentId),
  })
);

export const tenantAgents = pgTable(
  "tenant_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceAgentId: uuid("source_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    provider: text("provider"),
    tokenRef: text("token_ref"),
    systemPrompt: text("system_prompt"),
    systemMessage: text("system_message"),
    overrides: jsonb("overrides")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantSourceIdx: uniqueIndex("tenant_agents_source_idx").on(
      table.tenantId,
      table.sourceAgentId
    ),
  })
);
