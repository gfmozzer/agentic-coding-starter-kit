"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { renderTemplates } from "@/lib/db/schema/templates";
import { sanitizeRenderTemplateHtml } from "@/lib/templates/sanitize-html";
import type { ActionState } from "./agent-action-state";

const descriptionField = z
  .string()
  .trim()
  .max(500, "Descricao muito longa")
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome eh obrigatorio")
    .max(255, "Nome muito longo"),
  description: descriptionField,
  html: z.string().min(1, "HTML eh obrigatorio"),
});

const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().uuid("ID invalido"),
});

function mapZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

async function requireSuperAdmin() {
  const session = await getSessionContext();
  if (!session || session.role !== "super-admin") {
    throw new Error("Acesso negado");
  }
  return session;
}

function handleZodError(error: unknown): ActionState {
  if (error instanceof z.ZodError) {
    return { fieldErrors: mapZodErrors(error) };
  }
  return { error: "Erro interno do servidor" };
}

function revalidateTemplatesViews() {
  revalidatePath("/super-admin/templates");
  revalidatePath("/super-admin/workflows");
}

export async function createRenderTemplateAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSuperAdmin();

    const parsed = createTemplateSchema.safeParse(
      Object.fromEntries(formData.entries())
    );

    if (!parsed.success) {
      return { fieldErrors: mapZodErrors(parsed.error) };
    }

    const sanitizedHtml = sanitizeRenderTemplateHtml(parsed.data.html);

    await db
      .insert(renderTemplates)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        html: sanitizedHtml,
        createdBy: session.userId ?? null,
      });

    revalidateTemplatesViews();
    return { success: "Template criado com sucesso" };
  } catch (error) {
    console.error("createRenderTemplateAction", error);
    return handleZodError(error);
  }
}

export async function updateRenderTemplateAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();

    const parsed = updateTemplateSchema.safeParse(
      Object.fromEntries(formData.entries())
    );

    if (!parsed.success) {
      return { fieldErrors: mapZodErrors(parsed.error) };
    }

    const sanitizedHtml = sanitizeRenderTemplateHtml(parsed.data.html);

    const [updated] = await db
      .update(renderTemplates)
      .set({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        html: sanitizedHtml,
        updatedAt: new Date(),
      })
      .where(eq(renderTemplates.id, parsed.data.id))
      .returning({ id: renderTemplates.id });

    if (!updated) {
      return { error: "Template nao encontrado" };
    }

    revalidateTemplatesViews();
    return { success: "Template atualizado com sucesso" };
  } catch (error) {
    console.error("updateRenderTemplateAction", error);
    return handleZodError(error);
  }
}

export async function deleteRenderTemplateAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();

    const templateId = formData.get("templateId")?.toString();
    if (!templateId) {
      return { error: "ID do template eh obrigatorio" };
    }

    const [deleted] = await db
      .delete(renderTemplates)
      .where(eq(renderTemplates.id, templateId))
      .returning({ id: renderTemplates.id });

    if (!deleted) {
      return { error: "Template nao encontrado" };
    }

    revalidateTemplatesViews();
    return { success: "Template excluido com sucesso" };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") {
        return {
          error: "Template em uso por workflow. Remova a associacao antes de excluir.",
        };
      }
    }

    console.error("deleteRenderTemplateAction", error);
    return { error: "Erro interno do servidor" };
  }
}
