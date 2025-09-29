"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobEvents } from "@/lib/db/schema/job-events";
import { jobs } from "@/lib/db/schema/jobs";
import { keyAudit } from "@/lib/db/schema/key-audit";
import { reviewGates } from "@/lib/db/schema/review-gates";
import { sendReviewApproval } from "@/lib/orchestration/n8n-client";

interface ReviewActionState {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
}

export const initialReviewActionState: ReviewActionState = {};

const submitSchema = z.object({
  jobId: z.string().uuid("Job invalido."),
  gateId: z.string().min(1, "Gate invalido."),
  keysReviewed: z.record(z.string()),
});

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function submitReviewAction(
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  try {
    const session = await getSessionContext();
    if (!session || session.role !== "operator" || !session.tenantId) {
      return { error: "Acesso nao autorizado." };
    }

    const jobId = formData.get("jobId");
    const gateId = formData.get("gateId");
    const keysReviewedRaw = formData.get("keysReviewed");

    let parsedKeys: Record<string, string> = {};
    if (typeof keysReviewedRaw === "string") {
      try {
        parsedKeys = JSON.parse(keysReviewedRaw) as Record<string, string>;
      } catch (error) {
        console.error("submitReviewAction keys parse", error);
        return {
          error: "Formato de campos invalido.",
          fieldErrors: { keysReviewed: "Nao foi possivel interpretar os valores enviados." },
        };
      }
    }

    const parsed = submitSchema.safeParse({
      jobId,
      gateId,
      keysReviewed: parsedKeys,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          fieldErrors[path] = issue.message;
        }
      }
      return {
        error: "Dados da revisao invalidos.",
        fieldErrors,
      };
    }

    const { jobId: jobIdValue, gateId: gateIdValue, keysReviewed } = parsed.data;

    const gateRow = await db
      .select({
        reviewGateId: reviewGates.id,
        tenantId: reviewGates.tenantId,
        jobId: reviewGates.jobId,
        status: reviewGates.status,
        keys: reviewGates.keys,
        keySources: reviewGates.keySources,
        existingReviewed: reviewGates.keysReviewed,
        jobTenantId: jobs.tenantId,
        jobStatus: jobs.status,
        jobResult: jobs.result,
      })
      .from(reviewGates)
      .innerJoin(jobs, eq(reviewGates.jobId, jobs.id))
      .where(and(eq(reviewGates.jobId, jobIdValue), eq(reviewGates.gateId, gateIdValue)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!gateRow || gateRow.jobTenantId !== session.tenantId) {
      return { error: "Revisao nao encontrada para este tenant." };
    }

    if (gateRow.status !== "pending") {
      return { error: "Gate ja processado ou indisponivel para revisao." };
    }

    const originalKeys = (gateRow.keys ?? {}) as Record<string, string>;
    const keySources = (gateRow.keySources ?? {}) as Record<string, string>;

    const diffEntries = Object.entries(keysReviewed).flatMap(([key, newValue]) => {
      const originalValue = originalKeys[key] ?? "";
      if (newValue === originalValue) {
        return [] as const;
      }
      return [
        {
          tenantId: session.tenantId,
          reviewGateId: gateRow.reviewGateId,
          jobId: jobIdValue,
          gateId: gateIdValue,
          keyName: key,
          oldValue: originalValue,
          newValue,
          sourceAgentId: keySources[key],
          editedBy: session.userId,
          editedAt: new Date(),
        },
      ];
    });

    try {
      await sendReviewApproval({
        tenant_id: session.tenantId,
        job_id: jobIdValue,
        gate_id: gateIdValue,
        keys_reviewed: keysReviewed,
      });
    } catch (error) {
      console.error("submitReviewAction sendReviewApproval", error);
      return {
        error: "Falha ao notificar orquestrador. Tente novamente em instantes.",
      };
    }

    const now = new Date();
    const resultRecord = toRecord(gateRow.jobResult);
    const reviewStates = toRecord(resultRecord.reviewGates);
    const gateState = toRecord(reviewStates[gateIdValue] ?? {});
    gateState.keys = originalKeys;
    gateState.keySources = keySources;
    gateState.keysReviewed = keysReviewed;
    gateState.reviewedAt = now.toISOString();
    reviewStates[gateIdValue] = gateState;
    resultRecord.reviewGates = reviewStates;

    await db.transaction(async (tx) => {
      if (diffEntries.length > 0) {
        await tx.insert(keyAudit).values(diffEntries);
      }

      await tx
        .update(reviewGates)
        .set({
          status: "approved",
          keysReviewed,
          reviewerId: session.userId,
          updatedAt: now,
          closedAt: now,
        })
        .where(eq(reviewGates.id, gateRow.reviewGateId));

      await tx
        .update(jobs)
        .set({
          status: "processing",
          currentGateId: null,
          result: resultRecord,
          updatedAt: now,
        })
        .where(eq(jobs.id, jobIdValue));

      await tx.insert(jobEvents).values({
        tenantId: session.tenantId,
        jobId: jobIdValue,
        eventType: "review_approved",
        payload: {
          gateId: gateIdValue,
          keysReviewed,
          diff: diffEntries.map((entry) => ({
            key: entry.keyName,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            sourceAgentId: entry.sourceAgentId,
          })),
        },
        createdAt: now,
      });
    });

    revalidatePath("/reviews");
    revalidatePath(`/reviews/${jobIdValue}/${gateIdValue}`);

    return {
      success: "Revisao enviada ao n8n com sucesso.",
    };
  } catch (error) {
    console.error("submitReviewAction error", error);
    return { error: "Nao foi possivel concluir a revisao." };
  }
}

