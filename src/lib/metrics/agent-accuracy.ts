import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentJobMetrics } from "@/lib/db/schema/job-metrics";

import type { AgentJobMetric } from "./types";

export interface CalculateAgentAccuracyInput {
  tenantId: string;
  jobId: string;
}

export function computeAccuracy(totalKeys: number, editedKeys: number): number {
  if (totalKeys <= 0) {
    return editedKeys > 0 ? 0 : 1;
  }
  const ratio = 1 - editedKeys / totalKeys;
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  if (ratio < 0) {
    return 0;
  }
  if (ratio > 1) {
    return 1;
  }
  return Number(ratio);
}

export async function calculateAgentAccuracy({
  tenantId,
  jobId,
}: CalculateAgentAccuracyInput): Promise<AgentJobMetric[]> {
  const rows = await db
    .select({
      agentId: agentJobMetrics.agentId,
      totalKeys: agentJobMetrics.totalKeys,
      editedKeys: agentJobMetrics.editedKeys,
    })
    .from(agentJobMetrics)
    .where(and(eq(agentJobMetrics.tenantId, tenantId), eq(agentJobMetrics.jobId, jobId)))
    .orderBy(asc(agentJobMetrics.agentId));

  return rows.map((row) => {
    const totalKeys = row.totalKeys ?? 0;
    const editedKeys = row.editedKeys ?? 0;
    return {
      agentId: row.agentId ?? "",
      totalKeys,
      editedKeys,
      accuracy: computeAccuracy(totalKeys, editedKeys),
    } satisfies AgentJobMetric;
  });
}
