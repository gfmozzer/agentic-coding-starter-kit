import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant-context";
import { user as userTable } from "@/lib/db/schema/auth";
import type { TenantRole } from "@/lib/db/types";
import {
  tenantInvites,
  tenantMembers,
  tenants,
} from "@/lib/db/schema/tenants";

import { TenantUsersClient } from "./users-client";
import type {
  TenantInviteView,
  TenantMemberView,
  TenantSummary,
} from "./users-page-types";

type TenantUsersPageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function TenantUsersPage({ params }: TenantUsersPageProps) {
  const { tenantId } = await params;

  const tenantRecord = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!tenantRecord) {
    notFound();
  }

  const { members, invites } = await withTenantContext(tenantId, async (tx) => {
    const memberRows = await tx
      .select({
        id: tenantMembers.id,
        userId: tenantMembers.userId,
        name: userTable.name,
        email: userTable.email,
        role: tenantMembers.role,
        joinedAt: tenantMembers.createdAt,
        updatedAt: tenantMembers.updatedAt,
      })
      .from(tenantMembers)
      .innerJoin(userTable, eq(userTable.id, tenantMembers.userId))
      .orderBy(asc(userTable.email));

    const inviteRows = await tx
      .select({
        id: tenantInvites.id,
        email: tenantInvites.email,
        role: tenantInvites.role,
        status: tenantInvites.status,
        invitedBy: tenantInvites.invitedBy,
        expiresAt: tenantInvites.expiresAt,
        updatedAt: tenantInvites.updatedAt,
      })
      .from(tenantInvites)
      .orderBy(desc(tenantInvites.createdAt));

    return {
      members: memberRows,
      invites: inviteRows,
    };
  });

  const tenant: TenantSummary = {
    id: tenantRecord.id,
    name: tenantRecord.name,
    slug: tenantRecord.slug,
  };

  const membersView: TenantMemberView[] = members.map((member) => ({
    id: member.id,
    userId: member.userId,
    name: member.name,
    email: member.email ?? "",
    role: member.role as TenantRole,
    joinedAt: member.joinedAt,
    updatedAt: member.updatedAt,
  }));

  const invitesView: TenantInviteView[] = invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role as TenantRole,
    status: invite.status,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
    updatedAt: invite.updatedAt,
  }));

  return (
    <TenantUsersClient
      tenant={tenant}
      members={membersView}
      invites={invitesView}
    />
  );
}
