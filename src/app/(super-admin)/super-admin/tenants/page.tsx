import { asc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  tenantInvites,
  tenantMembers,
  tenants,
} from "@/lib/db/schema/tenants";

import { TenantsClient } from "./tenants-client";

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
  memberCount: number;
  pendingInvites: number;
  createdAt: Date;
  updatedAt: Date;
};

async function fetchTenantSummaries(): Promise<TenantSummary[]> {
  const records = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      settings: tenants.settings,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .orderBy(asc(tenants.name));

  const summaries = await Promise.all(
    records.map(async (tenant) => {
      const stats = await withTenantContext(tenant.id, async (tx) => {
        const [{ value: membersCount }] = await tx
          .select({ value: sql<number>`count(*)` })
          .from(tenantMembers);

        const [{ value: pendingInvites }] = await tx
          .select({ value: sql<number>`count(*)` })
          .from(tenantInvites)
          .where(eq(tenantInvites.status, "pending" as const));

        return {
          members: Number(membersCount ?? 0),
          invites: Number(pendingInvites ?? 0),
        };
      });

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings as Record<string, unknown> | null,
        memberCount: stats.members,
        pendingInvites: stats.invites,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      } satisfies TenantSummary;
    })
  );

  return summaries;
}

export default async function TenantsPage() {
  const tenantSummaries = await fetchTenantSummaries();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants e usuários</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre clientes, acompanhe membros vinculados e convites pendentes.
          </p>
        </div>
        <Link
          href="/super-admin/agents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Precisa configurar agentes globais? Clique aqui →
        </Link>
      </div>
      <TenantsClient tenants={tenantSummaries} />
    </div>
  );
}

