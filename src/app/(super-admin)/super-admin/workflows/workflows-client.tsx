"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createWorkflowTemplateAction } from "@/lib/actions/super-admin/workflows";
import type { ActionState } from "@/lib/actions/super-admin/agent-action-state";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";

interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  version: string;
  updatedAt: string;
  stepCount: number;
}

interface WorkflowsClientProps {
  templates: WorkflowTemplateSummary[];
}

export function WorkflowsClient({ templates }: WorkflowsClientProps) {
  const router = useRouter();
  const [formState, formAction] = useActionState<ActionState, FormData>(
    createWorkflowTemplateAction,
    initialActionState
  );

  useEffect(() => {
    const redirectTo = formState?.fieldErrors?.redirectTo;
    if (redirectTo && typeof redirectTo === "string") {
      router.push(redirectTo);
    }
  }, [formState?.fieldErrors, router]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Workflow templates globais</h1>
        <p className="text-sm text-muted-foreground">
          Crie, edite e disponibilize workflows padrão para os tenants.
        </p>
      </section>

      {formState?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formState.error}
        </div>
      )}

      <form
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-end"
        action={formAction}
      >
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="workflow-template-name">
            Nome do novo template
          </label>
          <input
            id="workflow-template-name"
            name="name"
            placeholder="Ex.: Workflow certidão padrão"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="workflow-template-description">
            Descrição (opcional)
          </label>
          <input
            id="workflow-template-description"
            name="description"
            placeholder="Breve contexto sobre o template"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button type="submit" className="md:self-auto">
          Criar template
        </Button>
      </form>

      <Separator />

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates existentes</h2>
          <span className="text-sm text-muted-foreground">
            {templates.length === 1
              ? "1 template"
              : `${templates.length} templates`}
          </span>
        </header>

        {templates.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Nenhum template cadastrado. Crie um novo para começar.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Versão
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Passos
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((template) => {
                  const updatedAt = new Date(template.updatedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={template.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{template.version}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{updatedAt}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{template.stepCount}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                        >
                          <a href={`/super-admin/workflows/${template.id}/builder`}>
                            Abrir builder
                          </a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}