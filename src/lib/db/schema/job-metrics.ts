import { integer, numeric, pgView, text, uuid } from "drizzle-orm/pg-core";

export const agentJobMetrics = pgView("agent_job_metrics", {
  tenantId: uuid("tenant_id"),
  jobId: uuid("job_id"),
  agentId: text("agent_id"),
  totalKeys: integer("total_keys"),
  editedKeys: integer("edited_keys"),
  accuracy: numeric("accuracy"),
}).existing();

export type AgentJobMetricsRow = typeof agentJobMetrics.$inferSelect;
