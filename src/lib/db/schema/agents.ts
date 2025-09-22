import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export type AgentOutputType = "structured" | "text" | "html";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    model: text("model"),
    temperature: numeric("temperature", { precision: 3, scale: 2 })
      .default(sql`0`)
      .notNull(),
    systemPrompt: text("system_prompt"),
    systemMessage: text("system_message"),
    provider: text("provider"),
    outputType: text("output_type")
      .$type<AgentOutputType>()
      .default("structured")
      .notNull(),
    webhookUrl: text("webhook_url"),
    tokenRefOverride: text("token_ref_override"),
    responsibleKeys: jsonb("responsible_keys")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantNameIdx: index("agents_tenant_name_idx").on(table.tenantId, table.name),
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