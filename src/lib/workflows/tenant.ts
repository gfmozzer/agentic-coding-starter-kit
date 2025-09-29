import { asc, and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  tenantWorkflows,
  tenantWorkflowSteps,
  workflowSteps,
  workflowStepReviews,
  workflowTemplates,
} from "@/lib/db/schema/workflows";
import { workflowTemplateTenants } from "@/lib/db/schema/workflow-publishing";
import { renderTemplates } from "@/lib/db/schema/templates";
import { agents } from "@/lib/db/schema/agents";
import type {
  TenantWorkflowResolvedStep,
  TenantWorkflowSummary,
  TenantWorkflowWithTemplate,
} from "@/lib/workflows/tenant-types";

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function listTenantWorkflows(tenantId: string) {
  const rows = await db
    .select({
      id: tenantWorkflows.id,
      tenantId: tenantWorkflows.tenantId,
      templateId: tenantWorkflows.workflowTemplateId,
      name: tenantWorkflows.name,
      description: tenantWorkflows.description,
      version: tenantWorkflows.version,
      status: tenantWorkflows.status,
      llmTokenRefDefault: tenantWorkflows.llmTokenRefDefault,
      clonedAt: tenantWorkflows.clonedAt,
      updatedAt: tenantWorkflows.updatedAt,
    })
    .from(tenantWorkflows)
    .where(eq(tenantWorkflows.tenantId, tenantId))
    .orderBy(asc(tenantWorkflows.name));

  return rows.map<TenantWorkflowSummary>((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    templateId: row.templateId,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    llmTokenRefDefault: row.llmTokenRefDefault ?? null,
    clonedAt: row.clonedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listPublishedWorkflowTemplatesForTenant(tenantId: string) {
  return db
    .select({
      templateId: workflowTemplateTenants.workflowTemplateId,
      bindingId: workflowTemplateTenants.id,
      name: workflowTemplates.name,
      description: workflowTemplates.description,
      version: workflowTemplates.version,
      isDefault: workflowTemplateTenants.isDefault,
      publishedAt: workflowTemplateTenants.publishedAt,
    })
    .from(workflowTemplateTenants)
    .innerJoin(
      workflowTemplates,
      eq(workflowTemplates.id, workflowTemplateTenants.workflowTemplateId)
    )
    .where(
      and(
        eq(workflowTemplateTenants.tenantId, tenantId),
        isNull(workflowTemplateTenants.unpublishedAt)
      )
    )
    .orderBy(asc(workflowTemplates.name));
}

export async function getTenantWorkflowWithTemplate(
  workflowId: string,
  tenantId: string
): Promise<TenantWorkflowWithTemplate | null> {
  const workflowRow = await db
    .select({
      id: tenantWorkflows.id,
      tenantId: tenantWorkflows.tenantId,
      templateId: tenantWorkflows.workflowTemplateId,
      name: tenantWorkflows.name,
      description: tenantWorkflows.description,
      version: tenantWorkflows.version,
      status: tenantWorkflows.status,
      llmTokenRefDefault: tenantWorkflows.llmTokenRefDefault,
      clonedAt: tenantWorkflows.clonedAt,
      updatedAt: tenantWorkflows.updatedAt,
      templateName: workflowTemplates.name,
      templateDescription: workflowTemplates.description,
      templateVersion: workflowTemplates.version,
    })
    .from(tenantWorkflows)
    .innerJoin(
      workflowTemplates,
      eq(workflowTemplates.id, tenantWorkflows.workflowTemplateId)
    )
    .where(and(eq(tenantWorkflows.id, workflowId), eq(tenantWorkflows.tenantId, tenantId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workflowRow) {
    return null;
  }

  const templateSteps = await db
    .select({
      id: workflowSteps.id,
      type: workflowSteps.type,
      position: workflowSteps.position,
      label: workflowSteps.label,
      sourceStepId: workflowSteps.sourceStepId,
      agentId: workflowSteps.agentId,
      renderTemplateId: workflowSteps.renderTemplateId,
      config: workflowSteps.config,
    })
    .from(workflowSteps)
    .where(eq(workflowSteps.templateId, workflowRow.templateId))
    .orderBy(asc(workflowSteps.position));

  const reviewRows = await db
    .select({
      stepId: workflowStepReviews.stepId,
      gateKey: workflowStepReviews.gateKey,
      inputKind: workflowStepReviews.inputKind,
      title: workflowStepReviews.title,
      instructions: workflowStepReviews.instructions,
      config: workflowStepReviews.config,
    })
    .from(workflowStepReviews)
    .where(inArray(workflowStepReviews.stepId, templateSteps.map((step) => step.id)));

  const reviewMap = new Map(reviewRows.map((row) => [row.stepId, row]));

  const tenantSteps = await db
    .select({
      id: tenantWorkflowSteps.id,
      templateStepId: tenantWorkflowSteps.templateStepId,
      type: tenantWorkflowSteps.type,
      position: tenantWorkflowSteps.position,
      label: tenantWorkflowSteps.label,
      sourceStepId: tenantWorkflowSteps.sourceStepId,
      systemPromptOverride: tenantWorkflowSteps.systemPromptOverride,
      llmProviderOverride: tenantWorkflowSteps.llmProviderOverride,
      llmTokenRefOverride: tenantWorkflowSteps.llmTokenRefOverride,
      renderHtmlOverride: tenantWorkflowSteps.renderHtmlOverride,
      configOverride: tenantWorkflowSteps.configOverride,
    })
    .from(tenantWorkflowSteps)
    .where(eq(tenantWorkflowSteps.tenantWorkflowId, workflowRow.id));

  const tenantStepMap = new Map(tenantSteps.map((step) => [step.templateStepId, step]));

  const agentIds = templateSteps
    .map((step) => step.agentId)
    .filter((value): value is string => Boolean(value));

  const uniqueAgentIds = Array.from(new Set(agentIds));

  const agentRows = uniqueAgentIds.length
    ? await db
        .select({
          id: agents.id,
          name: agents.name,
          kind: agents.kind,
          systemPrompt: agents.systemPrompt,
          defaultProvider: agents.defaultProvider,
          webhookUrl: agents.webhookUrl,
          webhookAuthHeader: agents.webhookAuthHeader,
        })
        .from(agents)
        .where(inArray(agents.id, uniqueAgentIds))
    : [];

  const agentMap = new Map(agentRows.map((agent) => [agent.id, agent]));

  const renderTemplateIds = templateSteps
    .map((step) => step.renderTemplateId)
    .filter((value): value is string => Boolean(value));

  const renderRows = renderTemplateIds.length
    ? await db
        .select({
          id: renderTemplates.id,
          name: renderTemplates.name,
          html: renderTemplates.html,
        })
        .from(renderTemplates)
        .where(inArray(renderTemplates.id, renderTemplateIds))
    : [];

  const renderMap = new Map(renderRows.map((row) => [row.id, row]));

  const steps: TenantWorkflowResolvedStep[] = templateSteps.map((templateStep) => {
    const tenantStep = tenantStepMap.get(templateStep.id);
    if (!tenantStep) {
      throw new Error("Tenant workflow step nao encontrado para template step.");
    }
    const review = reviewMap.get(templateStep.id);
    const templateConfig = {
      ...normalizeRecord(templateStep.config),
      ...(review
        ? {
            gateKey: review.gateKey,
            inputKind: review.inputKind,
            title: review.title ?? undefined,
            instructions: review.instructions ?? undefined,
            reviewConfig: normalizeRecord(review.config),
          }
        : {}),
    };

    const agent = templateStep.agentId ? agentMap.get(templateStep.agentId) : undefined;
    const renderTemplate = templateStep.renderTemplateId
      ? renderMap.get(templateStep.renderTemplateId)
      : undefined;

    return {
      templateStepId: templateStep.id,
      tenantStepId: tenantStep.id,
      type: templateStep.type,
      order: templateStep.position,
      label: templateStep.label ?? undefined,
      sourceStepId: templateStep.sourceStepId ?? undefined,
      templateConfig,
      overrides: {
        systemPromptOverride: tenantStep.systemPromptOverride ?? undefined,
        llmProviderOverride: tenantStep.llmProviderOverride ?? undefined,
        llmTokenRefOverride: tenantStep.llmTokenRefOverride ?? undefined,
        renderHtmlOverride: tenantStep.renderHtmlOverride ?? undefined,
        configOverride: tenantStep ? normalizeRecord(tenantStep.configOverride) : {},
      },
      agent: agent
        ? {
            id: agent.id,
            name: agent.name,
            kind: agent.kind,
            defaultProvider: agent.defaultProvider,
            systemPrompt: agent.systemPrompt,
            webhookUrl: agent.webhookUrl ?? null,
            webhookAuthHeader: agent.webhookAuthHeader ?? null,
          }
        : undefined,
      renderTemplate: renderTemplate
        ? {
            id: renderTemplate.id,
            name: renderTemplate.name,
            html: renderTemplate.html,
          }
        : undefined,
    };
  });

  return {
    workflow: {
      id: workflowRow.id,
      tenantId: workflowRow.tenantId,
      templateId: workflowRow.templateId,
      name: workflowRow.name,
      description: workflowRow.description,
      version: workflowRow.version,
      status: workflowRow.status,
      llmTokenRefDefault: workflowRow.llmTokenRefDefault ?? null,
      clonedAt: workflowRow.clonedAt.toISOString(),
      updatedAt: workflowRow.updatedAt.toISOString(),
    },
    template: {
      id: workflowRow.templateId,
      name: workflowRow.templateName,
      description: workflowRow.templateDescription ?? undefined,
      version: workflowRow.version,
    },
    steps,
  };
}





