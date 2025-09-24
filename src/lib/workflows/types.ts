import type { WorkflowReviewInputKind } from "@/lib/db/schema/workflows";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
}

export interface WorkflowStepBase {
  id: string;
  type: string;
  order: number;
  label?: string | null;
}

export interface WorkflowAgentStep extends WorkflowStepBase {
  type: "agent";
  agentId: string;
  config?: Record<string, unknown>;
}

export interface WorkflowGroupMember {
  agentId: string;
  order: number;
}

export interface WorkflowGroupStep extends WorkflowStepBase {
  type: "group";
  members: WorkflowGroupMember[];
  inputFrom: string;
  config?: Record<string, unknown>;
}

export interface WorkflowReviewGateStep extends WorkflowStepBase {
  type: "review_gate";
  gateKey: string;
  sourceStepId: string;
  sourceKind: WorkflowReviewInputKind;
  title?: string | null;
  instructions?: string | null;
  config?: Record<string, unknown>;
}

export interface WorkflowTranslatorStep extends WorkflowStepBase {
  type: "translator";
  translatorAgentId: string | null;
  sourceStepId: string;
  config?: Record<string, unknown>;
}

export interface WorkflowRenderStep extends WorkflowStepBase {
  type: "render";
  sourceStepId: string;
  templateId: string;
  config?: Record<string, unknown>;
}

export type WorkflowStep =
  | WorkflowAgentStep
  | WorkflowGroupStep
  | WorkflowReviewGateStep
  | WorkflowTranslatorStep
  | WorkflowRenderStep;

export type WorkflowStepType = WorkflowStep["type"];
