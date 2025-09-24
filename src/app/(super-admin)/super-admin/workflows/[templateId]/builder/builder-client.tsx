"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { saveWorkflowTemplateAction } from "@/lib/actions/super-admin/workflows";
import type { ActionState } from "@/lib/actions/super-admin/agent-action-state";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";
import type { AgentDefinition } from "@/lib/ai/types";
import type {
  WorkflowGroupMember,
  WorkflowReviewGateStep,
  WorkflowStep,
  WorkflowStepType,
} from "@/lib/workflows/types";

interface RenderTemplateOption {
  id: string;
  name: string;
  version: string;
  tenantId: string;
}

interface BuilderClientProps {
  template: {
    id: string;
    name: string;
    description: string;
    version: string;
  };
  initialSteps: WorkflowStep[];
  agents: AgentDefinition[];
  renderTemplates: RenderTemplateOption[];
}

const STEP_LABEL: Record<WorkflowStepType, string> = {
  agent: "Agente",
  group: "Grupo",
  review_gate: "Review gate",
  translator: "Tradutor",
  render: "Renderiza��o",
};

const TYPE_PREFIX: Record<WorkflowStepType, string> = {
  agent: "a",
  group: "g",
  review_gate: "rv",
  translator: "tr",
  render: "rend",
};

const STEP_TYPE_OPTIONS: { value: WorkflowStepType; label: string }[] = [
  { value: "agent", label: "Agente" },
  { value: "group", label: "Grupo" },
  { value: "review_gate", label: "Review gate" },
  { value: "translator", label: "Tradutor" },
  { value: "render", label: "Render" },
];

function cloneStep(step: WorkflowStep): WorkflowStep {
  switch (step.type) {
    case "group":
      return {
        ...step,
        members: step.members.map((member) => ({ ...member })),
        config: { ...(step.config ?? {}) },
      };
    case "review_gate":
      return {
        ...step,
        config: { ...(step.config ?? {}) },
      };
    case "translator":
      return {
        ...step,
        config: { ...(step.config ?? {}) },
      };
    case "render":
      return {
        ...step,
        config: { ...(step.config ?? {}) },
      };
    default:
      return {
        ...step,
        config: { ...(step.config ?? {}) },
      };
  }
}

function reindexSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ ...step, order: index + 1 }));
}

function generateStepId(type: WorkflowStepType, existingIds: Set<string>) {
  const prefix = TYPE_PREFIX[type] ?? "step";
  let counter = existingIds.size + 1;
  let candidate = `${prefix}_${counter}`;
  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${prefix}_${counter}`;
  }
  return candidate;
}

function buildPayload(
  template: BuilderClientProps["template"],
  steps: WorkflowStep[]
) {
  return {
    templateId: template.id,
    name: template.name,
    description: template.description,
    version: template.version,
    steps: steps.map((step) => {
      const base = {
        id: step.id,
        order: step.order,
        label: step.label ?? undefined,
        config: step.config ?? {},
        type: step.type,
      } as Record<string, unknown>;

      switch (step.type) {
        case "agent":
          return {
            ...base,
            type: "agent" as const,
            agentId: step.agentId,
          };
        case "group":
          return {
            ...base,
            type: "group" as const,
            inputFrom: step.inputFrom,
            members: step.members,
          };
        case "review_gate":
          return {
            ...base,
            type: "review_gate" as const,
            gateKey: step.gateKey,
            sourceStepId: step.sourceStepId,
            sourceKind: step.sourceKind,
            title: step.title ?? undefined,
            instructions: step.instructions ?? undefined,
          };
        case "translator":
          return {
            ...base,
            type: "translator" as const,
            translatorAgentId: step.translatorAgentId,
            sourceStepId: step.sourceStepId,
          };
        case "render":
          return {
            ...base,
            type: "render" as const,
            sourceStepId: step.sourceStepId,
            templateId: step.templateId,
          };
        default:
          return base;
      }
    }),
  };
}


export function BuilderClient(props: BuilderClientProps) {
  const router = useRouter();
  const [formState, formAction] = useActionState<ActionState, FormData>(
    saveWorkflowTemplateAction,
    initialActionState
  );

  const [templateState, setTemplateState] = useState({
    name: props.template.name,
    description: props.template.description ?? "",
    version: props.template.version,
  });

  const [steps, setSteps] = useState<WorkflowStep[]>(() =>
    reindexSteps(props.initialSteps.map(cloneStep))
  );

  const agentOptions = useMemo(
    () =>
      props.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
      })),
    [props.agents]
  );

  const structuredAgents = useMemo(
    () => agentOptions.filter((agent) => agent.kind === "structured"),
    [agentOptions]
  );

  const translatorAgents = useMemo(
    () => agentOptions.filter((agent) => agent.kind === "translator"),
    [agentOptions]
  );

  const ocrAgents = useMemo(
    () => agentOptions.filter((agent) => agent.kind === "ocr"),
    [agentOptions]
  );

  useEffect(() => {
    if (formState?.fieldErrors?.redirectTo) {
      router.push(formState.fieldErrors.redirectTo);
    }
  }, [formState?.fieldErrors?.redirectTo, router]);

  const handleTemplateChange = (
    field: "name" | "description" | "version",
    value: string
  ) => {
    setTemplateState((prev) => ({ ...prev, [field]: value }));
  };

  const handleStepIdChange = (stepId: string, newId: string) => {
    const normalized = newId.trim();
    if (!normalized) {
      return;
    }

    setSteps((prev) => {
      const updated = prev.map((step) => {
        if (step.id === stepId) {
          return { ...step, id: normalized } as WorkflowStep;
        }

        switch (step.type) {
          case "group":
            return step.inputFrom === stepId
              ? { ...step, inputFrom: normalized }
              : step;
          case "review_gate":
            return step.sourceStepId === stepId
              ? { ...step, sourceStepId: normalized }
              : step;
          case "translator":
            return step.sourceStepId === stepId
              ? { ...step, sourceStepId: normalized }
              : step;
          case "render":
            return step.sourceStepId === stepId
              ? { ...step, sourceStepId: normalized }
              : step;
          default:
            return step;
        }
      });

      return reindexSteps(updated);
    });
  };

  const handleMoveStep = (stepId: string, direction: "up" | "down") => {
    setSteps((prev) => {
      const sorted = reindexSteps(prev);
      const index = sorted.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return prev;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) {
        return prev;
      }

      const next = [...sorted];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return reindexSteps(next);
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps((prev) => {
      const filtered = prev.filter((step) => step.id !== stepId).map((step) => {
        switch (step.type) {
          case "group":
            return step.inputFrom === stepId ? { ...step, inputFrom: "" } : step;
          case "review_gate":
            return step.sourceStepId === stepId ? { ...step, sourceStepId: "" } : step;
          case "translator":
            return step.sourceStepId === stepId ? { ...step, sourceStepId: "" } : step;
          case "render":
            return step.sourceStepId === stepId ? { ...step, sourceStepId: "" } : step;
          default:
            return step;
        }
      });

      return reindexSteps(filtered);
    });
  };


  const addStep = (type: WorkflowStepType) => {
    setSteps((prev) => {
      const sorted = reindexSteps(prev);
      const existingIds = new Set(sorted.map((step) => step.id));
      const newId = generateStepId(type, existingIds);
      const lastStep = sorted[sorted.length - 1];

      const createGroupMembers = (): WorkflowGroupMember[] => {
        if (structuredAgents.length === 0) {
          return [];
        }
        return [
          {
            agentId: structuredAgents[0].id,
            order: 1,
          },
        ];
      };

      const defaultSourceId = lastStep?.id ?? "";
      const defaultSourceKind: WorkflowReviewGateStep["sourceKind"] =
        lastStep && lastStep.type === "group" ? "group" : "agent";

      let newStep: WorkflowStep;

      switch (type) {
        case "agent": {
          const defaultAgent =
            ocrAgents[0]?.id || structuredAgents[0]?.id || agentOptions[0]?.id || "";
          newStep = {
            id: newId,
            type: "agent",
            order: sorted.length + 1,
            label: null,
            agentId: defaultAgent,
            config: {},
          };
          break;
        }
        case "group": {
          newStep = {
            id: newId,
            type: "group",
            order: sorted.length + 1,
            label: null,
            inputFrom: defaultSourceId,
            members: createGroupMembers(),
            config: {},
          };
          break;
        }
        case "review_gate": {
          newStep = {
            id: newId,
            type: "review_gate",
            order: sorted.length + 1,
            label: null,
            gateKey: newId,
            sourceStepId: defaultSourceId,
            sourceKind: defaultSourceKind,
            title: null,
            instructions: null,
            config: {},
          };
          break;
        }
        case "translator": {
          const translatorId = translatorAgents[0]?.id || "";
          newStep = {
            id: newId,
            type: "translator",
            order: sorted.length + 1,
            label: null,
            translatorAgentId: translatorId,
            sourceStepId: defaultSourceId,
            config: {},
          };
          break;
        }
        case "render": {
          const templateId = props.renderTemplates[0]?.id || "";
          newStep = {
            id: newId,
            type: "render",
            order: sorted.length + 1,
            label: null,
            sourceStepId: defaultSourceId,
            templateId,
            config: templateId ? { templateId } : {},
          };
          break;
        }
        default:
          newStep = {
            id: newId,
            type: "agent",
            order: sorted.length + 1,
            label: null,
            agentId: agentOptions[0]?.id || "",
            config: {},
          };
      }

      return reindexSteps([...sorted, newStep]);
    });
  };

  const updateStep = (
    stepId: string,
    updater: (step: WorkflowStep) => WorkflowStep
  ) => {
    setSteps((prev) => {
      const updated = prev.map((step) => (step.id === stepId ? updater(step) : step));
      return reindexSteps(updated);
    });
  };

  const handleGroupMemberChange = (
    stepId: string,
    index: number,
    updater: (member: WorkflowGroupMember) => WorkflowGroupMember
  ) => {
    updateStep(stepId, (step) => {
      if (step.type !== "group") {
        return step;
      }
      const nextMembers = step.members.map((member, memberIndex) =>
        memberIndex === index ? updater(member) : member
      );
      return {
        ...step,
        members: nextMembers,
      };
    });
  };

  const handleAddGroupMember = (stepId: string) => {
    updateStep(stepId, (step) => {
      if (step.type !== "group") {
        return step;
      }
      const fallback = structuredAgents[0]?.id || agentOptions[0]?.id || "";
      const nextMembers = [
        ...step.members,
        {
          agentId: fallback,
          order: step.members.length + 1,
        },
      ];
      return {
        ...step,
        members: nextMembers,
      };
    });
  };

  const handleRemoveGroupMember = (stepId: string, index: number) => {
    updateStep(stepId, (step) => {
      if (step.type !== "group") {
        return step;
      }
      const nextMembers = step.members
        .filter((_, memberIndex) => memberIndex !== index)
        .map((member, memberIndex) => ({ ...member, order: memberIndex + 1 }));
      return {
        ...step,
        members: nextMembers,
      };
    });
  };

  const handleMoveGroupMember = (
    stepId: string,
    index: number,
    direction: "up" | "down"
  ) => {
    updateStep(stepId, (step) => {
      if (step.type !== "group") {
        return step;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= step.members.length) {
        return step;
      }
      const members = [...step.members];
      [members[index], members[targetIndex]] = [members[targetIndex], members[index]];
      const normalized = members.map((member, memberIndex) => ({
        ...member,
        order: memberIndex + 1,
      }));
      return {
        ...step,
        members: normalized,
      };
    });
  };

  const handleReviewSourceChange = (stepId: string, sourceId: string) => {
    updateStep(stepId, (step) => {
      if (step.type !== "review_gate") {
        return step;
      }
      const referenced = steps.find((candidate) => candidate.id === sourceId);
      const sourceKind = referenced?.type === "group" ? "group" : "agent";
      return {
        ...step,
        sourceStepId: sourceId,
        sourceKind,
      };
    });
  };

  const renderSourceOptions = (
    currentOrder: number,
    allowed: WorkflowStepType[]
  ) =>
    steps
      .filter((step) => step.order < currentOrder && allowed.includes(step.type))
      .map((step) => ({ id: step.id, label: `${step.order}. ${step.id}` }));

  const hasRenderStep = steps.some((step) => step.type === "render");

  const availableStepTypes = STEP_TYPE_OPTIONS.filter((option) => {
    if (option.value === "group" && steps.length === 0) {
      return false;
    }
    if (option.value === "review_gate" && steps.length === 0) {
      return false;
    }
    if (option.value === "translator" && steps.length === 0) {
      return false;
    }
    if (option.value === "render" && (steps.length === 0 || hasRenderStep)) {
      return false;
    }
    return true;
  });

  const payloadPreview = useMemo(() => {
    const preparedTemplate = {
      id: props.template.id,
      name: templateState.name,
      description: templateState.description,
      version: templateState.version,
    };
    const preparedSteps = reindexSteps(steps);
    return JSON.stringify(buildPayload(preparedTemplate, preparedSteps), null, 2);
  }, [steps, templateState, props.template.id]);

  return (
    <form className="space-y-6" action={formAction}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Workflow builder</h1>
        <p className="text-sm text-muted-foreground">
          Defina a sequência de agentes, grupos, review gates e renderização para gerar o workflow global.
        </p>
      </div>

      {formState?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formState.error}
        </div>
      )}
      {formState?.success && (
        <div className="rounded-md border border-emerald-300/50 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {formState.success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="workflow-name">
            Nome do workflow
          </label>
          <input
            id="workflow-name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={templateState.name}
            onChange={(event) => handleTemplateChange("name", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="workflow-version">
            Versão
          </label>
          <input
            id="workflow-version"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={templateState.version}
            onChange={(event) => handleTemplateChange("version", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="workflow-description">
          Descrição (opcional)
        </label>
        <textarea
          id="workflow-description"
          className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={templateState.description}
          onChange={(event) => handleTemplateChange("description", event.target.value)}
        />
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">Adicionar passo:</span>
        {availableStepTypes.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addStep(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {steps.length === 0 && (
          <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Adicione o primeiro passo para começar o workflow.
          </div>
        )}
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            agentOptions={agentOptions}
            structuredAgents={structuredAgents}
            translatorAgents={translatorAgents}
            renderTemplates={props.renderTemplates}
            renderSourceOptions={renderSourceOptions}
            onStepIdChange={handleStepIdChange}
            onMoveStep={handleMoveStep}
            onRemoveStep={handleRemoveStep}
            onUpdateStep={updateStep}
            onGroupMemberChange={handleGroupMemberChange}
            onAddGroupMember={handleAddGroupMember}
            onRemoveGroupMember={handleRemoveGroupMember}
            onMoveGroupMember={handleMoveGroupMember}
            onReviewSourceChange={handleReviewSourceChange}
          />
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Preview JSON</label>
        <pre className="max-h-64 overflow-auto rounded-md border bg-muted px-3 py-2 text-xs">
{payloadPreview}
        </pre>
      </div>

      <div className="flex items-center justify-end gap-3">
        <input type="hidden" name="payload" value={payloadPreview} />
        <Button type="submit">Salvar workflow</Button>
      </div>
    </form>
  );
}

interface StepCardProps {
  step: WorkflowStep;
  agentOptions: Array<{ id: string; name: string; kind: string }>;
  structuredAgents: Array<{ id: string; name: string; kind: string }>;
  translatorAgents: Array<{ id: string; name: string; kind: string }>;
  renderTemplates: RenderTemplateOption[];
  renderSourceOptions: (
    currentOrder: number,
    allowed: WorkflowStepType[]
  ) => Array<{ id: string; label: string }>;
  onStepIdChange: (stepId: string, newId: string) => void;
  onMoveStep: (stepId: string, direction: "up" | "down") => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updater: (step: WorkflowStep) => WorkflowStep) => void;
  onGroupMemberChange: (
    stepId: string,
    index: number,
    updater: (member: WorkflowGroupMember) => WorkflowGroupMember
  ) => void;
  onAddGroupMember: (stepId: string) => void;
  onRemoveGroupMember: (stepId: string, index: number) => void;
  onMoveGroupMember: (stepId: string, index: number, direction: "up" | "down") => void;
  onReviewSourceChange: (stepId: string, sourceId: string) => void;
}

function StepCard({
  step,
  agentOptions,
  structuredAgents,
  translatorAgents,
  renderTemplates,
  renderSourceOptions,
  onStepIdChange,
  onMoveStep,
  onRemoveStep,
  onUpdateStep,
  onGroupMemberChange,
  onAddGroupMember,
  onRemoveGroupMember,
  onMoveGroupMember,
  onReviewSourceChange,
}: StepCardProps) {
  const stepTypeLabel = STEP_LABEL[step.type];

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {step.order}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {stepTypeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onMoveStep(step.id, "up")}
            disabled={step.order === 1}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onMoveStep(step.id, "down")}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemoveStep(step.id)}
            className="text-destructive hover:text-destructive"
          >
            ×
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">ID do passo</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={step.id}
              onChange={(e) => onStepIdChange(step.id, e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Label (opcional)</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={step.label ?? ""}
              onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, label: e.target.value || null }))}
            />
          </div>
        </div>

        {step.type === "agent" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Agente</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={step.agentId}
              onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, agentId: e.target.value } as WorkflowStep))}
            >
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.kind})
                </option>
              ))}
            </select>
          </div>
        )}

        {step.type === "group" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Passo de origem</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.inputFrom}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, inputFrom: e.target.value } as WorkflowStep))}
              >
                <option value="">Selecione...</option>
                {renderSourceOptions(step.order, ["agent", "group", "translator"]).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Membros do grupo</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onAddGroupMember(step.id)}
                >
                  Adicionar membro
                </Button>
              </div>
              {step.members.map((member, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded border">
                  <select
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={member.agentId}
                    onChange={(e) => onGroupMemberChange(step.id, index, (m) => ({ ...m, agentId: e.target.value }))}
                  >
                    {structuredAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onMoveGroupMember(step.id, index, "up")}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onMoveGroupMember(step.id, index, "down")}
                      disabled={index === step.members.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveGroupMember(step.id, index)}
                      className="text-destructive hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step.type === "review_gate" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gate Key</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={step.gateKey}
                  onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, gateKey: e.target.value } as WorkflowStep))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Passo de origem</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={step.sourceStepId}
                  onChange={(e) => onReviewSourceChange(step.id, e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {renderSourceOptions(step.order, ["agent", "group", "translator"]).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.title ?? ""}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, title: e.target.value || null } as WorkflowStep))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Instruções</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-20"
                value={step.instructions ?? ""}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, instructions: e.target.value || null } as WorkflowStep))}
              />
            </div>
          </div>
        )}

        {step.type === "translator" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agente Tradutor</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.translatorAgentId ?? ""}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, translatorAgentId: e.target.value } as WorkflowStep))}
              >
                <option value="">Selecione...</option>
                {translatorAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Passo de origem</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.sourceStepId}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, sourceStepId: e.target.value } as WorkflowStep))}
              >
                <option value="">Selecione...</option>
                {renderSourceOptions(step.order, ["group", "review_gate"]).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step.type === "render" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.templateId}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, templateId: e.target.value } as WorkflowStep))}
              >
                <option value="">Selecione...</option>
                {renderTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (v{template.version})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Passo de origem</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.sourceStepId}
                onChange={(e) => onUpdateStep(step.id, (s) => ({ ...s, sourceStepId: e.target.value } as WorkflowStep))}
              >
                <option value="">Selecione...</option>
                {renderSourceOptions(step.order, ["translator", "review_gate"]).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
