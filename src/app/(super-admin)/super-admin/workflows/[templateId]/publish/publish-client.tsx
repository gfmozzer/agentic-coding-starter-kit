"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  publishWorkflowToTenantAction,
} from "@/lib/actions/super-admin/workflows";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  isPublished: boolean;
  isDefault: boolean;
  publishedAt: string | null;
}

interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
}

interface PublishWorkflowClientProps {
  templateId: string;
  workflow: WorkflowSummary;
  tenants: TenantSummary[];
}

export function PublishWorkflowClient({ templateId, workflow, tenants }: PublishWorkflowClientProps) {
  const router = useRouter();
  const [formState, formAction] = useActionState(publishWorkflowToTenantAction, initialActionState);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (formState.success || formState.error) {
      setPendingTenantId(null);
    }
    if (formState.success) {
      router.refresh();
    }
  }, [formState.error, formState.success, router]);

  const publishedCount = useMemo(() => tenants.filter((t) => t.isPublished).length, [tenants]);
  const totalCount = tenants.length;

  const handleTogglePublish = (tenant: TenantSummary, publish: boolean) => {
    setPendingTenantId(tenant.id);
    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("tenantId", tenant.id);
    formData.append("action", publish ? "publish" : "unpublish");
    formData.append("isDefault", String(publish && tenant.isDefault));
    formAction(formData);
  };

  const handleSetDefault = (tenant: TenantSummary) => {
    setPendingTenantId(tenant.id);
    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("tenantId", tenant.id);
    formData.append("action", "set-default");
    formData.append("isDefault", "true");
    formAction(formData);
  };

  const formatPublishedAt = (value: string | null) => {
    if (!value) {
      return "--";
    }
    const date = new Date(value);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const successMessage = formState.success;
  const errorMessage = formState.error;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Publicar workflow</CardTitle>
              <CardDescription>
                Controle quais tenants podem iniciar jobs com este workflow template.
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {publishedCount} de {totalCount} tenants com acesso
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">Nome</label>
              <p className="text-sm text-foreground">{workflow.name}</p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">Template ID</label>
              <p className="text-sm font-mono text-muted-foreground">{workflow.id}</p>
            </div>
            {workflow.description && (
              <div className="md:col-span-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Descricao</label>
                <p className="text-sm text-muted-foreground">{workflow.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {errorMessage && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
      </header>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tenants disponiveis</h2>
          <Badge variant={publishedCount > 0 ? "default" : "outline"}>
            {publishedCount} ativo{publishedCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Membros
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Publicado em
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((tenant) => {
                const publishedDate = formatPublishedAt(tenant.publishedAt);
                const switchDisabled = pendingTenantId === tenant.id;

                return (
                  <tr key={tenant.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{tenant.name}</span>
                          {tenant.isDefault && tenant.isPublished && (
                            <Badge variant="secondary" className="text-xs">
                              Padrao
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <Badge variant="outline">{tenant.memberCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={tenant.isPublished ? "default" : "outline"}>
                        {tenant.isPublished ? "Publicado" : "Nao publicado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{publishedDate}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Publicado</label>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                            checked={tenant.isPublished}
                            onChange={(event) => handleTogglePublish(tenant, event.target.checked)}
                            disabled={switchDisabled}
                          />
                        </div>
                        {tenant.isPublished && !tenant.isDefault && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingTenantId === tenant.id}
                            onClick={() => handleSetDefault(tenant)}
                          >
                            Definir como padrao
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
