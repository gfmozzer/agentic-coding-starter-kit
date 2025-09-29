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

import { user } from "./auth";
import { jobs } from "./jobs";
import { tenants } from "./tenants";

export type ReviewGateStatus = "pending" | "in_review" | "approved" | "rejected";

export interface ReviewGatePayload {
  keys: Record<string, string>;
  keySources: Record<string, string>;
  keysTranslated?: Record<string, string> | null;
  pages: string[];
  context?: Record<string, unknown> | null;
}

export const reviewGates = pgTable(
  "review_gates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    gateId: text("gate_id").notNull(),
    inputKind: text("input_kind").notNull(),
    refId: text("ref_id").notNull(),
    status: text("status")
      .$type<ReviewGateStatus>()
      .default("pending")
      .notNull(),
    keys: jsonb("keys")
      .$type<Record<string, string>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    keySources: jsonb("key_sources")
      .$type<Record<string, string>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    keysTranslated: jsonb("keys_translated")
      .$type<Record<string, string> | null>()
      .default(sql`NULL`),
    keysReviewed: jsonb("keys_reviewed")
      .$type<Record<string, string> | null>()
      .default(sql`NULL`),
    pages: jsonb("pages")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    context: jsonb("context")
      .$type<Record<string, unknown> | null>()
      .default(sql`NULL`),
    reviewerId: text("reviewer_id").references(() => user.id, {
      onDelete: "set null",
    }),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    tenantIdx: index("review_gates_tenant_idx").on(table.tenantId),
    jobIdx: index("review_gates_job_idx").on(table.jobId),
    statusIdx: index("review_gates_status_idx").on(table.status),
    jobGateUniqueIdx: uniqueIndex("review_gates_job_gate_unique_idx").on(
      table.jobId,
      table.gateId
    ),
  })
);

export type ReviewGate = typeof reviewGates.$inferSelect;
export type CreateReviewGate = typeof reviewGates.$inferInsert;

