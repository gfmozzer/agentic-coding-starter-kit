import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { jobEvents } from "@/lib/db/schema/job-events";
import { jobs } from "@/lib/db/schema/jobs";
import { reviewGates } from "@/lib/db/schema/review-gates";

const baseSchema = z.object({
  tenant_id: z.string().uuid("tenant_id invalido."),
  job_id: z.string().uuid("job_id invalido."),
});

const reviewSchema = baseSchema.extend({
  gate_id: z.string().min(1),
  input_kind: z.enum(["agent", "group"]),
  ref_id: z.string().min(1),
  keys: z.record(z.string()),
  pages: z.array(z.string()),
  key_sources: z.record(z.string()).optional(),
  keys_translated: z.record(z.string()).optional(),
  keys_reviewed: z.record(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
});

const doneSchema = baseSchema.extend({
  status: z.literal("done"),
  pdf_url_final: z.string().url("pdf_url_final invalida."),
  metadata: z.record(z.unknown()).optional(),
});

const failedSchema = baseSchema.extend({
  status: z.literal("failed"),
  error: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type ReviewPayload = z.infer<typeof reviewSchema>;
type DonePayload = z.infer<typeof doneSchema>;
type FailedPayload = z.infer<typeof failedSchema>;

type WebhookPayload =
  | { type: "review"; data: ReviewPayload }
  | { type: "done"; data: DonePayload }
  | { type: "failed"; data: FailedPayload };

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// TODO: Validar assinatura HMAC das requests quando token estiver configurado.
async function parseRequest(request: NextRequest): Promise<WebhookPayload | null> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    console.error("n8n webhook invalid json", error);
    return null;
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;

  if ("gate_id" in value) {
    const parsed = reviewSchema.safeParse(value);
    if (!parsed.success) {
      console.warn("n8n webhook review payload invalido", parsed.error.flatten());
      return null;
    }
    return { type: "review", data: parsed.data };
  }

  const status = (value.status as string | undefined)?.toLowerCase();
  if (status === "done") {
    const parsed = doneSchema.safeParse(value);
    if (!parsed.success) {
      console.warn("n8n webhook done payload invalido", parsed.error.flatten());
      return null;
    }
    return { type: "done", data: parsed.data };
  }

  if (status === "failed") {
    const parsed = failedSchema.safeParse(value);
    if (!parsed.success) {
      console.warn("n8n webhook failed payload invalido", parsed.error.flatten());
      return null;
    }
    return { type: "failed", data: parsed.data };
  }

  console.warn("n8n webhook desconhecido", value);
  return null;
}

function buildTenantMismatchResponse(jobId: string, tenantId: string, payloadTenant: string) {
  return NextResponse.json(
    {
      error: "tenant_id mismatch",
      jobId,
      expected: tenantId,
      received: payloadTenant,
    },
    { status: 409 }
  );
}

function mergeReviewState(original: Record<string, unknown>, payload: ReviewPayload, receivedAt: string) {
  const next = { ...original };
  const reviewGates = toRecord(next.reviewGates);
  reviewGates[payload.gate_id] = {
    gateId: payload.gate_id,
    inputKind: payload.input_kind,
    refId: payload.ref_id,
    keys: payload.keys,
    keySources: payload.key_sources ?? {},
    keysTranslated: payload.keys_translated ?? null,
    pages: payload.pages,
    context: payload.context ?? null,
    receivedAt,
  };
  next.reviewGates = reviewGates;
  return next;
}

function mergeResult(original: Record<string, unknown>, updates: Record<string, unknown>) {
  return { ...original, ...updates };
}

async function handleReview(job: JobRow, payload: ReviewPayload) {
  const now = new Date();
  const resultRecord = toRecord(job.result);
  const nextResult = mergeReviewState(resultRecord, payload, now.toISOString());

  await db.transaction(async (tx) => {
    const existingGate = await tx
      .select({ id: reviewGates.id })
      .from(reviewGates)
      .where(and(eq(reviewGates.jobId, job.id), eq(reviewGates.gateId, payload.gate_id)))
      .limit(1)
      .then((rows) => rows[0]);

    const gateUpdate = {
      inputKind: payload.input_kind,
      refId: payload.ref_id,
      status: "pending" as const,
      keys: payload.keys,
      keySources: payload.key_sources ?? {},
      keysTranslated: payload.keys_translated ?? null,
      keysReviewed: payload.keys_reviewed ?? null,
      pages: payload.pages,
      context: payload.context ?? null,
      reviewerId: null,
      updatedAt: now,
      closedAt: null,
    } satisfies Partial<(typeof reviewGates)["$inferInsert"]>;

    if (existingGate) {
      await tx
        .update(reviewGates)
        .set(gateUpdate)
        .where(eq(reviewGates.id, existingGate.id));
    } else {
      await tx.insert(reviewGates).values({
        tenantId: job.tenantId,
        jobId: job.id,
        gateId: payload.gate_id,
        ...gateUpdate,
      });
    }

    await tx
      .update(jobs)
      .set({
        status: `review:${payload.gate_id}`,
        currentGateId: payload.gate_id,
        result: nextResult,
        updatedAt: now,
        error: null,
      })
      .where(eq(jobs.id, job.id));

    await tx.insert(jobEvents).values({
      tenantId: job.tenantId,
      jobId: job.id,
      eventType: "review_gate_opened",
      payload,
      createdAt: now,
    });
  });

  return NextResponse.json({ ok: true });
}

async function handleDone(job: JobRow, payload: DonePayload) {
  const now = new Date();
  const resultRecord = toRecord(job.result);
  const nextResult = mergeResult(resultRecord, {
    finalPdfUrl: payload.pdf_url_final,
    completionMetadata: payload.metadata ?? {},
  });

  await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({
        status: "done",
        currentGateId: null,
        result: nextResult,
        finishedAt: now,
        updatedAt: now,
        error: null,
      })
      .where(eq(jobs.id, job.id));

    await tx.insert(jobEvents).values({
      tenantId: job.tenantId,
      jobId: job.id,
      eventType: "job_completed",
      payload,
      createdAt: now,
    });
  });

  return NextResponse.json({ ok: true });
}

async function handleFailed(job: JobRow, payload: FailedPayload) {
  const now = new Date();
  const reason = payload.reason ?? payload.error ?? "Job marcado como failed pelo n8n.";
  const resultRecord = toRecord(job.result);
  const nextResult = mergeResult(resultRecord, {
    failureMetadata: payload.metadata ?? {},
  });

  await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({
        status: "failed",
        currentGateId: null,
        result: nextResult,
        finishedAt: now,
        updatedAt: now,
        error: reason,
      })
      .where(eq(jobs.id, job.id));

    await tx.insert(jobEvents).values({
      tenantId: job.tenantId,
      jobId: job.id,
      eventType: "job_failed",
      payload,
      createdAt: now,
    });
  });

  return NextResponse.json({ ok: true });
}

type JobRow = {
  id: string;
  tenantId: string;
  status: string;
  result: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  const parsed = await parseRequest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const { data } = parsed;

  const job = await db
    .select({
      id: jobs.id,
      tenantId: jobs.tenantId,
      status: jobs.status,
      result: jobs.result,
    })
    .from(jobs)
    .where(eq(jobs.id, data.job_id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!job) {
    return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 });
  }

  if (job.tenantId !== data.tenant_id) {
    const now = new Date();
    await db.insert(jobEvents).values({
      tenantId: job.tenantId,
      jobId: job.id,
      eventType: "webhook_tenant_mismatch",
      payload: data,
      createdAt: now,
    });
    return buildTenantMismatchResponse(job.id, job.tenantId, data.tenant_id);
  }

  if (parsed.type === "review") {
    return handleReview(job, parsed.data);
  }
  if (parsed.type === "done") {
    return handleDone(job, parsed.data);
  }
  return handleFailed(job, parsed.data);
}
