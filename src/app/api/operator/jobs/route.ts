import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema/jobs";
import { workflows } from "@/lib/db/schema/workflows";
import { buildRuntimeWorkflow } from "@/lib/workflows/builder";
import { getTenantWorkflowWithTemplate } from "@/lib/workflows/tenant";
import type { WorkflowStep } from "@/lib/workflows/types";

const createJobSchema = z.object({
  tenantWorkflowId: z.string().uuid("Workflow invalido."),
  sourcePdfUrl: z
    .string()
    .trim()
    .min(1, "Informe a origem do PDF.")
    .refine(
      (value) => {
        const normalized = value.toLowerCase();
        return (
          normalized.startsWith("http://") ||
          normalized.startsWith("https://") ||
          normalized.startsWith("s3://")
        );
      },
      { message: "Informe uma URL http(s) ou chave s3:// valida." }
    ),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session || session.role !== "operator" || !session.tenantId) {
      return jsonError("Autenticacao de operador necessaria.", 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Payload JSON invalido.", 400);
    }

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Dados invalidos.", 400, {
        field: issue?.path?.[0],
      });
    }

    const { tenantWorkflowId, sourcePdfUrl, metadata } = parsed.data;
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

    const runtime = await buildRuntimeWorkflow(detail.template.id);
    const runtimeStepMap = new Map(runtime.steps.map((step) => [step.id, step]));

    const finalSteps = detail.steps.map((step) => {
      const runtimeStep = runtimeStepMap.get(step.templateStepId);
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
      const tokenRef =
        trimToNull(step.overrides.llmTokenRefOverride) ?? defaultToken ?? undefined;

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
        base.agent = step.agent
          ? {
              id: step.agent.id,
              name: step.agent.name,
              kind: step.agent.kind,
            }
          : null;
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

    const definition = {
      tenantWorkflowId: detail.workflow.id,
      templateId: detail.template.id,
      defaultToken,
      generatedAt: new Date().toISOString(),
      steps: finalSteps,
    };

    const now = new Date();

    const [workflowRecord] = await db
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

    const compiledWorkflowId = workflowRecord?.id;
    if (!compiledWorkflowId) {
      throw new Error("Falha ao registrar workflow compilado para o job.");
    }

    const initialResult =
      metadata && typeof metadata === "object" ? { metadata } : ({} as Record<string, unknown>);

    const [jobRow] = await db
      .insert(jobs)
      .values({
        tenantId,
        workflowId: compiledWorkflowId,
        status: "queued",
        sourcePdfUrl,
        result: initialResult,
        currentGateId: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: jobs.id,
        status: jobs.status,
        sourcePdfUrl: jobs.sourcePdfUrl,
        createdAt: jobs.createdAt,
      });

    return NextResponse.json(
      {
        job: jobRow,
        workflow: {
          id: compiledWorkflowId,
          name: detail.workflow.name,
          version: detail.workflow.version,
          defaultToken,
        },
        steps: finalSteps,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/operator/jobs", error);
    return jsonError("Erro interno ao criar job.", 500);
  }
}
