"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cloneWorkflowForTenantAction } from "@/lib/actions/operator/workflows";
import type { ActionState } from "@/lib/actions/super-admin/agent-action-state";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface OperatorWorkflowItem {
  id: string;
  name: string;
  status: "draft" | "ready";
  templateId: string;
  templateName: string;
  templateVersion: string;
  updatedAt: string;
  llmTokenRefDefault: string | null;
}

interface PublishedTemplateItem {
  templateId: string;
  name: string;
  description: string | null;
  version: string;
  isDefault: boolean;
  publishedAt: string;
}

interface OperatorWorkflowsClientProps {
  workflows: OperatorWorkflowItem[];
  templates: PublishedTemplateItem[];
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeVariant(status: "draft" | "ready") {
  return status === "ready" ? "default" : "secondary";
}

export function OperatorWorkflowsClient({ workflows, templates }: OperatorWorkflowsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.templateId ?? "");
  const [customName, setCustomName] = useState("");

  const [formState, formAction, isPending] = useActionState<ActionState, FormData>(
    cloneWorkflowForTenantAction,
    initialActionState
  );

  useEffect(() => {
    if (formState?.success) {
      setDialogOpen(false);
      setCustomName("");
      router.refresh();
    }
  }, [formState?.success, router]);

  useEffect(() => {
    if (!dialogOpen) {
      setCustomName("");
      setSelectedTemplateId(templates[0]?.templateId ?? "");
    }
  }, [dialogOpen, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateId === selectedTemplateId),
    [selectedTemplateId, templates]
  );

  const workflowsSorted = useMemo(
    () =>
      [...workflows].sort((a, b) => {
        if (a.status === b.status) {
          return a.name.localeCompare(b.name);
        }
        return a.status === "ready" ? -1 : 1;
      }),
    [workflows]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows do tenant</h1>
          <p className="text-sm text-muted-foreground">
            Clones de workflows globais com overrides de prompt, HTML e tokens.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={templates.length === 0}>
          Clonar workflow
        </Button>
      </div>

      {formState?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formState.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clones configurados</CardTitle>
          <CardDescription>
            Cada clone pode ajustar prompts, HTML e tokens antes de iniciar jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflowsSorted.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Nenhum workflow clonado ainda. Selecione um template publicado para começar.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Workflow
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Template base
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Token padrão
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
                  {workflowsSorted.map((workflow) => {
                    const tokenConfigured = Boolean(workflow.llmTokenRefDefault);
                    return (
                      <tr key={workflow.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {workflow.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{workflow.templateName}</span>
                            <span className="text-xs">v{workflow.templateVersion}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={statusBadgeVariant(workflow.status)}>
                            {workflow.status === "ready" ? "Pronto" : "Rascunho"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={tokenConfigured ? "default" : "outline"}>
                            {tokenConfigured ? "Configurado" : "Pendente"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(workflow.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/operator/workflows/${workflow.id}/settings`}>
                              Abrir configurações
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates publicados</CardTitle>
          <CardDescription>
            Lista de workflows globais disponíveis para clonagem neste tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Nenhum workflow publicado pelo super-admin no momento.
            </div>
          ) : (
            <div className="grid gap-3">
              {templates.map((template) => (
                <div
                  key={template.templateId}
                  className="flex flex-col justify-between gap-2 rounded-lg border px-4 py-3 text-sm md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-medium text-foreground">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
                    <Badge variant={template.isDefault ? "default" : "outline"}>
                      {template.isDefault ? "Padrão" : "Opcional"}
                    </Badge>
                    <span>Versão v{template.version}</span>
                    <span>Publicado {formatDate(template.publishedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Clonar workflow</DialogTitle>
            <DialogDescription>
              Escolha um template publicado para criar uma cópia com overrides por tenant.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="clone-template">
                Template
              </label>
              <select
                id="clone-template"
                name="templateId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione um template
                </option>
                {templates.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.name} (v{template.version})
                  </option>
                ))}
              </select>
              {formState?.fieldErrors?.templateId && (
                <p className="text-xs text-destructive">{formState.fieldErrors.templateId}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="clone-name">
                Nome do workflow
              </label>
              <input
                id="clone-name"
                name="name"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder={selectedTemplate?.name ?? "Workflow clonado"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {selectedTemplate && (
              <div className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Versão v{selectedTemplate.version}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Publicado {formatDate(selectedTemplate.publishedAt)}</span>
                  {selectedTemplate.isDefault && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <span>Template padrão do tenant</span>
                    </>
                  )}
                </div>
                {selectedTemplate.description && (
                  <p className="mt-2">{selectedTemplate.description}</p>
                )}
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              {formState?.success && (
                <span className="text-sm text-emerald-600">{formState.success}</span>
              )}
              <Button type="submit" disabled={isPending || !selectedTemplateId}>
                {isPending ? "Clonando..." : "Confirmar clonagem"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
