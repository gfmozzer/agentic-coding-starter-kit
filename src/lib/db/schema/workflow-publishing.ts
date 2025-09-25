import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workflowTemplates } from "./workflows";
import { tenants } from "./tenants";
import { user } from "./auth";

// Junction table for workflow template publishing to tenants
export const workflowTemplateTenants = pgTable(
  "workflow_template_tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowTemplateId: uuid("workflow_template_id")
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").default(false).notNull(),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    unpublishedAt: timestamp("unpublished_at"),
  },
  (table) => ({
    uniqueWorkflowTenantIdx: uniqueIndex("workflow_template_tenants_workflow_tenant_idx").on(
      table.workflowTemplateId,
      table.tenantId
    ),
    defaultWorkflowTenantIdx: uniqueIndex("workflow_template_tenants_default_idx")
      .on(table.workflowTemplateId)
      .where(sql`${table.unpublishedAt} IS NULL AND ${table.isDefault} = true`),
    tenantIdx: index("workflow_template_tenants_tenant_id_idx").on(table.tenantId),
    workflowIdx: index("workflow_template_tenants_workflow_template_id_idx").on(
      table.workflowTemplateId
    ),
  })
);

export type WorkflowTemplateTenant = typeof workflowTemplateTenants.$inferSelect;
export type CreateWorkflowTemplateTenant = typeof workflowTemplateTenants.$inferInsert;