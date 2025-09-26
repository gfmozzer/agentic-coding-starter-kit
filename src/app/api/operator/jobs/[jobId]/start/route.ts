import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobEvents } from "@/lib/db/schema/job-events";
import { jobs } from "@/lib/db/schema/jobs";
import { tenantWorkflows, workflows } from "@/lib/db/schema/workflows";
import { triggerWorkflow } from "@/lib/orchestration/n8n-client";
import type { N8NStartPayload } from "@/lib/orchestration/types";

const paramsSchema = z.object({
  jobId: z.string().uuid("Job invalido."),
});

const STARTABLE_STATUSES = ["queued", "processing"] as const;
const STARTABLE_STATUS_SET = new Set<string>(STARTABLE_STATUSES);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function trimToNull(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveWorkflowProvider(definition: Record<string, unknown>): string | null {
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  for (const step of steps) {
    if (!step || typeof step !== "object") {
      continue;
    }
    const llm = (step as Record<string, unknown>).llm;
    if (!llm || typeof llm !== "object") {
      continue;
    }
    const provider = trimToNull((llm as Record<string, unknown>).provider as string | undefined);
    if (provider) {
      return provider;
    }
  }
  return null;
}

function resolveMetadata(jobResult: Record<string, unknown> | null | undefined) {
  const record = toRecord(jobResult);
  const metadata = record.metadata;
  return toRecord(metadata);
}

export async function POST(_request: NextRequest, context: { params: { jobId: string } }) {
  const session = await getSessionContext();
  if (!session || !session.tenantId) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (session.role !== "operator") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.issues[0]?.message ?? "Parametros invalidos." }, { status: 400 });
  }

  const { jobId } = parsedParams.data;

  const row = await db
    .select({
      id: jobs.id,
      tenantId: jobs.tenantId,
      status: jobs.status,
      workflowId: jobs.workflowId,
      sourcePdfUrl: jobs.sourcePdfUrl,
      result: jobs.result,
      startedAt: jobs.startedAt,
      workflowDefinition: workflows.definition,
    })
    .from(jobs)
    .innerJoin(workflows, eq(workflows.id, jobs.workflowId))
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, session.tenantId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  }

  if (!STARTABLE_STATUS_SET.has(row.status)) {
    return NextResponse.json({ error: "Job nao esta aguardando execucao." }, { status: 409 });
  }

  if (row.startedAt) {
    return NextResponse.json({ error: "Job ja foi iniciado." }, { status: 409 });
  }

  const definition = toRecord(row.workflowDefinition);
  const tenantWorkflowId = trimToNull(definition.tenantWorkflowId as string | null | undefined);
  const definitionToken = trimToNull(definition.defaultToken as string | null | undefined);

  let llmToken = definitionToken;
  if (tenantWorkflowId) {
    const tenantWorkflow = await db
      .select({ token: tenantWorkflows.llmTokenRefDefault })
      .from(tenantWorkflows)
      .where(and(eq(tenantWorkflows.id, tenantWorkflowId), eq(tenantWorkflows.tenantId, session.tenantId)))
      .limit(1)
      .then((rows) => rows[0]);
    llmToken = trimToNull(tenantWorkflow?.token ?? llmToken ?? null);
  }

  if (!llmToken) {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({ error: "Workflow sem token padrao.", updatedAt: now })
        .where(eq(jobs.id, jobId));
      await tx.insert(jobEvents).values({
        tenantId: row.tenantId,
        jobId: row.id,
        eventType: "job_start_blocked",
        payload: {
          reason: "missing_llm_token",
          workflowId: row.workflowId,
          tenantWorkflowId,
        },
        createdAt: now,
      });
    });

    return NextResponse.json(
      { error: "Configure o token padrao do workflow antes de iniciar o job." },
      { status: 422 }
    );
  }

  const provider = resolveWorkflowProvider(definition) ?? "openai";
  const metadata = resolveMetadata(row.result);

  const startPayload: N8NStartPayload = {
    tenant_id: row.tenantId,
    job_id: row.id,
    workflow_id: tenantWorkflowId ?? row.workflowId,
    pdf_url: row.sourcePdfUrl,
    llm: {
      provider,
      token_ref: llmToken,
    },
    metadata,
  };

  try {
    await triggerWorkflow(startPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao comunicar com n8n.";
    console.error("n8n triggerWorkflow", error);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({ error: message, updatedAt: now })
        .where(eq(jobs.id, jobId));
      await tx.insert(jobEvents).values({
        tenantId: row.tenantId,
        jobId: row.id,
        eventType: "job_start_failed",
        payload: {
          error: message,
          payload: startPayload,
        },
        createdAt: now,
      });
    });

    return NextResponse.json(
      { error: "Falha ao disparar workflow no n8n." },
      { status: 502 }
    );
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(jobs)
      .set({
        status: "processing",
        startedAt: now,
        updatedAt: now,
        error: null,
      })
      .where(
        and(
          eq(jobs.id, jobId),
          isNull(jobs.startedAt),
          inArray(jobs.status, STARTABLE_STATUSES)
        )
      )
      .returning({ id: jobs.id });

    if (updated.length === 0) {
      throw new Error("Job mudou de estado durante o disparo.");
    }

    await tx.insert(jobEvents).values({
      tenantId: row.tenantId,
      jobId: row.id,
      eventType: "job_started",
      payload: startPayload,
      createdAt: now,
    });
  });

  return NextResponse.json(
    {
      job: {
        id: row.id,
        status: "processing",
        startedAt: now.toISOString(),
      },
    },
    { status: 202 }
  );
}
