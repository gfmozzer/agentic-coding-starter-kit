"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { deleteAgentAction, testAgentSchemaAction, upsertAgentAction } from "@/lib/actions/super-admin/agents";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";
import type { AgentDefinition, AgentKind } from "@/lib/ai/types";

interface AgentsClientProps {
  agents: AgentDefinition[];
}

interface AgentDraft {
  id?: string;
  name: string;
  kind: AgentKind;
  systemPrompt: string;
  inputExample: string;
  outputSchemaJson: string;
  defaultProvider: string;
  defaultModel: string;
}

const agentKinds: { label: string; value: AgentKind }[] = [
  { label: "OCR", value: "ocr" },
  { label: "Structured", value: "structured" },
  { label: "Translator", value: "translator" },
  { label: "Render", value: "render" },
];


const emptyDraft: AgentDraft = {
  name: "",
  kind: "structured",
  systemPrompt: "",
  inputExample: "",
  outputSchemaJson: "{}",
  defaultProvider: "openai",
  defaultModel: "gpt-4.1-mini",
};

export function AgentsClient({ agents }: AgentsClientProps) {
  const [selectedKind, setSelectedKind] = useState<AgentKind | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [formState, formAction] = useFormState(upsertAgentAction, initialActionState);
  const [testState, testAction] = useFormState(testAgentSchemaAction, initialActionState);
  const [schemaTestMessage, setSchemaTestMessage] = useState<string | null>(null);
  const [schemaTestError, setSchemaTestError] = useState<string | null>(null);
  const filteredAgents = useMemo(() => {
    if (selectedKind === "all") {
      return agents;
    }
    return agents.filter((agent) => agent.kind === selectedKind);
  }, [agents, selectedKind]);

  useEffect(() => {
    if (formState.success) {
      setDialogOpen(false);
      setEditingId(undefined);
      setDraft(emptyDraft);
    }
  }, [formState.success]);

  useEffect(() => {
    if (!dialogOpen) {
      setSchemaTestMessage(null);
      setSchemaTestError(null);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (testState.success) {
      setSchemaTestMessage(testState.success);
      setSchemaTestError(null);
    } else if (testState.error) {
      setSchemaTestError(testState.error);
      setSchemaTestMessage(null);
    }
  }, [testState.success, testState.error]);

  const requiresSchema = draft.kind === "structured";
  const canTestSchema = requiresSchema || draft.outputSchemaJson.trim().length > 0;

  const currentKindLabel = agentKinds.find((item) => item.value === draft.kind)?.label ?? draft.kind;

  const openCreateDialog = () => {
    setDraft(emptyDraft);
    setEditingId(undefined);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const openEditDialog = (agent: AgentDefinition) => {
    setDialogKey((key) => key + 1);
    setDraft({
      id: agent.id,
      name: agent.name,
      kind: agent.kind,
      systemPrompt: agent.systemPrompt,
      inputExample: agent.inputExample ?? "",
      outputSchemaJson: JSON.stringify(agent.outputSchema, null, 2),
      defaultProvider: agent.defaultProvider,
      defaultModel: agent.defaultModel,
    });
    setEditingId(agent.id);
    setDialogOpen(true);
  };

  const handleDraftChange = (field: keyof AgentDraft, value: string) => {
    if (field === "kind") {
      const nextKind = value as AgentKind;
      setDraft((prev) => ({
        ...prev,
        kind: nextKind,
        outputSchemaJson:
          nextKind === "structured"
            ? prev.outputSchemaJson && prev.outputSchemaJson.trim().length > 0
              ? prev.outputSchemaJson
              : "{}"
            : "",
      }));
      setSchemaTestMessage(null);
      setSchemaTestError(null);
      return;
    }

    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedKind === "all" ? "default" : "outline"}
            onClick={() => setSelectedKind("all")}
          >
            Todos
          </Button>
          {agentKinds.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={selectedKind === item.value ? "default" : "outline"}
              onClick={() => setSelectedKind(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          Novo agente
        </Button>
      </div>

      {formState.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formState.error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nome
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Provider / Modelo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Atualizado em
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredAgents.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  Nenhum agente cadastrado para este filtro.
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => {
                const updatedAt = agent.updatedAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const kindLabel = agentKinds.find((item) => item.value === agent.kind)?.label ?? agent.kind;

                return (
                  <tr key={agent.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {agent.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{kindLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{agent.defaultProvider}</span>
                        <span className="text-xs text-muted-foreground">{agent.defaultModel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{updatedAt}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(agent)}>
                          Editar
                        </Button>
                        <form action={deleteAgentAction}>
                          <input type="hidden" name="agentId" value={agent.id} />
                          <Button size="sm" variant="destructive">
                            Remover
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent key={dialogKey} className="sm:max-w-2xl">
          <form
            id="test-schema-form"
            action={testAction}
            className="hidden"
            onSubmit={() => {
              setSchemaTestMessage(null);
              setSchemaTestError(null);
            }}
          >
            <input type="hidden" name="systemPrompt" value={draft.systemPrompt} />
            <input type="hidden" name="kind" value={draft.kind} />
            <input type="hidden" name="inputExample" value={draft.inputExample} />
            <input type="hidden" name="outputSchemaJson" value={draft.outputSchemaJson} />
            <input type="hidden" name="defaultProvider" value={draft.defaultProvider} />
            <input type="hidden" name="defaultModel" value={draft.defaultModel} />
          </form>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar agente" : "Novo agente"}</DialogTitle>
            <DialogDescription>
              Defina prompts, provider padrão e schema de saída. Esses agentes serão clonados pelos tenants.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={editingId ?? ""} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="agent-name">
                  Nome
                </label>
                <input
                  id="agent-name"
                  name="name"
                  value={draft.name}
                  onChange={(event) => handleDraftChange("name", event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
                {formState.fieldErrors?.name && (
                  <p className="text-xs text-destructive">{formState.fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="agent-kind">
                  Tipo
                </label>
                <select
                  id="agent-kind"
                  name="kind"
                  value={draft.kind}
                  onChange={(event) => handleDraftChange("kind", event.target.value as AgentKind)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {agentKinds.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="agent-provider">
                Provider padrão
              </label>
              <input
                id="agent-provider"
                name="defaultProvider"
                value={draft.defaultProvider}
                onChange={(event) => handleDraftChange("defaultProvider", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              {(() => {
                const message =
                  formState.fieldErrors?.defaultProvider ??
                  testState.fieldErrors?.defaultProvider;
                return message ? (
                  <p className="text-xs text-destructive">{message}</p>
                ) : null;
              })()}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="agent-model">
                Modelo padrão
              </label>
              <input
                id="agent-model"
                name="defaultModel"
                value={draft.defaultModel}
                onChange={(event) => handleDraftChange("defaultModel", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              {(() => {
                const message =
                  formState.fieldErrors?.defaultModel ??
                  testState.fieldErrors?.defaultModel;
                return message ? (
                  <p className="text-xs text-destructive">{message}</p>
                ) : null;
              })()}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="agent-system">
                Prompt / instruções do agente
              </label>
              <textarea
                id="agent-system"
                name="systemPrompt"
                value={draft.systemPrompt}
                onChange={(event) => handleDraftChange("systemPrompt", event.target.value)}
                className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Defina o papel do agente, entradas esperadas e formato de saída."
                required
              />
              {(() => {
                const message =
                  formState.fieldErrors?.systemPrompt ??
                  testState.fieldErrors?.systemPrompt;
                return message ? (
                  <p className="text-xs text-destructive">{message}</p>
                ) : null;
              })()}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="agent-example">
                Exemplo de entrada (opcional)
              </label>
              <textarea
                id="agent-example"
                name="inputExample"
                value={draft.inputExample}
                onChange={(event) => handleDraftChange("inputExample", event.target.value)}
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Cole um exemplo de payload ou prompt enviado para o agente."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground" htmlFor="agent-schema">
                    Schema de sa?da (JSON)
                  </label>
                  {!requiresSchema && (
                    <span className="text-xs text-muted-foreground">
                      Opcional para agentes {currentKindLabel}.
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="submit"
                  form="test-schema-form"
                  disabled={!canTestSchema}
                  title={!canTestSchema ? "Schema opcional para este tipo de agente." : undefined}
                >
                  Testar schema
                </Button>
              </div>
              <textarea
                id="agent-schema"
                name="outputSchemaJson"
                value={draft.outputSchemaJson}
                onChange={(event) => handleDraftChange("outputSchemaJson", event.target.value)}
                className="h-40 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder='{"type":"object","properties":{...}}'
                required={requiresSchema}
              />
              {(() => {
                const message =
                  formState.fieldErrors?.outputSchemaJson ??
                  testState.fieldErrors?.outputSchemaJson ??
                  schemaTestError;
                return message ? (
                  <p className="text-xs text-destructive">{message}</p>
                ) : null;
              })()}
              {schemaTestMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-emerald-700">{schemaTestMessage}</pre>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between">
              {formState.success && (
                <span className="text-sm text-emerald-600">{formState.success}</span>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm">
                  {editingId ? "Salvar alterações" : "Criar agente"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}








