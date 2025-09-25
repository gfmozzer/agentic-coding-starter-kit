import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  WorkflowReviewInputKind,
  WorkflowStepType,
  workflowAudit,
  workflowStepGroups,
  workflowStepReviews,
  workflowSteps,
  workflowTemplates,
} from "@/lib/db/schema/workflows";
import { renderTemplates } from "@/lib/db/schema/templates";
import type { WorkflowStep } from "@/lib/workflows/types";

interface RuntimeWorkflowTemplate {
  id: string;
  name: string;
  description?: string | null;
  version: string;
}

export interface RuntimeWorkflow {
  template: RuntimeWorkflowTemplate;
  steps: WorkflowStep[];
}

class WorkflowBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowBuilderError";
  }
}

type StepRow = typeof workflowSteps.$inferSelect;
type GroupRow = typeof workflowStepGroups.$inferSelect;
type ReviewRow = typeof workflowStepReviews.$inferSelect;
type RenderTemplateRow = typeof renderTemplates.$inferSelect;

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new WorkflowBuilderError(message);
  }
}

function assertRenderLimit(count: number) {
  if (count > 1) {
    throw new WorkflowBuilderError(
      "Somente um passo do tipo render é permitido por workflow."
    );
  }
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toWorkflowStep(
  step: StepRow,
  groupMembers: GroupRow[],
  reviewRow: ReviewRow | undefined,
  stepsById: Map<string, StepRow>,
  renderTemplatesById: Map<string, RenderTemplateRow>,
  renderCount: { value: number }
): WorkflowStep {
  const base = {
    id: step.id,
    order: step.position,
    label: step.label ?? null,
  };

  const config = normalizeConfig(step.config);

  switch (step.type as WorkflowStepType) {
    case "agent": {
      ensure(step.agentId, `Passo ${step.id} do tipo agent precisa de agent_id.`);
      return {
        ...base,
        type: "agent",
        agentId: step.agentId,
        config,
      };
    }
    case "group": {
      ensure(
        step.sourceStepId,
        `Grupo ${step.id} precisa definir o passo de origem (input_from).`
      );

      const source = stepsById.get(step.sourceStepId);
      ensure(source, `Passo de origem ${step.sourceStepId} n�o encontrado para grupo ${step.id}.`);

      const members = groupMembers
        .filter((member) => member.stepId === step.id)
        .sort((a, b) => a.position - b.position)
        .map((member) => ({ agentId: member.memberAgentId, order: member.position }));

      ensure(members.length > 0, `Grupo ${step.id} precisa de pelo menos um membro.`);

      return {
        ...base,
        type: "group",
        members,
        inputFrom: step.sourceStepId,
        config,
      };
    }
    case "review_gate": {
      ensure(reviewRow, `Review gate ${step.id} est� sem configura��o.`);
      ensure(
        step.sourceStepId,
        `Review gate ${step.id} precisa apontar para um passo anterior v�lido.`
      );

      const source = stepsById.get(step.sourceStepId);
      ensure(source, `Passo de origem ${step.sourceStepId} n�o encontrado para review gate ${step.id}.`);

      const inputKind = reviewRow!.inputKind as WorkflowReviewInputKind;
      if (inputKind === "group") {
        ensure(
          source.type === "group",
          `Review gate ${step.id} com input group precisa referenciar um passo do tipo group.`
        );
      } else {
        ensure(
          source.type === "agent" || source.type === "translator",
          `Review gate ${step.id} com input agent precisa referenciar passo agent ou translator.`
        );
      }

      return {
        ...base,
        type: "review_gate",
        gateKey: reviewRow!.gateKey,
        sourceStepId: step.sourceStepId,
        sourceKind: inputKind,
        title: reviewRow!.title ?? null,
        instructions: reviewRow!.instructions ?? null,
        config: normalizeConfig(reviewRow!.config),
      };
    }
    case "translator": {
      ensure(step.agentId, `Translator ${step.id} precisa referenciar um agente tradutor.`);
      ensure(
        step.sourceStepId,
        `Translator ${step.id} precisa definir um passo de origem (group, review_gate ou agent).`
      );

      const source = stepsById.get(step.sourceStepId);
      ensure(source, `Passo de origem ${step.sourceStepId} n�o encontrado para translator ${step.id}.`);

      if (!(source.type === "group" || source.type === "review_gate")) {
        throw new WorkflowBuilderError(
          `Translator ${step.id} deve consumir um passo do tipo group ou review_gate.`
        );
      }

      return {
        ...base,
        type: "translator",
        translatorAgentId: step.agentId,
        sourceStepId: step.sourceStepId,
        config,
      };
    }
    case "render": {
      renderCount.value += 1;
      assertRenderLimit(renderCount.value);
      ensure(
        step.sourceStepId,
        `Render ${step.id} precisa apontar para um passo anterior (translator ou review gate).`
      );

      const source = stepsById.get(step.sourceStepId);
      ensure(source, `Passo de origem ${step.sourceStepId} nao encontrado para render ${step.id}.`);
      if (!(source.type === "translator" || source.type === "review_gate")) {
        throw new WorkflowBuilderError(
          `Render ${step.id} deve referenciar translator ou review_gate (ultima revisao).`
        );
      }

      const templateId = step.renderTemplateId;
      ensure(templateId, `Render ${step.id} precisa ter um render_template_id configurado.`);

      const templateRow = renderTemplatesById.get(templateId);
      ensure(
        templateRow,
        `Template ${templateId} nao encontrado para render ${step.id}.`
      );

      return {
        ...base,
        type: "render",
        sourceStepId: step.sourceStepId,
        templateId,
        templateName: templateRow.name,
        templateDescription: templateRow.description ?? null,
        config,
      };

    }
    default: {
      const exhaustive: never = step.type as never;
      throw new WorkflowBuilderError(`Tipo de passo n�o suportado: ${exhaustive}`);
    }
  }
}

function validateStepOrdering(steps: StepRow[]) {
  if (steps.length === 0) {
    return;
  }

  const positions = steps.map((step) => step.position);
  const sorted = [...positions].sort((a, b) => a - b);
  const isSequential = sorted.every((value, index) => value === index + 1);
  ensure(
    isSequential,
    "Posi��es dos passos devem ser sequenciais iniciando em 1."
  );
}

export async function buildRuntimeWorkflow(templateId: string): Promise<RuntimeWorkflow> {
  const template = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, templateId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!template) {
    throw new WorkflowBuilderError("Workflow template não encontrado.");
  }

  const stepRows = await db
    .select({
      id: workflowSteps.id,
      templateId: workflowSteps.templateId,
      type: workflowSteps.type,
      position: workflowSteps.position,
      label: workflowSteps.label,
      agentId: workflowSteps.agentId,
      renderTemplateId: workflowSteps.renderTemplateId,
      sourceStepId: workflowSteps.sourceStepId,
      config: workflowSteps.config,
      createdAt: workflowSteps.createdAt,
      updatedAt: workflowSteps.updatedAt,
    })
    .from(workflowSteps)
    .where(eq(workflowSteps.templateId, templateId))
    .orderBy(asc(workflowSteps.position));

  validateStepOrdering(stepRows);

  const stepIds = stepRows.map((step) => step.id);

  const renderTemplateIds = stepRows
    .filter((step) => step.type === "render" && step.renderTemplateId)
    .map((step) => step.renderTemplateId as string);
  const uniqueRenderTemplateIds = Array.from(new Set(renderTemplateIds));

  const [groupRows, reviewRows, renderTemplateRows] = await Promise.all([
    stepIds.length > 0
      ? db
          .select({
            id: workflowStepGroups.id,
            stepId: workflowStepGroups.stepId,
            memberAgentId: workflowStepGroups.memberAgentId,
            position: workflowStepGroups.position,
            createdAt: workflowStepGroups.createdAt,
            updatedAt: workflowStepGroups.updatedAt,
          })
          .from(workflowStepGroups)
          .where(inArray(workflowStepGroups.stepId, stepIds))
          .orderBy(
            asc(workflowStepGroups.stepId),
            asc(workflowStepGroups.position)
          )
      : [],
    stepIds.length > 0
      ? db
          .select({
            id: workflowStepReviews.id,
            stepId: workflowStepReviews.stepId,
            gateKey: workflowStepReviews.gateKey,
            inputKind: workflowStepReviews.inputKind,
            title: workflowStepReviews.title,
            instructions: workflowStepReviews.instructions,
            config: workflowStepReviews.config,
            createdAt: workflowStepReviews.createdAt,
            updatedAt: workflowStepReviews.updatedAt,
          })
          .from(workflowStepReviews)
          .where(inArray(workflowStepReviews.stepId, stepIds))
      : [],
    uniqueRenderTemplateIds.length > 0
      ? db
          .select({
            id: renderTemplates.id,
            name: renderTemplates.name,
            description: renderTemplates.description,
            updatedAt: renderTemplates.updatedAt,
          })
          .from(renderTemplates)
          .where(inArray(renderTemplates.id, uniqueRenderTemplateIds))
      : [],
  ]);

  const reviewByStep = new Map(reviewRows.map((row) => [row.stepId, row]));
  const stepsById = new Map(stepRows.map((row) => [row.id, row]));
  const renderTemplatesById = new Map<string, RenderTemplateRow>(
    renderTemplateRows.map((row) => [row.id, row as RenderTemplateRow])
  );
  const renderCount = { value: 0 };

  const runtimeSteps: WorkflowStep[] = stepRows.map((step) =>
    toWorkflowStep(
      step,
      groupRows,
      reviewByStep.get(step.id),
      stepsById,
      renderTemplatesById,
      renderCount
    )
  );

  assertRenderLimit(renderCount.value);

  return {
    template: {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      version: template.version,
    },
    steps: runtimeSteps,
  };
}

export function recordWorkflowAudit(
  templateId: string,
  changedBy: string | null,
  diff: Record<string, unknown>
) {
  return db.insert(workflowAudit).values({
    templateId,
    changedBy,
    diff,
  });
}

