import type { TenantRole } from "@/lib/db/types";
import type { TenantInviteStatus } from "@/lib/db/schema/tenants";

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
};

export type TenantMemberView = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: TenantRole;
  joinedAt: Date;
  updatedAt: Date;
};

export type TenantInviteView = {
  id: string;
  email: string;
  role: TenantRole;
  status: TenantInviteStatus;
  invitedBy: string | null;
  expiresAt: Date | null;
  updatedAt: Date;
};
