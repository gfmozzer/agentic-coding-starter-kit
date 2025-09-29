"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  assignTenantRoleAction,
  cancelTenantInviteAction,
  removeTenantMemberAction,
  updateTenantMemberRoleAction,
} from "@/lib/actions/super-admin/tenants";
import { initialActionState } from "@/lib/actions/super-admin/agent-action-state";

import type { TenantInviteStatus } from "@/lib/db/schema/tenants";
import type {
  TenantInviteView,
  TenantMemberView,
  TenantSummary,
} from "./users-page-types";

const updateMemberRoleActionBound = updateTenantMemberRoleAction.bind(
  null,
  initialActionState
) as unknown as (formData: FormData) => Promise<void>;
const removeMemberActionBound = removeTenantMemberAction.bind(
  null,
  initialActionState
) as unknown as (formData: FormData) => Promise<void>;
const cancelInviteActionBound = cancelTenantInviteAction.bind(
  null,
  initialActionState
) as unknown as (formData: FormData) => Promise<void>;

const roleLabels: Record<string, string> = {
  "super-admin": "Super Admin",
  "tenant-admin": "Tenant Admin",
  operator: "Operador",
};

function FormSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Enviando..." : label}
    </Button>
  );
}

interface TenantUsersClientProps {
  tenant: TenantSummary;
  members: TenantMemberView[];
  invites: TenantInviteView[];
}

export function TenantUsersClient({ tenant, members, invites }: TenantUsersClientProps) {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="text-sm text-muted-foreground">
          Slug: <span className="font-mono text-foreground">{tenant.slug}</span>
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Adicionar usuário</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Convites são enviados por e-mail quando a automação estiver configurada. Por enquanto, o super-admin pode registrar usuários existentes e manter convites pendentes para novos contatos.
        </p>
        <div className="mt-4">
          <AddMemberForm tenantId={tenant.id} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Membros ativos</h2>
          <Badge variant="secondary">{members.length} ativos</Badge>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Papel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Desde
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={4}>
                    Ainda não há membros ativos neste tenant.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <MemberRow key={member.id} member={member} tenantId={tenant.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Convites</h2>
          <Badge variant="outline">{invites.length} registros</Badge>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Papel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Expira em
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invites.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                    Nenhum convite registrado.
                  </td>
                </tr>
              ) : (
                invites.map((invite) => (
                  <InviteRow key={invite.id} invite={invite} tenantId={tenant.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AddMemberForm({ tenantId }: { tenantId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [formState, formAction] = useActionState(assignTenantRoleAction, initialActionState);

  useEffect(() => {
    if (formState.success) {
      setEmail("");
      setRole("operator");
    }
  }, [formState.success]);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border px-4 py-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="invite-email">
            E-mail do usuário
          </label>
          <input
            id="invite-email"
            name="userEmail"
            placeholder="usuario@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
            type="email"
          />
          {formState.fieldErrors?.userEmail && (
            <p className="text-xs text-destructive">{formState.fieldErrors.userEmail}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="invite-role">
            Papel
          </label>
          <select
            id="invite-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="operator">Operador</option>
            <option value="tenant-admin">Tenant Admin</option>
            <option value="super-admin">Super Admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <FormSubmitButton label="Registrar" />
        </div>
      </div>
      {formState.error && (
        <p className="text-sm text-destructive">{formState.error}</p>
      )}
      {formState.success && (
        <p className="text-sm text-emerald-600">{formState.success}</p>
      )}
    </form>
  );
}

function MemberRow({ member, tenantId }: { member: TenantMemberView; tenantId: string }) {
  const formattedDate = new Date(member.joinedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-3 text-sm">
        <div className="font-medium text-foreground">{member.name ?? "Usuário sem nome"}</div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{roleLabels[member.role] ?? member.role}</span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{formattedDate}</td>
      <td className="px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-2">
          <form action={updateMemberRoleActionBound} className="flex items-center gap-2">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="memberId" value={member.id} />
            <select
              name="role"
              defaultValue={member.role}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="operator">Operador</option>
              <option value="tenant-admin">Tenant Admin</option>
              <option value="super-admin">Super Admin</option>
            </select>
            <FormSubmitButton label="Atualizar" />
          </form>
          <form action={removeMemberActionBound}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="memberId" value={member.id} />
            <Button type="submit" size="sm" variant="destructive">
              Remover
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function InviteRow({ invite, tenantId }: { invite: TenantInviteView; tenantId: string }) {
  const statusVariant: Record<TenantInviteStatus, "default" | "secondary" | "outline" | "destructive"> = {
    pending: "default",
    accepted: "secondary",
    expired: "outline",
    cancelled: "destructive",
  };

  const expires = invite.expiresAt
    ? new Date(invite.expiresAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const canCancel = invite.status === "pending";

  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-3 text-sm text-foreground">{invite.email}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{roleLabels[invite.role] ?? invite.role}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <Badge variant={statusVariant[invite.status]}>{invite.status}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{expires}</td>
      <td className="px-4 py-3 text-right text-sm">
        <form action={cancelInviteActionBound}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="inviteId" value={invite.id} />
          <Button type="submit" size="sm" variant="outline" disabled={!canCancel}>
            Cancelar
          </Button>
        </form>
      </td>
    </tr>
  );
}
