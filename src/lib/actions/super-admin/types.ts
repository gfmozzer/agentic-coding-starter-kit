import type { TenantRole } from "@/lib/db/types";

export interface AssignTenantRoleInput {
  tenantId: string;
  userEmail: string;
  role: TenantRole;
}

export interface UpsertTenantInput {
  id?: string;
  name: string;
  slug?: string;
  settings?: string;
}

export interface RemoveTenantMemberInput {
  tenantId: string;
  memberId: string;
}

export interface UpdateTenantMemberRoleInput {
  tenantId: string;
  memberId: string;
  role: TenantRole;
}

export interface CancelTenantInviteInput {
  tenantId: string;
  inviteId: string;
}
