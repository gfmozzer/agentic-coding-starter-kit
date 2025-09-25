"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import {
  createRenderTemplateAction,
  updateRenderTemplateAction,
  deleteRenderTemplateAction,
} from "@/lib/actions/super-admin/templates";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";

interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  html: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplatesClientProps {
  templates: TemplateDto[];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function TemplatesClient({ templates }: TemplatesClientProps) {
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDto | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const [formState, formAction] = useActionState(
    editingTemplate ? updateRenderTemplateAction : createRenderTemplateAction,
    initialActionState
  );
  const [deleteState, deleteAction] = useActionState(
    deleteRenderTemplateAction,
    initialActionState
  );

  useEffect(() => {
    if (formState.success) {
      setDialogOpen(false);
      setEditingTemplate(null);
      router.refresh();
    }
  }, [formState.success, router]);

  useEffect(() => {
    if (deleteState.success) {
      router.refresh();
    }
  }, [deleteState.success, router]);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [templates]);

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const openEditDialog = (template: TemplateDto) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const openPreview = (html: string) => {
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  const handleDelete = (templateId: string) => {
    const confirmed = window.confirm("Excluir este template? Esta acao nao pode ser desfeita.");
    if (!confirmed) {
      return;
    }

    const data = new FormData();
    data.append("templateId", templateId);
    deleteAction(data);
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const globalError = formState.error ?? deleteState.error;
  const globalSuccess = formState.success || deleteState.success;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates de render</h1>
            <p className="text-sm text-muted-foreground">
              Gere HTML sanitizado que sera usado na etapa de renderizacao dos workflows.
            </p>
          </div>
          <Button onClick={openCreateDialog}>Novo template</Button>
        </div>
        {globalError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {globalError}
          </div>
        )}
        {globalSuccess && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {globalSuccess}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates cadastrados</h2>
          <Badge variant="secondary">
            {sortedTemplates.length === 1
              ? "1 template"
              : `${sortedTemplates.length} templates`}
          </Badge>
        </header>

        {sortedTemplates.length === 0 ? (
          <div className="rounded-md border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhum template cadastrado. Clique em &quot;Novo template&quot; para criar o primeiro.
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
                    Atualizado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Criado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <span className="font-medium text-foreground">{template.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {template.description ?? "Sem descricao"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(template.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(template.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(template.html)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(template)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(template.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>
              Defina o nome, descricao e HTML sanitizado do template. Use placeholders <code>{'{{chave}}'}</code> para conteudo dinamico.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={editingTemplate?.id ?? ""} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="template-name">
                  Nome
                </label>
                <input
                  id="template-name"
                  name="name"
                  defaultValue={editingTemplate?.name ?? ""}
                  placeholder="Template de certidao"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
                {formState.fieldErrors?.name && (
                  <p className="text-xs text-destructive">{formState.fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="template-description">
                  Descricao
                </label>
                <input
                  id="template-description"
                  name="description"
                  defaultValue={editingTemplate?.description ?? ""}
                  placeholder="Resumo do template"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {formState.fieldErrors?.description && (
                  <p className="text-xs text-destructive">{formState.fieldErrors.description}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="template-html">
                HTML Template
              </label>
              <Textarea
                id="template-html"
                name="html"
                defaultValue={editingTemplate?.html ?? ""}
                placeholder="<div>Seu HTML aqui com {{placeholders}}</div>"
                className="h-64 w-full font-mono text-sm"
                required
              />
              {formState.fieldErrors?.html && (
                <p className="text-xs text-destructive">{formState.fieldErrors.html}</p>
              )}
            </div>
            <DialogFooter className="flex items-center justify-between">
              {formState.success && (
                <span className="text-sm text-emerald-600">{formState.success}</span>
              )}
              <SubmitButton label={editingTemplate ? "Salvar alteracoes" : "Criar template"} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview do template</DialogTitle>
            <DialogDescription>
              Conteudo renderizado em iframe isolado.
            </DialogDescription>
          </DialogHeader>
          <div className="h-96 overflow-hidden rounded-lg border">
            <iframe
              className="h-full w-full"
              sandbox=""
              srcDoc={previewHtml}
              title="Preview do template"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
