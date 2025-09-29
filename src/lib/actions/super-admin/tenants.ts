"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { withTenantContext } from "@/lib/db/tenant-context";
import { user } from "@/lib/db/schema/auth";
import {
  tenantInvites,
  tenantMembers,
  tenants,
} from "@/lib/db/schema/tenants";
import type {
  AssignTenantRoleInput,
  CancelTenantInviteInput,
  RemoveTenantMemberInput,
  UpdateTenantMemberRoleInput,
  UpsertTenantInput,
} from "./types";
import type { ActionState } from "./agent-action-state";

const upsertTenantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Slug deve ter pelo menos 3 caracteres.")
    .max(64, "Slug muito longo.")
    .regex(
      /^[a-z0-9][a-z0-9-]+$/,
      "Use apenas letras minúsculas, números e hífens."
    )
    .optional(),
  settings: z.string().optional(),
});

const assignRoleSchema = z.object({
  tenantId: z.string().uuid(),
  userEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido."),
  role: z.enum(["super-admin", "tenant-admin", "operator"]),
});

const removeMemberSchema = z.object({
  tenantId: z.string().uuid(),
  memberId: z.string().uuid(),
});

const updateMemberRoleSchema = z.object({
  tenantId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(["super-admin", "tenant-admin", "operator"]),
});

const cancelInviteSchema = z.object({
  tenantId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

function slugify(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned.slice(0, 64);
}

function parseSettings(raw?: string): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Settings deve ser um objeto JSON.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `JSON inválido para settings: ${error.message}`
        : "JSON inválido para settings"
    );
  }
}

async function requireSuperAdmin() {
  const session = await getSessionContext();
  if (!session || session.role !== "super-admin") {
    throw new Error("Acesso negado");
  }
  return session;
}

function success(message: string): ActionState {
  return { success: message };
}

function failure(message: string, fieldErrors?: ActionState["fieldErrors"]): ActionState {
  return { error: message, fieldErrors };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertTenantAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();
    const input: UpsertTenantInput = {
      id: formData.get("id")?.toString() || undefined,
      name: formData.get("name")?.toString() ?? "",
      slug: formData.get("slug")?.toString() || undefined,
      settings: formData.get("settings")?.toString() || undefined,
    };

    const parsed = upsertTenantSchema.safeParse(input);
    if (!parsed.success) {
      const fields: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path.length > 0) {
          fields[issue.path[0] as string] = issue.message;
        }
      }
      return failure("Verifique os campos destacados.", fields);
    }

    const slug = slugify(parsed.data.slug ?? parsed.data.name);
    if (!slug) {
      return failure("Não foi possível gerar um slug válido para o tenant.");
    }

    let settingsJson: Record<string, unknown> | undefined;
    try {
      settingsJson = parseSettings(parsed.data.settings);
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error), {
        settings: "JSON inválido",
      });
    }

    if (parsed.data.id) {
      await db
        .update(tenants)
        .set({
          name: parsed.data.name,
          slug,
          ...(settingsJson ? { settings: settingsJson } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, parsed.data.id));
      revalidatePath("/super-admin/tenants");
      return success("Tenant atualizado com sucesso.");
    }

    await db.insert(tenants).values({
      name: parsed.data.name,
      slug,
      ...(settingsJson ? { settings: settingsJson } : {}),
    });

    revalidatePath("/super-admin/tenants");
    return success("Tenant criado com sucesso.");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return failure("Já existe um tenant com esse slug.", { slug: "Slug em uso" });
    }

    console.error("upsertTenantAction error", error);
    return failure("Não foi possível salvar o tenant. Tente novamente.");
  }
}

export async function assignTenantRoleAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSuperAdmin();
    const input: AssignTenantRoleInput = {
      tenantId: formData.get("tenantId")?.toString() ?? "",
      userEmail: formData.get("userEmail")?.toString() ?? "",
      role: (formData.get("role")?.toString() ?? "operator") as AssignTenantRoleInput["role"],
    };

    const parsed = assignRoleSchema.safeParse(input);
    if (!parsed.success) {
      const fields: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path.length > 0) {
          fields[issue.path[0] as string] = issue.message;
        }
      }
      return failure("Não foi possível processar os dados do convite.", fields);
    }

    const normalizedEmail = normalizeEmail(parsed.data.userEmail);

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      await withTenantContext(parsed.data.tenantId, async (tx) => {
        await tx
          .insert(tenantMembers)
          .values({
            tenantId: parsed.data.tenantId,
            userId: existingUser.id,
            role: parsed.data.role,
          })
          .onConflictDoUpdate({
            target: [tenantMembers.tenantId, tenantMembers.userId],
            set: {
              role: parsed.data.role,
              updatedAt: new Date(),
            },
          });

        await tx
          .update(tenantInvites)
          .set({
            status: "accepted",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantInvites.tenantId, parsed.data.tenantId),
              eq(tenantInvites.email, normalizedEmail)
            )
          );
      });

      revalidatePath("/super-admin/tenants");
      revalidatePath(`/super-admin/tenants/${parsed.data.tenantId}/users`);
      return success("Usuário vinculado ao tenant com sucesso.");
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await withTenantContext(parsed.data.tenantId, async (tx) => {
      await tx
        .insert(tenantInvites)
        .values({
          tenantId: parsed.data.tenantId,
          email: normalizedEmail,
          role: parsed.data.role,
          status: "pending",
          token: randomUUID(),
          invitedBy: session.userId,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [tenantInvites.tenantId, tenantInvites.email],
          set: {
            role: parsed.data.role,
            status: "pending",
            token: randomUUID(),
            invitedBy: session.userId,
            expiresAt,
            updatedAt: new Date(),
          },
        });
    });

    revalidatePath(`/super-admin/tenants/${parsed.data.tenantId}/users`);
    return success(
      "Convite registrado. O usuário será notificado quando a funcionalidade de convites estiver ativa."
    );
  } catch (error) {
    console.error("assignTenantRoleAction error", error);
    return failure("Falha ao atribuir usuário ao tenant.");
  }
}

export async function removeTenantMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();
    const input: RemoveTenantMemberInput = {
      tenantId: formData.get("tenantId")?.toString() ?? "",
      memberId: formData.get("memberId")?.toString() ?? "",
    };

    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) {
      return failure("Dados inválidos para remover membro.");
    }

    await withTenantContext(parsed.data.tenantId, async (tx) => {
      await tx
        .delete(tenantMembers)
        .where(eq(tenantMembers.id, parsed.data.memberId));
    });

    revalidatePath(`/super-admin/tenants/${parsed.data.tenantId}/users`);
    revalidatePath("/super-admin/tenants");
    return success("Membro removido do tenant.");
  } catch (error) {
    console.error("removeTenantMemberAction error", error);
    return failure("Não foi possível remover o membro.");
  }
}

export async function updateTenantMemberRoleAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();
    const input: UpdateTenantMemberRoleInput = {
      tenantId: formData.get("tenantId")?.toString() ?? "",
      memberId: formData.get("memberId")?.toString() ?? "",
      role: (formData.get("role")?.toString() ?? "operator") as UpdateTenantMemberRoleInput["role"],
    };

    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) {
      return failure("Não foi possível atualizar o papel do membro.");
    }

    await withTenantContext(parsed.data.tenantId, async (tx) => {
      await tx
        .update(tenantMembers)
        .set({
          role: parsed.data.role,
          updatedAt: new Date(),
        })
        .where(eq(tenantMembers.id, parsed.data.memberId));
    });

    revalidatePath(`/super-admin/tenants/${parsed.data.tenantId}/users`);
    revalidatePath("/super-admin/tenants");
    return success("Papel atualizado.");
  } catch (error) {
    console.error("updateTenantMemberRoleAction error", error);
    return failure("Falha ao atualizar papel do membro.");
  }
}

export async function cancelTenantInviteAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();
    const input: CancelTenantInviteInput = {
      tenantId: formData.get("tenantId")?.toString() ?? "",
      inviteId: formData.get("inviteId")?.toString() ?? "",
    };

    const parsed = cancelInviteSchema.safeParse(input);
    if (!parsed.success) {
      return failure("Convite inválido.");
    }

    await withTenantContext(parsed.data.tenantId, async (tx) => {
      await tx
        .update(tenantInvites)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(tenantInvites.id, parsed.data.inviteId));
    });

    revalidatePath(`/super-admin/tenants/${parsed.data.tenantId}/users`);
    return success("Convite cancelado.");
  } catch (error) {
    console.error("cancelTenantInviteAction error", error);
    return failure("Não foi possível cancelar o convite.");
  }
}
