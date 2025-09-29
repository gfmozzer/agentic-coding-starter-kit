import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema/jobs";
import { keyAudit } from "@/lib/db/schema/key-audit";
import { reviewGates } from "@/lib/db/schema/review-gates";
import { workflows } from "@/lib/db/schema/workflows";
import type { ReviewFieldState, ReviewAuditEntry } from "@/lib/reviews/types";

import ReviewDetailClient from "./review-detail-client";

interface PageProps {
  params: { jobId: string; gateId: string };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    notFound();
  }

  const { jobId, gateId } = params;

  const record = await db
    .select({
      reviewGateId: reviewGates.id,
      jobId: reviewGates.jobId,
      gateId: reviewGates.gateId,
      status: reviewGates.status,
      inputKind: reviewGates.inputKind,
      refId: reviewGates.refId,
      keys: reviewGates.keys,
      keySources: reviewGates.keySources,
      keysTranslated: reviewGates.keysTranslated,
      keysReviewed: reviewGates.keysReviewed,
      pages: reviewGates.pages,
      context: reviewGates.context,
      updatedAt: reviewGates.updatedAt,
      workflowName: workflows.name,
      jobStatus: jobs.status,
      jobResult: jobs.result,
    })
    .from(reviewGates)
    .innerJoin(jobs, eq(reviewGates.jobId, jobs.id))
    .innerJoin(workflows, eq(jobs.workflowId, workflows.id))
    .where(
      and(
        eq(reviewGates.jobId, jobId),
        eq(reviewGates.gateId, gateId),
        eq(jobs.tenantId, session.tenantId)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!record) {
    notFound();
  }

  const originalKeys = (record.keys ?? {}) as Record<string, string>;
  const keySources = (record.keySources ?? {}) as Record<string, string>;
  const reviewedKeys = (record.keysReviewed ?? {}) as Record<string, string>;

  const fields: ReviewFieldState[] = Object.entries(originalKeys)
    .map(([key, originalValue]) => {
      const value = reviewedKeys[key] ?? originalValue;
      return {
        key,
        originalValue,
        value,
        sourceAgentId: keySources[key],
        edited: value !== originalValue,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const auditRows = await db
    .select({
      id: keyAudit.id,
      keyName: keyAudit.keyName,
      oldValue: keyAudit.oldValue,
      newValue: keyAudit.newValue,
      sourceAgentId: keyAudit.sourceAgentId,
      editedBy: keyAudit.editedBy,
      editedAt: keyAudit.editedAt,
    })
    .from(keyAudit)
    .where(eq(keyAudit.reviewGateId, record.reviewGateId))
    .orderBy(desc(keyAudit.editedAt));

  const auditTrail: ReviewAuditEntry[] = auditRows.map((entry) => ({
    id: entry.id,
    key: entry.keyName,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    sourceAgentId: entry.sourceAgentId,
    editedBy: entry.editedBy,
    editedAt: entry.editedAt.toISOString(),
  }));

  const pages = (record.pages ?? []) as string[];
  const keysTranslated = (record.keysTranslated ?? undefined) as Record<string, string> | undefined;
  const context = toRecord(record.context ?? undefined);

  return (
    <ReviewDetailClient
      jobId={record.jobId}
      gateId={record.gateId}
      workflowName={record.workflowName}
      jobStatus={record.jobStatus}
      status={record.status}
      updatedAt={record.updatedAt.toISOString()}
      inputKind={record.inputKind}
      refId={record.refId}
      fields={fields}
      pages={pages}
      keysTranslated={keysTranslated}
      context={context}
      auditTrail={auditTrail}
    />
  );
}

