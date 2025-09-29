import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { jobs } from "./jobs";
import { reviewGates } from "./review-gates";
import { tenants } from "./tenants";

export const keyAudit = pgTable(
  "key_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewGateId: uuid("review_gate_id")
      .notNull()
      .references(() => reviewGates.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    gateId: text("gate_id").notNull(),
    keyName: text("key_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    sourceAgentId: text("source_agent_id"),
    editedBy: text("edited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    editedAt: timestamp("edited_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("key_audit_tenant_idx").on(table.tenantId),
    reviewGateIdx: index("key_audit_review_gate_idx").on(table.reviewGateId),
    jobIdx: index("key_audit_job_idx").on(table.jobId),
  })
);

export type KeyAuditEntry = typeof keyAudit.$inferSelect;
export type CreateKeyAuditEntry = typeof keyAudit.$inferInsert;

