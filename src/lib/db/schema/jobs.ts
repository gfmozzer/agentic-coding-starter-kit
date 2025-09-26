import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents, tenantAgents } from "./agents";
import { tenants } from "./tenants";
import { workflows } from "./workflows";
import { user } from "./auth";

export type JobStatus =
  | "queued"
  | "processing"
  | "review"
  | "review:gate"
  | "translating"
  | "done"
  | "failed";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<JobStatus>()
      .default("queued")
      .notNull(),
    sourcePdfUrl: text("source_pdf_url").notNull(),
    pageImages: jsonb("page_images_json")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    result: jsonb("result")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    currentGateId: text("current_gate_id"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    tenantIdx: index("jobs_tenant_idx").on(table.tenantId),
    workflowIdx: index("jobs_workflow_idx").on(table.workflowId),
  })
);

export type JobStepStatus =
  | "queued"
  | "processing"
  | "waiting_review"
  | "completed"
  | "failed";

export const jobSteps = pgTable(
  "job_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    nodeType: text("node_type").notNull(),
    status: text("status")
      .$type<JobStepStatus>()
      .default("queued")
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    tenantAgentId: uuid("tenant_agent_id").references(() => tenantAgents.id, {
      onDelete: "set null",
    }),
    output: jsonb("output")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("job_steps_tenant_idx").on(table.tenantId),
    jobIdx: index("job_steps_job_idx").on(table.jobId),
  })
);

export const jobFiles = pgTable(
  "job_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type"),
    byteSize: bigint("byte_size", { mode: "number" }),
    checksum: text("checksum"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("job_files_tenant_idx").on(table.tenantId),
    jobIdx: index("job_files_job_idx").on(table.jobId),
  })
);

export type ReviewSessionStatus = "pending" | "in_review" | "approved" | "rejected";

export const reviewSessions = pgTable(
  "review_sessions",
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
    keysPayload: jsonb("keys_payload")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: text("status")
      .$type<ReviewSessionStatus>()
      .default("pending")
      .notNull(),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    reviewerId: text("reviewer_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    tenantIdx: index("review_sessions_tenant_idx").on(table.tenantId),
    jobIdx: index("review_sessions_job_idx").on(table.jobId),
  })
);

export const keyAudit = pgTable(
  "key_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reviewSessionId: uuid("review_session_id")
      .notNull()
      .references(() => reviewSessions.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    sourceAgentId: uuid("source_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    editedBy: text("edited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("key_audit_tenant_idx").on(table.tenantId),
    sessionIdx: index("key_audit_session_idx").on(table.reviewSessionId),
  })
);
