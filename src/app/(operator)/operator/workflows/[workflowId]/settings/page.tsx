import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/auth/session";
import { getTenantWorkflowWithTemplate } from "@/lib/workflows/tenant";
import { SettingsClient } from "./settings-client";

interface SettingsPageProps {
  params: {
    workflowId: string;
  };
}

export default async function WorkflowSettingsPage({ params }: SettingsPageProps) {
  const session = await getSessionContext();

  if (!session || session.role !== "operator" || !session.tenantId) {
    return null;
  }

  const detail = await getTenantWorkflowWithTemplate(params.workflowId, session.tenantId);

  if (!detail) {
    notFound();
  }

  const workflow = {
    id: detail.workflow.id,
    name: detail.workflow.name,
    status: detail.workflow.status,
    llmTokenRefDefault: detail.workflow.llmTokenRefDefault ?? null,
    updatedAt: detail.workflow.updatedAt,
  };

  const template = {
    id: detail.template.id,
    name: detail.template.name,
    version: detail.template.version,
    description: detail.template.description ?? null,
  };

  const steps = detail.steps.map((step) => ({
    tenantStepId: step.tenantStepId,
    templateStepId: step.templateStepId,
    type: step.type,
    order: step.order,
    label: step.label ?? null,
    sourceStepId: step.sourceStepId ?? null,
    templateConfig: step.templateConfig,
    overrides: {
      systemPromptOverride: step.overrides.systemPromptOverride ?? null,
      llmProviderOverride: step.overrides.llmProviderOverride ?? null,
      llmTokenRefOverride: step.overrides.llmTokenRefOverride ?? null,
      renderHtmlOverride: step.overrides.renderHtmlOverride ?? null,
      configOverride: step.overrides.configOverride ?? {},
    },
    agent: step.agent
      ? {
          id: step.agent.id,
          name: step.agent.name,
          kind: step.agent.kind,
          defaultProvider: step.agent.defaultProvider ?? null,
          systemPrompt: step.agent.systemPrompt ?? null,
        }
      : null,
    renderTemplate: step.renderTemplate
      ? {
          id: step.renderTemplate.id,
          name: step.renderTemplate.name,
          html: step.renderTemplate.html,
        }
      : null,
  }));

  return <SettingsClient workflow={workflow} template={template} steps={steps} />;
}
