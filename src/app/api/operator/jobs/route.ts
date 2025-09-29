
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobFiles, jobs } from "@/lib/db/schema/jobs";
import { jobEvents } from "@/lib/db/schema/job-events";
import { workflows } from "@/lib/db/schema/workflows";
import { StorageClient } from "@/lib/storage/client";
import { buildJobPaths } from "@/lib/storage/jobs-paths";
import { buildRuntimeWorkflow } from "@/lib/workflows/builder";
import { getTenantWorkflowWithTemplate } from "@/lib/workflows/tenant";
import type { TenantWorkflowResolvedStep } from "@/lib/workflows/tenant-types";
import type { WorkflowStep } from "@/lib/workflows/types";
import { generatePdfDerivatives } from "@/workers/pdf-derivatives";

const formSchema = z.object({
  tenantWorkflowId: z.string().uuid("Workflow invalido."),
  notes: z.string().optional(),
  metadata: z.string().optional(),
});

function trimToNull(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: message,
      ...(extra ?? {}),
    },
    { status }
  );
}

function buildJobDefinition(
  runtimeSteps: Map<string, WorkflowStep>,
  detailSteps: TenantWorkflowResolvedStep[],
  defaultToken: string | null
) {
  return detailSteps.map((step) => {
    const runtimeStep = runtimeSteps.get(step.templateStepId);
    if (!runtimeStep) {
      throw new Error(`Passo ${step.templateStepId} nao encontrado no template base.`);
    }

    const configOverride =
      step.overrides.configOverride && Object.keys(step.overrides.configOverride).length > 0
        ? step.overrides.configOverride
        : {};
    const mergedConfig = {
      ...(step.templateConfig ?? {}),
      ...configOverride,
    };

    const systemPrompt =
      trimToNull(step.overrides.systemPromptOverride) ?? trimToNull(step.agent?.systemPrompt);
    const provider =
      trimToNull(step.overrides.llmProviderOverride) ?? trimToNull(step.agent?.defaultProvider);
    const tokenRef = trimToNull(step.overrides.llmTokenRefOverride) ?? defaultToken ?? undefined;

    const base = {
      id: step.templateStepId,
      tenantStepId: step.tenantStepId,
      order: step.order,
      type: step.type,
      label: step.label ?? null,
      sourceStepId: step.sourceStepId ?? null,
      config: mergedConfig,
    } as Record<string, unknown>;

    if (step.type === "agent" || step.type === "translator") {
      if (!step.agent) {
        throw new Error(`Passo ${step.templateStepId} sem agente associado.`);
      }

      const webhookUrl = step.agent.webhookUrl ?? null;
      if (!webhookUrl) {
        throw new Error(`Agente ${step.agent.id} sem webhook configurado.`);
      }

      base.agent = {
        id: step.agent.id,
        name: step.agent.name,
        kind: step.agent.kind,
        webhookUrl,
        webhookAuthHeader: step.agent.webhookAuthHeader ?? null,
      };
      base.llm = {
        systemPrompt: systemPrompt ?? null,
        provider: provider ?? null,
        tokenRef,
      };
    }

    if (step.type === "group") {
      const groupStep = runtimeStep as Extract<WorkflowStep, { type: "group" }>;
      base.group = {
        inputFrom: groupStep.inputFrom,
        members: groupStep.members,
      };
    }

    if (step.type === "review_gate") {
      const reviewStep = runtimeStep as Extract<WorkflowStep, { type: "review_gate" }>;
      base.review = {
        gateKey: reviewStep.gateKey,
        inputKind: reviewStep.sourceKind,
        title: reviewStep.title ?? null,
        instructions: reviewStep.instructions ?? null,
      };
    }

    if (step.type === "translator") {
      const translatorStep = runtimeStep as Extract<WorkflowStep, { type: "translator" }>;
      base.translator = {
        agentId: translatorStep.translatorAgentId,
        inputFrom: translatorStep.sourceStepId,
      };
    }

    if (step.type === "render") {
      const renderStep = runtimeStep as Extract<WorkflowStep, { type: "render" }>;
      const htmlOverride = trimToNull(step.overrides.renderHtmlOverride);
      const templateHtml = step.renderTemplate?.html ?? null;
      base.render = {
        templateId: renderStep.templateId,
        html: htmlOverride ?? templateHtml ?? "",
      };
    }

    return base;
  });
}

async function parseMetadata(raw: string | undefined, notes: string | undefined) {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object") {
        parsed = value as Record<string, unknown>;
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? `Metadata invalido: ${error.message}` : "Metadata invalido."
      );
    }
  }

  if (notes && notes.trim().length > 0) {
    parsed.notes = notes.trim();
  }

  return parsed;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session || session.role !== "operator" || !session.tenantId) {
      return jsonError("Autenticacao de operador necessaria.", 401);
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Envie o documento em multipart/form-data.", 400);
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return jsonError("Arquivo PDF obrigatorio.", 400);
    }

    // Next.js File extends Blob
    const pdfFile = file as File;
    if (pdfFile.type && pdfFile.type !== "application/pdf") {
      return jsonError("Envie um arquivo PDF valido.", 400);
    }

    const formValues = formSchema.safeParse({
      tenantWorkflowId: formData.get("tenantWorkflowId"),
      notes: formData.get("notes")?.toString(),
      metadata: formData.get("metadata")?.toString(),
    });

    if (!formValues.success) {
      const issue = formValues.error.issues[0];
      return jsonError(issue?.message ?? "Dados invalidos.", 400);
    }

    const { tenantWorkflowId, notes, metadata } = formValues.data;
    const tenantId = session.tenantId;

    const detail = await getTenantWorkflowWithTemplate(tenantWorkflowId, tenantId);
    if (!detail) {
      return jsonError("Workflow nao encontrado para este tenant.", 404);
    }

    if (detail.workflow.status !== "ready") {
      return jsonError("Finalize as configuracoes do workflow antes de criar jobs.", 422);
    }

    const defaultToken = trimToNull(detail.workflow.llmTokenRefDefault);
    if (!defaultToken) {
      return jsonError("Configure o token padrao do workflow antes de criar jobs.", 422);
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const storage = new StorageClient();
    const jobId = randomUUID();
    const paths = buildJobPaths(tenantId, jobId);

    await storage.putObject({
      key: paths.originalPdfKey,
      body: pdfBuffer,
      contentType: pdfFile.type || "application/pdf",
    });

    let metadataResult: Record<string, unknown> = {};
    try {
      metadataResult = await parseMetadata(metadata, notes);
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "Metadata invalido.";
      return jsonError(message, 400);
    }
    const uploadMetadata: Record<string, unknown> = {
      fileName: pdfFile.name,
      fileSize: pdfBuffer.byteLength,
      ...metadataResult,
    };

    const runtime = await buildRuntimeWorkflow(detail.template.id);
    const runtimeStepMap = new Map(runtime.steps.map((step) => [step.id, step]));
    const finalSteps = buildJobDefinition(runtimeStepMap, detail.steps, defaultToken);

    const definition = {
      tenantWorkflowId: detail.workflow.id,
      templateId: detail.template.id,
      defaultToken,
      generatedAt: new Date().toISOString(),
      steps: finalSteps,
    };

    const now = new Date();

    const [workflowRow] = await db
      .insert(workflows)
      .values({
        tenantId,
        templateId: detail.template.id,
        name: detail.workflow.name,
        description: detail.workflow.description ?? null,
        version: detail.workflow.version,
        isGlobal: false,
        definition,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [workflows.tenantId, workflows.name, workflows.version],
        set: {
          templateId: detail.template.id,
          description: detail.workflow.description ?? null,
          definition,
          updatedAt: now,
        },
      })
      .returning({ id: workflows.id });

    const compiledWorkflowId = workflowRow?.id;
    if (!compiledWorkflowId) {
      throw new Error("Falha ao registrar workflow compilado para o job.");
    }

    await db.transaction(async (tx) => {
      await tx.insert(jobs).values({
        id: jobId,
        tenantId,
        workflowId: compiledWorkflowId,
        status: "queued",
        sourcePdfUrl: storage.buildS3Uri(paths.originalPdfKey),
        pageImages: [],
        result: { metadata: uploadMetadata },
        currentGateId: null,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(jobFiles).values({
        tenantId,
        jobId,
        purpose: "original_pdf",
        storageKey: paths.originalPdfKey,
        contentType: pdfFile.type || "application/pdf",
        byteSize: pdfBuffer.byteLength,
      });
    });

    // Start derivatives asynchronously
    queueMicrotask(() =>
      generatePdfDerivatives({
        storage,
        tenantId,
        jobId,
        pdfBuffer,
      })
        .then(async ({ pageImages }) => {
          const updatedAt = new Date();
          const imageKeys = pageImages.map((image) => image.key);
          await db.transaction(async (tx) => {
            if (pageImages.length > 0) {
              await tx.insert(jobFiles).values(
                pageImages.map((image) => ({
                  tenantId,
                  jobId,
                  purpose: "page_image",
                  storageKey: image.key,
                  contentType: "image/jpeg",
                  byteSize: image.byteSize,
                }))
              );
            }

            await tx
              .update(jobs)
              .set({
                status: "processing",
                pageImages: imageKeys,
                updatedAt,
              })
              .where(eq(jobs.id, jobId));

            await tx.insert(jobEvents).values({
              tenantId,
              jobId,
              eventType: "derivatives_generated",
              payload: { pageImages: imageKeys },
              createdAt: updatedAt,
            });
          });
        })
        .catch(async (error) => {
          const message =
            error instanceof Error ? error.message : "Falha ao gerar derivativos.";
          const updatedAt = new Date();
          console.error("pdf-derivatives", error);
          await db.transaction(async (tx) => {
            await tx
              .update(jobs)
              .set({
                status: "failed",
                error: message,
                updatedAt,
              })
              .where(eq(jobs.id, jobId));

            await tx.insert(jobEvents).values({
              tenantId,
              jobId,
              eventType: "derivatives_failed",
              payload: { message },
              createdAt: updatedAt,
            });
          });
        })
    );

    return NextResponse.json(
      {
        job: {
          id: jobId,
          status: "queued",
          sourcePdfUrl: storage.buildS3Uri(paths.originalPdfKey),
          pageImages: [] as string[],
          createdAt: now.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/operator/jobs", error);
    return jsonError("Erro interno ao criar job.", 500);
  }
}

