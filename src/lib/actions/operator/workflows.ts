"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";

import type { ActionState } from "@/lib/actions/super-admin/agent-action-state";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  tenantWorkflows,
  tenantWorkflowSteps,
  workflowSteps,
  workflowTemplates,
  type WorkflowStepType,
} from "@/lib/db/schema/workflows";
import { workflowTemplateTenants } from "@/lib/db/schema/workflow-publishing";
import { sanitizeRenderTemplateHtml } from "@/lib/templates/sanitize-html";

const stepTypeValues = ["agent", "group", "review_gate", "translator", "render"] as const;
const StepTypeEnum = z.enum(stepTypeValues);

type StepTypeLiteral = (typeof stepTypeValues)[number];

const cloneSchema = z.object({
  templateId: z.string().uuid("Template invalido."),
  name: z.string().trim().min(1, "Informe um nome.").max(255, "Nome muito longo.").optional(),
});

const stepOverrideSchema = z.object({
  tenantStepId: z.string().uuid("Passo invalido."),
  templateStepId: z.string().min(1, "Passo do template invalido."),
  type: StepTypeEnum,
  order: z.number().int().min(1),
  sourceStepId: z.string().optional().nullable(),
  overrides: z
    .object({
      systemPromptOverride: z.string().trim().optional().nullable(),
      llmProviderOverride: z.string().trim().optional().nullable(),
      llmTokenRefOverride: z.string().trim().optional().nullable(),
      renderHtmlOverride: z.string().optional().nullable(),
      configOverride: z.record(z.string(), z.unknown()).optional(),
    })
    .default({}),
});

const workflowSettingsSchema = z.object({
  llmTokenRefDefault: z.string().trim().optional().nullable(),
  status: z.enum(["draft", "ready"]).optional(),
  steps: z.array(stepOverrideSchema).nonempty("Informe ao menos um passo."),
});

function errorState(message: string): ActionState {
  return { error: message };
}

function successState(message: string): ActionState {
  return { success: message };
}

function mapZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

function normalizeOptional(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireOperatorSession() {
  const session = await getSessionContext();
  if (!session) {
    throw new Error("Autenticacao necessaria.");
  }
  if (session.role !== "operator") {
    throw new Error("Acesso negado.");
  }
  const tenantId = session.tenantId;
  if (!tenantId) {
    throw new Error("Tenant nao associado a sessao.");
  }
  return { ...session, tenantId } as typeof session & { tenantId: string };
}

async function resolveCloneName(tenantId: string, desiredName: string) {
  let counter = 0;
  let candidate = desiredName;
  while (true) {
    const existing = await db
      .select({ id: tenantWorkflows.id })
      .from(tenantWorkflows)
      .where(and(eq(tenantWorkflows.tenantId, tenantId), eq(tenantWorkflows.name, candidate)))
      .limit(1);
    if (existing.length === 0) {
      return candidate;
    }
    counter += 1;
    candidate = `${desiredName} (${counter + 1})`;
    if (counter > 20) {
      candidate = `${desiredName} (${Date.now()})`;
      return candidate;
    }
  }
}

export async function cloneWorkflowForTenantAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireOperatorSession();
    const tenantId = session.tenantId;

    const parsed = cloneSchema.safeParse({
      templateId: formData.get("templateId"),
      name: formData.get("name"),
    });

    if (!parsed.success) {
      return { fieldErrors: mapZodErrors(parsed.error) };
    }

    const template = await db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        description: workflowTemplates.description,
        version: workflowTemplates.version,
      })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, parsed.data.templateId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!template) {
      return errorState("Template nao encontrado.");
    }

    const binding = await db
      .select({ id: workflowTemplateTenants.id })
      .from(workflowTemplateTenants)
      .where(
        and(
          eq(workflowTemplateTenants.workflowTemplateId, template.id),
          eq(workflowTemplateTenants.tenantId, tenantId),
          isNull(workflowTemplateTenants.unpublishedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!binding) {
      return errorState("Workflow nao esta publicado para o tenant.");
    }

    const templateSteps = await db
      .select({
        id: workflowSteps.id,
        type: workflowSteps.type,
        position: workflowSteps.position,
        label: workflowSteps.label,
        sourceStepId: workflowSteps.sourceStepId,
      })
      .from(workflowSteps)
      .where(eq(workflowSteps.templateId, template.id))
      .orderBy(asc(workflowSteps.position));

    if (templateSteps.length === 0) {
      return errorState("Template sem passos para clonar.");
    }

    const now = new Date();
    const desiredName = parsed.data.name ?? template.name;
    const name = await resolveCloneName(tenantId, desiredName);

    await db.transaction(async (tx) => {
      const [workflow] = await tx
        .insert(tenantWorkflows)
        .values({
          tenantId,
          workflowTemplateId: template.id,
          name,
          description: template.description ?? null,
          version: template.version,
          status: "draft",
          clonedBy: session.userId,
          clonedAt: now,
          updatedAt: now,
        })
        .returning({ id: tenantWorkflows.id });

      const stepValues = templateSteps.map((step) => ({
        tenantWorkflowId: workflow.id,
        templateStepId: step.id,
        type: step.type as StepTypeLiteral,
        position: step.position,
        label: step.label ?? null,
        sourceStepId: step.sourceStepId ?? null,
        systemPromptOverride: null,
        llmProviderOverride: null,
        llmTokenRefOverride: null,
        renderHtmlOverride: null,
        configOverride: {},
      }));

      if (stepValues.length > 0) {
        await tx.insert(tenantWorkflowSteps).values(stepValues);
      }
    });

    revalidatePath("/operator/workflows");
    return successState("Workflow clonado com sucesso.");
  } catch (error) {
    console.error("cloneWorkflowForTenantAction", error);
    return errorState(
      error instanceof Error ? error.message : "Erro interno ao clonar workflow."
    );
  }
}

interface TemplateStepMeta {
  id: string;
  type: WorkflowStepType;
  position: number;
  sourceStepId: string | null;
}

export async function saveTenantWorkflowConfigurationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireOperatorSession();
    const tenantId = session.tenantId;

    const workflowId = formData.get("workflowId");
    if (typeof workflowId !== "string" || workflowId.length === 0) {
      return errorState("Workflow invalido.");
    }

    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") {
      return errorState("Payload invalido.");
    }

    let parsedPayload: z.infer<typeof workflowSettingsSchema>;
    try {
      const json = JSON.parse(payloadRaw);
      const parsed = workflowSettingsSchema.safeParse(json);
      if (!parsed.success) {
        return { fieldErrors: mapZodErrors(parsed.error) };
      }
      parsedPayload = parsed.data;
    } catch (error) {
      console.error("saveTenantWorkflowConfigurationAction: invalid JSON", error);
      return errorState("Nao foi possivel interpretar os dados enviados.");
    }

    const trimmedDefaultToken = normalizeOptional(parsedPayload.llmTokenRefDefault ?? null);
    const desiredStatus = parsedPayload.status ?? "draft";

    if (desiredStatus === "ready" && !trimmedDefaultToken) {
      return errorState("Defina um token padrao antes de deixar o workflow pronto.");
    }

    await db.transaction(async (tx) => {
      const workflowRow = await tx
        .select({
          id: tenantWorkflows.id,
          tenantId: tenantWorkflows.tenantId,
          templateId: tenantWorkflows.workflowTemplateId,
          status: tenantWorkflows.status,
        })
        .from(tenantWorkflows)
        .where(eq(tenantWorkflows.id, workflowId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!workflowRow || workflowRow.tenantId !== tenantId) {
        throw new Error("Workflow nao encontrado para o tenant.");
      }

      const templateSteps = await tx
        .select({
          id: workflowSteps.id,
          type: workflowSteps.type,
          position: workflowSteps.position,
          sourceStepId: workflowSteps.sourceStepId,
        })
        .from(workflowSteps)
        .where(eq(workflowSteps.templateId, workflowRow.templateId))
        .orderBy(asc(workflowSteps.position));

      if (templateSteps.length !== parsedPayload.steps.length) {
        throw new Error("Quantidade de passos diverge do template original.");
      }

      const templateStepMap = new Map<string, TemplateStepMeta>(
        templateSteps.map((step) => [step.id, step])
      );

      const stepIdsSeen = new Set<string>();

      for (const stepInput of parsedPayload.steps) {
        if (stepIdsSeen.has(stepInput.templateStepId)) {
          throw new Error("Passo do template enviado em duplicidade.");
        }
        stepIdsSeen.add(stepInput.templateStepId);

        const templateStep = templateStepMap.get(stepInput.templateStepId);
        if (!templateStep) {
          throw new Error("Passo do template desconhecido.");
        }

        if (templateStep.type !== stepInput.type) {
          throw new Error("Tipo de passo nao pode ser alterado.");
        }

        if (templateStep.position !== stepInput.order) {
          throw new Error("Ordem dos passos nao pode ser alterada.");
        }

        const templateSource = templateStep.sourceStepId ?? null;
        const payloadSource = stepInput.sourceStepId ?? null;
        if (templateSource !== payloadSource) {
          throw new Error("Passo de origem nao pode ser alterado.");
        }

        const tenantStep = await tx
          .select({
            id: tenantWorkflowSteps.id,
          })
          .from(tenantWorkflowSteps)
          .where(
            and(
              eq(tenantWorkflowSteps.id, stepInput.tenantStepId),
              eq(tenantWorkflowSteps.tenantWorkflowId, workflowRow.id)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        if (!tenantStep) {
          throw new Error("Passo do workflow nao encontrado.");
        }

        const overrides = stepInput.overrides ?? {};

        const systemPromptOverride = normalizeOptional(overrides.systemPromptOverride ?? null);
        const providerOverride = normalizeOptional(overrides.llmProviderOverride ?? null);
        const tokenOverride = normalizeOptional(overrides.llmTokenRefOverride ?? null);

        let renderHtmlOverride: string | null = null;
        if (templateStep.type === "render") {
          const rawHtml = overrides.renderHtmlOverride ?? null;
          if (typeof rawHtml === "string") {
            const sanitized = sanitizeRenderTemplateHtml(rawHtml);
            renderHtmlOverride = sanitized.length > 0 ? sanitized : null;
          }
        }

        const configOverride = overrides.configOverride && typeof overrides.configOverride === "object"
          ? overrides.configOverride
          : {};

        await tx
          .update(tenantWorkflowSteps)
          .set({
            systemPromptOverride,
            llmProviderOverride: providerOverride,
            llmTokenRefOverride: tokenOverride,
            renderHtmlOverride,
            configOverride,
            updatedAt: new Date(),
          })
          .where(eq(tenantWorkflowSteps.id, tenantStep.id));
      }

      await tx
        .update(tenantWorkflows)
        .set({
          llmTokenRefDefault: trimmedDefaultToken,
          status: desiredStatus,
          updatedAt: new Date(),
        })
        .where(eq(tenantWorkflows.id, workflowRow.id));
    });

    revalidatePath("/operator/workflows");
    revalidatePath(`/operator/workflows/${workflowId}/settings`);
    return successState("Configuracoes salvas com sucesso.");
  } catch (error) {
    console.error("saveTenantWorkflowConfigurationAction", error);
    return errorState(
      error instanceof Error ? error.message : "Erro interno ao salvar configuracoes."
    );
  }
}





