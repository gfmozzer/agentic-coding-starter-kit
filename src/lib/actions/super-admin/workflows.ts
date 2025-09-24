"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  WorkflowReviewInputKind,
  WorkflowStepType,
  workflowStepGroups,
  workflowStepReviews,
  workflowSteps,
  workflowTemplates,
} from "@/lib/db/schema/workflows";
import { recordWorkflowAudit, buildRuntimeWorkflow } from "@/lib/workflows/builder";
import { initialActionState } from "./agent-action-state";
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
  templateId: z.string().min(1, "Selecione um template."),
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
    return { ...base, templateId: step.templateId };
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
      return { error: "Payload inválido." };
    }

    const parsedJson = JSON.parse(payloadRaw);
    const parsed = workflowPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        error: "Revise os campos destacados.",
        fieldErrors: parseZodErrors(parsed.error),
      };
    }

    const data = parsed.data;

    // TODO: Remover mock quando as tabelas workflow estiverem criadas
    // Mock temporário para demonstrar funcionalidade
    console.log("Mock: Salvando workflow com dados:", data);
    
    /*
    // Código real a ser usado quando o banco estiver configurado:
    const before = await buildRuntimeWorkflow(data.templateId).catch(() => null);

    await upsertWorkflowTemplate(data.templateId, data);

    const after = await buildRuntimeWorkflow(data.templateId);

    await recordWorkflowAudit(data.templateId, session?.userId ?? null, {
      before,
      after,
    });

    revalidatePath("/super-admin/workflows/[templateId]/builder", "page");
    revalidatePath("/super-admin/workflows");
    */

    return { success: "Workflow salvo com sucesso (mock)." };
  } catch (error) {
    console.error("saveWorkflowTemplateAction", error);
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar o workflow.",
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
    const description = formData.get("description")?.toString().trim();

    if (name.length < 3) {
      return { error: "Informe um nome com pelo menos 3 caracteres." };
    }

    // TODO: Remover mock quando as tabelas workflow estiverem criadas
    // Mock temporário para demonstrar funcionalidade
    const mockId = "550e8400-e29b-41d4-a716-446655440003";
    
    /*
    // Código real a ser usado quando o banco estiver configurado:
    const now = new Date();
    const [created] = await db
      .insert(workflowTemplates)
      .values({
        name,
        description: description?.length ? description : null,
        version: "v1",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: workflowTemplates.id });

    revalidatePath("/super-admin/workflows");
    */

    return {
      success: "Template criado com sucesso (mock).",
      fieldErrors: { redirectTo: `/super-admin/workflows/${mockId}/builder` },
    };
  } catch (error) {
    console.error("createWorkflowTemplateAction", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o template.",
    };
  }
}

