import type { WorkflowStepType } from "@/lib/db/schema/workflows";

export interface TenantWorkflowOverride {
  tenantStepId: string;
  templateStepId: string;
  type: WorkflowStepType;
  order: number;
  label?: string | null;
  sourceStepId?: string | null;
  systemPromptOverride?: string | null;
  llmProviderOverride?: string | null;
  llmTokenRefOverride?: string | null;
  renderHtmlOverride?: string | null;
  configOverride?: Record<string, unknown>;
}

export interface TenantWorkflowSummary {
  id: string;
  tenantId: string;
  templateId: string;
  name: string;
  description?: string | null;
  version: string;
  status: "draft" | "ready";
  llmTokenRefDefault?: string | null;
  clonedAt: string;
  updatedAt: string;
}

export interface TenantWorkflowResolvedStep {
  templateStepId: string;
  tenantStepId: string;
  type: WorkflowStepType;
  order: number;
  label?: string | null;
  sourceStepId?: string | null;
  templateConfig: Record<string, unknown>;
  overrides: {
    systemPromptOverride?: string | null;
    llmProviderOverride?: string | null;
    llmTokenRefOverride?: string | null;
    renderHtmlOverride?: string | null;
    configOverride?: Record<string, unknown>;
  };
  agent?: {
    id: string;
    name: string;
    kind: string;
    defaultProvider?: string | null;
    systemPrompt?: string | null;
    webhookUrl?: string | null;
    webhookAuthHeader?: string | null;
  };
  renderTemplate?: {
    id: string;
    name: string;
    html: string;
  };
}

export interface TenantWorkflowWithTemplate {
  workflow: TenantWorkflowSummary & { status: "draft" | "ready" };
  template: {
    id: string;
    name: string;
    description?: string | null;
    version: string;
  };
  steps: TenantWorkflowResolvedStep[];
}
