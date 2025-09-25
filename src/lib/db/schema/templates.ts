import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    version: text("version").default("v1").notNull(),
    html: text("html").notNull(),
    variables: jsonb("variables")
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
    tenantNameVersionIdx: uniqueIndex("templates_tenant_name_version_idx").on(
      table.tenantId,
      table.name,
      table.version
    ),
  })
);

// Global render templates managed by super-admin
export const renderTemplates = pgTable("render_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  html: text("html").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RenderTemplate = typeof renderTemplates.$inferSelect;
export type CreateRenderTemplate = typeof renderTemplates.$inferInsert;