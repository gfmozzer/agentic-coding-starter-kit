"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  WorkflowReviewInputKind,
  workflowStepGroups,
  workflowStepReviews,
  workflowSteps,
  workflowTemplates,
} from "@/lib/db/schema/workflows";
import { workflowTemplateTenants } from "@/lib/db/schema/workflow-publishing";
import { recordWorkflowAudit, buildRuntimeWorkflow } from "@/lib/workflows/builder";
import type { ActionState } from "./agent-action-state";

const stepIdSchema = z
  .string()
  .trim()
  .min(2, "ID deve ter pelo menos 2 caracteres.")
  .regex(/^[a-z0-9_-]+$/i, "Use apenas letras, números, hífen ou underline.");

const labelSchema = z.string().trim().max(120, "Máximo de 120 caracteres.").optional();
const configSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .transform((value) => value ?? {});

const groupMemberSchema = z.object({
  agentId: z.string().min(1, "Selecione um agente."),
  order: z.number().int().min(1, "Informe a ordem."),
});

const baseStepSchema = z.object({
  id: stepIdSchema,
  order: z.number().int().min(1),
  label: labelSchema,
});

const agentStepSchema = baseStepSchema.extend({
  type: z.literal("agent"),
  agentId: z.string().min(1, "Selecione um agente."),
  config: configSchema,
});

const groupStepSchema = baseStepSchema.extend({
  type: z.literal("group"),
  inputFrom: z.string().min(1, "Informe o passo de origem."),
  members: z.array(groupMemberSchema).min(1, "Defina ao menos um membro."),
  config: configSchema,
});

const reviewGateStepSchema = baseStepSchema.extend({
  type: z.literal("review_gate"),
  gateKey: stepIdSchema,
  sourceStepId: z.string().min(1, "Informe o passo de origem."),
  sourceKind: z.enum(["agent", "group"]).default("agent"),
  title: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  config: configSchema,
});

const translatorStepSchema = baseStepSchema.extend({
  type: z.literal("translator"),
  translatorAgentId: z.string().min(1, "Selecione um agente tradutor."),
  sourceStepId: z.string().min(1, "Informe o passo de origem."),
  config: configSchema,
});

const renderStepSchema = baseStepSchema.extend({
  type: z.literal("render"),
  sourceStepId: z.string().min(1, "Informe o passo de origem."),
  templateId: z.string().uuid("Selecione um template valido."),
  config: configSchema,
});

const workflowStepSchema = z.discriminatedUnion("type", [
  agentStepSchema,
  groupStepSchema,
  reviewGateStepSchema,
  translatorStepSchema,
  renderStepSchema,
]);

const workflowPayloadSchema = z.object({
  templateId: z.string().uuid("Template inválido."),
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres."),
  description: z.string().trim().optional(),
  version: z.string().trim().min(1, "Informe a versão."),
  steps: z.array(workflowStepSchema),
});

function normalizeSteps(steps: z.infer<typeof workflowStepSchema>[]) {
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ ...step, order: index + 1 }));
}

function ensureSuperAdmin(role: string | undefined) {
  if (role !== "super-admin") {
    throw new Error("Acesso negado.");
  }
}

function assertRenderPresence(steps: z.infer<typeof workflowStepSchema>[]) {
  const renderCount = steps.filter((step) => step.type === "render").length;
  if (renderCount === 0) {
    throw new Error("Adicione um passo de renderização ao workflow.");
  }
  if (renderCount > 1) {
    throw new Error("Somente um passo render é permitido por workflow.");
  }
}

function buildStepMap(steps: z.infer<typeof workflowStepSchema>[]) {
  return new Map(steps.map((step) => [step.id, step]));
}

function assertReference(
  step: z.infer<typeof workflowStepSchema>,
  referencedId: string,
  stepsById: Map<string, z.infer<typeof workflowStepSchema>>,
  allowedTypes: string[],
  errorMessage: string
) {
  const referenced = stepsById.get(referencedId);
  if (!referenced) {
    throw new Error(errorMessage);
  }
  if (!allowedTypes.includes(referenced.type)) {
    throw new Error(errorMessage);
  }
  if (referenced.order >= step.order) {
    throw new Error(
      `O passo ${step.id} deve referenciar um nó posicionado anteriormente no workflow.`
    );
  }
}

function validateLogicalRules(steps: z.infer<typeof workflowStepSchema>[]) {
  const stepsById = buildStepMap(steps);

  for (const step of steps) {
    switch (step.type) {
      case "group": {
        assertReference(
          step,
          step.inputFrom,
          stepsById,
          ["agent", "group", "translator"],
          `Grupo ${step.id} precisa referenciar um passo anterior válido.`
        );
        break;
      }
      case "review_gate": {
        const allowed =
          step.sourceKind === "group" ? ["group"] : ["agent", "translator"];
        assertReference(
          step,
          step.sourceStepId,
          stepsById,
          allowed,
          `Review gate ${step.id} precisa apontar para um passo compatível com o input.`
        );
        break;
      }
      case "translator": {
        assertReference(
          step,
          step.sourceStepId,
          stepsById,
          ["group", "review_gate"],
          `Translator ${step.id} deve consumir o output de um grupo ou review gate.`
        );
        break;
      }
      case "render": {
        assertReference(
          step,
          step.sourceStepId,
          stepsById,
          ["translator", "review_gate"],
          `Render ${step.id} deve referenciar o passo de translator ou o último review gate.`
        );
        break;
      }
      default:
        break;
    }
  }
}

function buildStepConfig(step: z.infer<typeof workflowStepSchema>) {
  const base = step.config ?? {};
  if (step.type === "render") {
    if (base && typeof base === "object") {
      const copy = { ...(base as Record<string, unknown>) };
      delete copy.templateId;
      return copy;
    }
  }
  return base;
}

async function upsertWorkflowTemplate(
  templateId: string,
  input: z.infer<typeof workflowPayloadSchema>
) {
  const steps = normalizeSteps(input.steps);
  assertRenderPresence(steps);
  validateLogicalRules(steps);

  await db.transaction(async (tx) => {
    const now = new Date();

    await tx
      .update(workflowTemplates)
      .set({
        name: input.name,
        description: input.description ?? null,
        version: input.version,
        updatedAt: now,
      })
      .where(eq(workflowTemplates.id, templateId));

    await tx.delete(workflowSteps).where(eq(workflowSteps.templateId, templateId));

    for (const [index, step] of steps.entries()) {
      await tx.insert(workflowSteps).values({
        id: step.id,
        templateId,
        type: step.type,
        position: index + 1,
        label: step.label ?? null,
        agentId:
          step.type === "agent"
            ? step.agentId
            : step.type === "translator"
            ? step.translatorAgentId
            : null,
        renderTemplateId: step.type === "render" ? step.templateId : null,
        sourceStepId:
          step.type === "group"
            ? step.inputFrom
            : step.type === "review_gate" ||
              step.type === "translator" ||
              step.type === "render"
            ? step.sourceStepId
            : null,
        config: buildStepConfig(step),
      });

      if (step.type === "group") {
        for (const member of step.members.sort((a, b) => a.order - b.order)) {
          await tx.insert(workflowStepGroups).values({
            stepId: step.id,
            memberAgentId: member.agentId,
            position: member.order,
          });
        }
      }

      if (step.type === "review_gate") {
        await tx.insert(workflowStepReviews).values({
          stepId: step.id,
          gateKey: step.gateKey,
          inputKind: step.sourceKind as WorkflowReviewInputKind,
          title: step.title ?? null,
          instructions: step.instructions ?? null,
          config: step.config ?? {},
        });
      }
    }
  });
}

function parseZodErrors(error: z.ZodError): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

export async function saveWorkflowTemplateAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await getSessionContext();
    ensureSuperAdmin(session?.role);

    const payloadRaw = formData.get("payload");
    if (typeof payloadRaw !== "string") {
      return { error: "Payload invalido." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(payloadRaw);
    } catch (error) {
      console.error("saveWorkflowTemplateAction: invalid JSON", error);
      return { error: "Payload invalido." };
    }

    const parsed = workflowPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        error: "Revise os campos destacados.",
        fieldErrors: parseZodErrors(parsed.error),
      };
    }

    const data = parsed.data;
    const before = await buildRuntimeWorkflow(data.templateId).catch(() => null);

    await upsertWorkflowTemplate(data.templateId, data);

    const after = await buildRuntimeWorkflow(data.templateId);

    await recordWorkflowAudit(data.templateId, session?.userId ?? null, {
      action: "template_saved",
      before,
      after,
    });

    revalidatePath(`/super-admin/workflows/${data.templateId}/builder`);
    revalidatePath("/super-admin/workflows");

    return { success: "Workflow salvo com sucesso." };
  } catch (error) {
    console.error("saveWorkflowTemplateAction", error);
    return {
      error:
        error instanceof Error ? error.message : "Nao foi possivel salvar o workflow.",
    };
  }
}


export async function createWorkflowTemplateAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await getSessionContext();
    ensureSuperAdmin(session?.role);

    const name = formData.get("name")?.toString().trim() ?? "";
    const descriptionRaw = formData.get("description")?.toString().trim() ?? "";

    if (name.length < 3) {
      return { error: "Informe um nome com pelo menos 3 caracteres." };
    }

    const description = descriptionRaw.length > 0 ? descriptionRaw : null;
    const version = "v1";

    const [created] = await db
      .insert(workflowTemplates)
      .values({
        name,
        description,
        version,
      })
      .returning({ id: workflowTemplates.id });

    await recordWorkflowAudit(created.id, session?.userId ?? null, {
      action: "template_created",
      name,
      version,
    });

    revalidatePath("/super-admin/workflows");

    return {
      success: "Template criado com sucesso.",
      fieldErrors: { redirectTo: `/super-admin/workflows/${created.id}/builder` },
    };
  } catch (error) {
    console.error("createWorkflowTemplateAction", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel criar o template.",
    };
  }
}


const publishSchema = z.object({
  templateId: z.string().uuid("Template ID inválido"),
  tenantId: z.string().uuid("Tenant ID inválido"),
  action: z.enum(["publish", "unpublish", "set-default"]),
  isDefault: z.coerce.boolean().optional(),
});

export async function publishWorkflowToTenantAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await getSessionContext();
    ensureSuperAdmin(session?.role);

    const parsed = publishSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!parsed.success) {
      return {
        error: "Dados invalidos para publicacao",
        fieldErrors: parseZodErrors(parsed.error),
      };
    }

    const { templateId, tenantId, action, isDefault } = parsed.data;
    const now = new Date();
    let successMessage = "";

    await db.transaction(async (tx) => {
      if (action === "publish") {
        const existing = await tx
          .select({
            id: workflowTemplateTenants.id,
            isDefault: workflowTemplateTenants.isDefault,
          })
          .from(workflowTemplateTenants)
          .where(
            and(
              eq(workflowTemplateTenants.workflowTemplateId, templateId),
              eq(workflowTemplateTenants.tenantId, tenantId)
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        const desiredDefault = Boolean(isDefault);
        const shouldBeDefault = desiredDefault || (existing?.isDefault ?? false);

        if (shouldBeDefault) {
          await tx
            .update(workflowTemplateTenants)
            .set({ isDefault: false })
            .where(
              and(
                eq(workflowTemplateTenants.workflowTemplateId, templateId),
                sql`${workflowTemplateTenants.unpublishedAt} IS NULL`
              )
            );
        }

        await tx
          .insert(workflowTemplateTenants)
          .values({
            workflowTemplateId: templateId,
            tenantId,
            isDefault: shouldBeDefault,
            publishedBy: session?.userId ?? null,
            publishedAt: now,
            unpublishedAt: null,
          })
          .onConflictDoUpdate({
            target: [
              workflowTemplateTenants.workflowTemplateId,
              workflowTemplateTenants.tenantId,
            ],
            set: {
              isDefault: shouldBeDefault,
              publishedBy: session?.userId ?? null,
              publishedAt: now,
              unpublishedAt: null,
            },
          });

        await recordWorkflowAudit(templateId, session?.userId ?? null, {
          action: "published_to_tenant",
          tenantId,
          isDefault: shouldBeDefault,
        });

        successMessage = "Workflow publicado com sucesso para o tenant!";
      } else if (action === "unpublish") {
        const result = await tx
          .update(workflowTemplateTenants)
          .set({ unpublishedAt: now, isDefault: false })
          .where(
            and(
              eq(workflowTemplateTenants.workflowTemplateId, templateId),
              eq(workflowTemplateTenants.tenantId, tenantId),
              sql`${workflowTemplateTenants.unpublishedAt} IS NULL`
            )
          )
          .returning({ id: workflowTemplateTenants.id });

        if (result.length === 0) {
          throw new Error("Workflow nao esta publicado para este tenant.");
        }

        await recordWorkflowAudit(templateId, session?.userId ?? null, {
          action: "unpublished_from_tenant",
          tenantId,
        });

        successMessage = "Workflow removido do tenant com sucesso!";
      } else {
        const existing = await tx
          .select({ id: workflowTemplateTenants.id })
          .from(workflowTemplateTenants)
          .where(
            and(
              eq(workflowTemplateTenants.workflowTemplateId, templateId),
              eq(workflowTemplateTenants.tenantId, tenantId),
              sql`${workflowTemplateTenants.unpublishedAt} IS NULL`
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        if (!existing) {
          throw new Error("Publique o workflow para o tenant antes de definir como padrao.");
        }

        await tx
          .update(workflowTemplateTenants)
          .set({ isDefault: false })
          .where(
            and(
              eq(workflowTemplateTenants.workflowTemplateId, templateId),
              sql`${workflowTemplateTenants.unpublishedAt} IS NULL`
            )
          );

        await tx
          .update(workflowTemplateTenants)
          .set({ isDefault: true, publishedBy: session?.userId ?? null })
          .where(eq(workflowTemplateTenants.id, existing.id));

        await recordWorkflowAudit(templateId, session?.userId ?? null, {
          action: "set_default_tenant",
          tenantId,
        });

        successMessage = "Tenant definido como padrao para este workflow!";
      }
    });

    revalidatePath(`/super-admin/workflows/${templateId}/publish`);
    revalidatePath("/super-admin/workflows");

    return { success: successMessage };
  } catch (error) {
    console.error("publishWorkflowToTenantAction", error);
    return {
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    };
  }
}


export async function unpublishWorkflowFromTenantAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // This action can reuse the publish action with unpublish parameter
  formData.set("action", "unpublish");
  return publishWorkflowToTenantAction(_prevState, formData);
}

