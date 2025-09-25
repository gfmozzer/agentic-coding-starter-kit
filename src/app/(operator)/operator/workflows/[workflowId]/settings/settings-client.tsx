"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";

import { saveTenantWorkflowConfigurationAction } from "@/lib/actions/operator/workflows";
import type { ActionState } from "@/lib/actions/super-admin/agent-action-state";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type StepType = "agent" | "group" | "review_gate" | "translator" | "render";

interface SettingsClientProps {
  workflow: {
    id: string;
    name: string;
    status: "draft" | "ready";
    llmTokenRefDefault: string | null;
    updatedAt: string;
  };
  template: {
    id: string;
    name: string;
    version: string;
    description: string | null;
  };
  steps: Array<{
    tenantStepId: string;
    templateStepId: string;
    type: StepType;
    order: number;
    label: string | null;
    sourceStepId: string | null;
    templateConfig: Record<string, unknown>;
    overrides: {
      systemPromptOverride: string | null;
      llmProviderOverride: string | null;
      llmTokenRefOverride: string | null;
      renderHtmlOverride: string | null;
      configOverride: Record<string, unknown> | undefined;
    };
    agent: {
      id: string;
      name: string;
      kind: string;
      defaultProvider: string | null;
      systemPrompt: string | null;
    } | null;
    renderTemplate: {
      id: string;
      name: string;
      html: string;
    } | null;
  }>;
}

interface StepState {
  tenantStepId: string;
  templateStepId: string;
  type: StepType;
  order: number;
  label: string | null;
  sourceStepId: string | null;
  systemPromptOverride: string;
  llmProviderOverride: string;
  llmTokenRefOverride: string;
  renderHtmlOverride: string;
  configOverride: Record<string, unknown>;
  templatePrompt: string;
  templateProvider: string;
  templateHtml: string;
  agentName: string | null;
  agentKind: string | null;
  renderTemplateName: string | null;
}

type TabKey = "prompts" | "render" | "tokens";

interface DiffRow {
  type: "unchanged" | "removed" | "added";
  base: string;
  target: string;
}

function trimToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatStepType(type: StepType) {
  switch (type) {
    case "agent":
      return "Agente";
    case "group":
      return "Grupo de extratores";
    case "review_gate":
      return "Review gate";
    case "translator":
      return "Tradutor";
    case "render":
      return "Renderizacao";
    default:
      return type;
  }
}

function computeLineDiff(base: string, target: string): DiffRow[] {
  const baseLines = base.split(/\r?\n/);
  const targetLines = target.split(/\r?\n/);

  const m = baseLines.length;
  const n = targetLines.length;
  const matrix: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (baseLines[i] === targetLines[j]) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (baseLines[i] === targetLines[j]) {
      rows.push({ type: "unchanged", base: baseLines[i], target: targetLines[j] });
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      rows.push({ type: "removed", base: baseLines[i], target: "" });
      i += 1;
    } else {
      rows.push({ type: "added", base: "", target: targetLines[j] });
      j += 1;
    }
  }

  while (i < m) {
    rows.push({ type: "removed", base: baseLines[i], target: "" });
    i += 1;
  }

  while (j < n) {
    rows.push({ type: "added", base: "", target: targetLines[j] });
    j += 1;
  }

  return rows;
}

function DiffViewer(props: { base: string; target: string }) {
  const { base, target } = props;
  const diffRows = useMemo(() => computeLineDiff(base, target), [base, target]);

  if (!base && !target) {
    return <p className="text-xs text-muted-foreground">Nenhum conteudo para comparar.</p>;
  }

  const hasChanges = diffRows.some((row) => row.type !== "unchanged");

  if (!hasChanges) {
    return (
      <p className="text-xs text-muted-foreground">
        Override identico ao template. Qualquer ajuste aparecera aqui.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border text-xs shadow-sm">
      <div className="grid grid-cols-2 bg-muted/50 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        <div className="px-3 py-2">Template</div>
        <div className="px-3 py-2">Override</div>
      </div>
      <div className="grid grid-cols-2">
        {diffRows.map((row, index) => (
          <Fragment key={`diff-${index}`}>
            <pre
              className={cn(
                "whitespace-pre-wrap px-3 py-1 font-mono text-[0.75rem] leading-relaxed",
                row.type === "removed" && "bg-destructive/10 text-destructive"
              )}
            >
              {row.base}
            </pre>
            <pre
              className={cn(
                "whitespace-pre-wrap px-3 py-1 font-mono text-[0.75rem] leading-relaxed",
                row.type === "added" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
              )}
            >
              {row.target}
            </pre>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function StepHeader(props: { step: StepState }) {
  const { step } = props;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          {step.agentName ?? step.renderTemplateName ?? step.label ?? "Passo sem rotulo"}
        </p>
        <p className="text-xs text-muted-foreground">
          Ordem {step.order} • {formatStepType(step.type)}
        </p>
      </div>
      <Badge variant="outline" className="text-xs">
        {step.type}
      </Badge>
    </div>
  );
}

export function SettingsClient({ workflow, template, steps }: SettingsClientProps) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "prompts", label: "Prompts" },
    { key: "render", label: "Render HTML" },
    { key: "tokens", label: "Tokens" },
  ];

  const [activeTab, setActiveTab] = useState<TabKey>("prompts");
  const [defaultToken, setDefaultToken] = useState<string>(workflow.llmTokenRefDefault ?? "");
  const [status, setStatus] = useState<"draft" | "ready">(workflow.status);

  const computedSteps = useMemo<StepState[]>(
    () =>
      steps.map((step) => ({
        tenantStepId: step.tenantStepId,
        templateStepId: step.templateStepId,
        type: step.type,
        order: step.order,
        label: step.label ?? null,
        sourceStepId: step.sourceStepId ?? null,
        systemPromptOverride: step.overrides.systemPromptOverride ?? "",
        llmProviderOverride: step.overrides.llmProviderOverride ?? "",
        llmTokenRefOverride: step.overrides.llmTokenRefOverride ?? "",
        renderHtmlOverride: step.overrides.renderHtmlOverride ?? "",
        configOverride: step.overrides.configOverride ?? {},
        templatePrompt: step.agent?.systemPrompt ?? "",
        templateProvider: step.agent?.defaultProvider ?? "",
        templateHtml: step.renderTemplate?.html ?? "",
        agentName: step.agent?.name ?? null,
        agentKind: step.agent?.kind ?? null,
        renderTemplateName: step.renderTemplate?.name ?? null,
      })),
    [steps]
  );

  const [stepState, setStepState] = useState<StepState[]>(computedSteps);

  useEffect(() => {
    setStepState(computedSteps);
  }, [computedSteps]);

  const updateStep = (id: string, changes: Partial<StepState>) => {
    setStepState((prev) =>
      prev.map((step) => (step.tenantStepId === id ? { ...step, ...changes } : step))
    );
  };

  const [formState, formAction, isPending] = useActionState<ActionState, FormData>(
    saveTenantWorkflowConfigurationAction,
    initialActionState
  );

  const payloadJson = useMemo(() => {
    const stepsPayload = stepState.map((step) => ({
      tenantStepId: step.tenantStepId,
      templateStepId: step.templateStepId,
      type: step.type,
      order: step.order,
      sourceStepId: step.sourceStepId,
      overrides: {
        systemPromptOverride: trimToNull(step.systemPromptOverride),
        llmProviderOverride: trimToNull(step.llmProviderOverride),
        llmTokenRefOverride: trimToNull(step.llmTokenRefOverride),
        renderHtmlOverride: step.renderHtmlOverride.trim().length > 0 ? step.renderHtmlOverride : null,
        configOverride: step.configOverride,
      },
    }));

    return JSON.stringify({
      llmTokenRefDefault: trimToNull(defaultToken),
      status,
      steps: stepsPayload,
    });
  }, [defaultToken, status, stepState]);

  const promptSteps = useMemo(
    () => stepState.filter((step) => step.agentName || step.type === "translator"),
    [stepState]
  );
  const renderSteps = useMemo(
    () => stepState.filter((step) => step.type === "render"),
    [stepState]
  );
  const tokenSteps = promptSteps;

  const readyWithoutToken = status === "ready" && !trimToNull(defaultToken);

  const updatedAtLabel = useMemo(() => {
    const date = new Date(workflow.updatedAt);
    if (Number.isNaN(date.getTime())) {
      return "Data indisponivel";
    }
    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, [workflow.updatedAt]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="workflowId" value={workflow.id} readOnly />
      <input type="hidden" name="payload" value={payloadJson} readOnly />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{workflow.name}</CardTitle>
          <CardDescription>
            Baseado no template {template.name} (v{template.version}). Ultima atualizacao: {" "}
            {updatedAtLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "ready" ? "default" : "secondary"}>
              {status === "ready" ? "Pronto para uso" : "Rascunho"}
            </Badge>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span className="text-xs text-muted-foreground">
              Status aplicado ao salvar. Alteracoes sao locais ate clicar em salvar.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {formState.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formState.error}
        </div>
      )}
      {formState.success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {formState.success}
        </div>
      )}

      {activeTab === "prompts" && (
        <div className="space-y-4">
          {promptSteps.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Nenhum passo com agente LLM encontrado neste workflow.
              </CardContent>
            </Card>
          ) : (
            promptSteps.map((step) => {
              const overrideValue = step.systemPromptOverride;
              const hasOverride = overrideValue.trim().length > 0;
              const comparisonTarget = hasOverride ? overrideValue : step.templatePrompt;

              return (
                <Card key={step.tenantStepId}>
                  <CardHeader>
                    <StepHeader step={step} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Prompt do template
                      </p>
                      <div className="mt-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                        {step.templatePrompt ? (
                          <pre className="whitespace-pre-wrap font-mono text-[0.75rem] leading-relaxed text-foreground">
                            {step.templatePrompt}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Template sem prompt definido. Defina override para personalizar.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor={`prompt-${step.tenantStepId}`}
                        className="text-sm font-medium text-foreground"
                      >
                        Override do prompt
                      </label>
                      <Textarea
                        id={`prompt-${step.tenantStepId}`}
                        value={overrideValue}
                        onChange={(event) =>
                          updateStep(step.tenantStepId, {
                            systemPromptOverride: event.target.value,
                          })
                        }
                        placeholder="Use para ajustar instrucoes especificas do tenant"
                        className="min-h-[160px]"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Deixe em branco para herdar o prompt do template.
                          {" "}
                          {step.templateProvider && <span>Provider default: {step.templateProvider}.</span>}
                        </span>
                        {hasOverride && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStep(step.tenantStepId, { systemPromptOverride: "" })
                            }
                          >
                            Limpar override
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-foreground">Diff template x override</p>
                      <p className="text-xs text-muted-foreground">
                        Visualize as diferencas antes de salvar.
                      </p>
                      <div className="mt-2">
                        <DiffViewer base={step.templatePrompt} target={comparisonTarget} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === "render" && (
        <div className="space-y-4">
          {renderSteps.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Nenhum passo de renderizacao encontrado no workflow.
              </CardContent>
            </Card>
          ) : (
            renderSteps.map((step) => {
              const overrideValue = step.renderHtmlOverride;
              const hasOverride = overrideValue.trim().length > 0;
              const comparisonTarget = hasOverride ? overrideValue : step.templateHtml;

              return (
                <Card key={step.tenantStepId}>
                  <CardHeader>
                    <StepHeader step={step} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        HTML do template
                      </p>
                      <div className="mt-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                        {step.templateHtml ? (
                          <pre className="whitespace-pre-wrap font-mono text-[0.75rem] leading-relaxed text-foreground">
                            {step.templateHtml}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Template sem HTML definido. Informe override para personalizar.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor={`render-${step.tenantStepId}`}
                        className="text-sm font-medium text-foreground"
                      >
                        Override de HTML
                      </label>
                      <Textarea
                        id={`render-${step.tenantStepId}`}
                        value={overrideValue}
                        onChange={(event) =>
                          updateStep(step.tenantStepId, { renderHtmlOverride: event.target.value })
                        }
                        placeholder="<div>Use para customizar o template final</div>"
                        className="min-h-[200px] font-mono text-[0.8rem]"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Conteudo sera sanitizado ao salvar.</span>
                        {hasOverride && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStep(step.tenantStepId, { renderHtmlOverride: "" })
                            }
                          >
                            Limpar override
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-foreground">Diff template x override</p>
                      <div className="mt-2">
                        <DiffViewer base={step.templateHtml} target={comparisonTarget} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Token padrao do workflow</CardTitle>
              <CardDescription>
                Esse token e aplicado em todos os passos que nao possuirem override especifico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="workflow-token">
                  Referencia do token LLM
                </label>
                <input
                  id="workflow-token"
                  name="llmTokenRefDefault"
                  value={defaultToken}
                  onChange={(event) => setDefaultToken(event.target.value)}
                  placeholder="vault://tenant/default"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {formState.fieldErrors?.llmTokenRefDefault && (
                  <p className="text-xs text-destructive">
                    {formState.fieldErrors.llmTokenRefDefault}
                  </p>
                )}
                {readyWithoutToken && (
                  <p className="text-xs text-destructive">
                    Defina um token padrao antes de marcar o workflow como pronto.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="workflow-status">
                  Status do workflow
                </label>
                <select
                  id="workflow-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value === "ready" ? "ready" : "draft")
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="draft">Rascunho (nao permite jobs)</option>
                  <option value="ready">Pronto (permite criacao de jobs)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overrides por passo</CardTitle>
              <CardDescription>
                Configure provider/token especificos quando necessario. Em branco usa o token padrao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tokenSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum passo controlado por LLM encontrado para este workflow.
                </p>
              ) : (
                tokenSteps.map((step) => {
                  const hasProvider = step.llmProviderOverride.trim().length > 0;
                  const hasToken = step.llmTokenRefOverride.trim().length > 0;

                  return (
                    <div
                      key={`${step.tenantStepId}-token`}
                      className="rounded-md border border-border/70 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {step.agentName ?? formatStepType(step.type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Provider base: {step.templateProvider || "nao definido"}
                          </p>
                        </div>
                        {(hasProvider || hasToken) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStep(step.tenantStepId, {
                                llmProviderOverride: "",
                                llmTokenRefOverride: "",
                              })
                            }
                          >
                            Limpar overrides
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-foreground">
                            Provider LLM
                          </label>
                          <input
                            value={step.llmProviderOverride}
                            onChange={(event) =>
                              updateStep(step.tenantStepId, {
                                llmProviderOverride: event.target.value,
                              })
                            }
                            placeholder="Ex.: openai"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <p className="text-[0.7rem] text-muted-foreground">
                            Mantido vazio, permanece usando o provider global do agente.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-foreground">
                            Token override
                          </label>
                          <input
                            value={step.llmTokenRefOverride}
                            onChange={(event) =>
                              updateStep(step.tenantStepId, {
                                llmTokenRefOverride: event.target.value,
                              })
                            }
                            placeholder="vault://tenant/provider"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <p className="text-[0.7rem] text-muted-foreground">
                            Em branco: usa o token padrao configurado acima.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        {readyWithoutToken && (
          <span className="text-xs text-destructive">
            Workflow pronto requer token padrao. Ajuste antes de salvar.
          </span>
        )}
        <Button type="submit" disabled={isPending} className="min-w-[160px]">
          {isPending ? "Salvando..." : "Salvar alteracoes"}
        </Button>
      </div>
    </form>
  );
}
