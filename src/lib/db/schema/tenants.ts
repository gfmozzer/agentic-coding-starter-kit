import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("tenants_slug_idx").on(table.slug),
  })
);

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantUserIdx: uniqueIndex("tenant_members_tenant_user_idx").on(
      table.tenantId,
      table.userId
    ),
    roleCheck: check(
      "tenant_members_role_check",
      sql`${table.role} in ('tenant-admin', 'operator', 'super-admin')`
    ),
  })
);

export type TenantInviteStatus = "pending" | "accepted" | "expired" | "cancelled";

export const tenantInvites = pgTable(
  "tenant_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status")
      .$type<TenantInviteStatus>()
      .default("pending")
      .notNull(),
    token: text("token").notNull(),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantEmailIdx: uniqueIndex("tenant_invites_tenant_email_idx").on(
      table.tenantId,
      table.email
    ),
    roleCheck: check(
      "tenant_invites_role_check",
      sql`${table.role} in ('tenant-admin', 'operator', 'super-admin')`
    ),
    statusCheck: check(
      "tenant_invites_status_check",
      sql`${table.status} in ('pending', 'accepted', 'expired', 'cancelled')`
    ),
  })
);
