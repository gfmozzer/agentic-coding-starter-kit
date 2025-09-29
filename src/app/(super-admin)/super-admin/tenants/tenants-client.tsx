"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

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

import { upsertTenantAction } from "@/lib/actions/super-admin/tenants";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";

import type { TenantSummary } from "./page";

interface TenantsClientProps {
  tenants: TenantSummary[];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function TenantsClient({ tenants }: TenantsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null);
  const [formState, formAction] = useActionState(upsertTenantAction, initialActionState);

  useEffect(() => {
    if (formState.success) {
      setDialogOpen(false);
      setEditingTenant(null);
    }
  }, [formState.success]);

  const sortedTenants = useMemo(() => {
    return [...tenants].sort((a, b) => a.name.localeCompare(b.name));
  }, [tenants]);

  const openCreateDialog = () => {
    setEditingTenant(null);
    setDialogOpen(true);
  };

  const openEditDialog = (tenant: TenantSummary) => {
    setEditingTenant(tenant);
    setDialogOpen(true);
  };

  const editingSettings = editingTenant?.settings ? JSON.stringify(editingTenant.settings, null, 2) : "";
  const slugPlaceholder = "ex: empresa-azul";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tenants cadastrados</h2>
        <Button size="sm" onClick={openCreateDialog}>
          Novo tenant
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
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membros
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Convites
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
            {sortedTenants.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                  Nenhum tenant cadastrado ainda. Crie o primeiro usando o botão acima.
                </td>
              </tr>
            ) : (
              sortedTenants.map((tenant) => {
                const updatedAt = new Date(tenant.updatedAt);
                const formattedDate = updatedAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <tr key={tenant.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {tenant.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {tenant.slug}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{tenant.memberCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <Badge variant={tenant.pendingInvites > 0 ? "default" : "outline"}>
                        {tenant.pendingInvites}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formattedDate}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(tenant)}
                        >
                          Editar
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/super-admin/tenants/${tenant.id}/users`}>
                            Gerenciar usuários
                          </Link>
                        </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTenant ? "Editar tenant" : "Novo tenant"}</DialogTitle>
            <DialogDescription>
              Defina nome e slug. Opcionalmente informe configurações JSON compartilhadas com o n8n.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={editingTenant?.id ?? ""} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="tenant-name">
                Nome
              </label>
              <input
                id="tenant-name"
                name="name"
                defaultValue={editingTenant?.name ?? ""}
                placeholder="Empresa Demonstrativa"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              {formState.fieldErrors?.name && (
                <p className="text-xs text-destructive">{formState.fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="tenant-slug">
                Slug
              </label>
              <input
                id="tenant-slug"
                name="slug"
                defaultValue={editingTenant?.slug ?? ""}
                placeholder={slugPlaceholder}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {formState.fieldErrors?.slug && (
                <p className="text-xs text-destructive">{formState.fieldErrors.slug}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="tenant-settings">
                Settings JSON (opcional)
              </label>
              <textarea
                id="tenant-settings"
                name="settings"
                defaultValue={editingSettings}
                placeholder='{"n8nWebhook":"https://..."}'
                className="h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {formState.fieldErrors?.settings && (
                <p className="text-xs text-destructive">{formState.fieldErrors.settings}</p>
              )}
            </div>
            <DialogFooter className="flex items-center justify-between">
              {formState.success && (
                <span className="text-sm text-emerald-600">{formState.success}</span>
              )}
              <SubmitButton label={editingTenant ? "Salvar alterações" : "Criar tenant"} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
