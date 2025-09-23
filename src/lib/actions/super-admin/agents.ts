"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateObject, NoObjectGeneratedError } from "ai";
import { openai } from "@ai-sdk/openai";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentAudit, agents } from "@/lib/db/schema/agents";

import type { AgentKind } from "@/lib/ai/types";
import type { ActionState } from "./agent-action-state";

type AgentRow = typeof agents.$inferSelect;

type JsonObject = Record<string, unknown>;

const agentKindSchema = z.enum(["ocr", "structured", "translator", "render"]);

const agentFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "Nome precisa de pelo menos 3 caracteres."),
  kind: agentKindSchema,
  systemPrompt: z
    .string()
    .trim()
    .min(10, "Prompt deve ter pelo menos 10 caracteres."),
  inputExample: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  outputSchemaJson: z.string().optional(),
  defaultProvider: z
    .string()
    .trim()
    .min(1, "Informe o provider padrao."),
  defaultModel: z
    .string()
    .trim()
    .min(1, "Informe o modelo padrao."),
});

const testSchemaForm = z.object({
  kind: agentKindSchema,
  systemPrompt: z
    .string()
    .trim()
    .min(10, "Prompt deve ter pelo menos 10 caracteres."),
  inputExample: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  outputSchemaJson: z.string().optional(),
  defaultProvider: z
    .string()
    .trim()
    .min(1, "Informe o provider padrao."),
  defaultModel: z
    .string()
    .trim()
    .min(1, "Informe o modelo padrao."),
});

function requiresSchema(kind: AgentKind): boolean {
  return kind === "structured";
}

function parseOutputSchema(kind: AgentKind, value: string | undefined): JsonObject {
  const trimmed = value?.trim() ?? "";
  const mustProvide = requiresSchema(kind);

  if (!trimmed) {
    if (mustProvide) {
      throw new Error("Informe um JSON valido para agentes structured.");
    }
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("O schema deve ser um objeto JSON.");
    }
    return parsed as JsonObject;
  } catch (error) {
    throw new Error(
      error instanceof Error ? `JSON invalido: ${error.message}` : "JSON invalido."
    );
  }
}

function buildDiff(before: JsonObject | null, after: JsonObject) {
  return {
    before,
    after,
  };
}

type AgentSnapshot = {
  name: string;
  kind: AgentKind;
  systemPrompt: string;
  inputExample: string | null;
  outputSchemaJson: JsonObject;
  defaultProvider: string;
  defaultModel: string;
};

function normalizeInput(
  input: z.infer<typeof agentFormSchema>,
  schema: JsonObject
): AgentSnapshot {
  return {
    name: input.name,
    kind: input.kind as AgentKind,
    systemPrompt: input.systemPrompt,
    inputExample: input.inputExample ?? null,
    outputSchemaJson: schema,
    defaultProvider: input.defaultProvider,
    defaultModel: input.defaultModel,
  };
}

function snapshotFromRow(row: AgentRow): AgentSnapshot {
  return {
    name: row.name,
    kind: row.kind as AgentKind,
    systemPrompt: row.systemPrompt,
    inputExample: row.inputExample ?? null,
    outputSchemaJson: row.outputSchemaJson as JsonObject,
    defaultProvider: row.defaultProvider,
    defaultModel: row.defaultModel,
  };
}

function collectFieldErrors(issues: z.ZodIssue[]) {
  const fieldErrors: Record<string, string | undefined> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export async function upsertAgentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSuperAdmin();

    const parsed = agentFormSchema.safeParse({
      id: formData.get("id")?.toString() ?? undefined,
      name: formData.get("name")?.toString() ?? "",
      kind: formData.get("kind")?.toString() ?? "structured",
      systemPrompt: formData.get("systemPrompt")?.toString() ?? "",
      inputExample: formData.get("inputExample")?.toString() ?? undefined,
      outputSchemaJson: formData.get("outputSchemaJson")?.toString() ?? "",
      defaultProvider: formData.get("defaultProvider")?.toString() ?? "",
      defaultModel: formData.get("defaultModel")?.toString() ?? "",
    });

    if (!parsed.success) {
      return {
        error: "Verifique os campos destacados.",
        fieldErrors: collectFieldErrors(parsed.error.issues),
      };
    }

    let outputSchema: JsonObject;
    try {
      outputSchema = parseOutputSchema(parsed.data.kind as AgentKind, parsed.data.outputSchemaJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON invalido.";
      return {
        error: "Verifique os campos destacados.",
        fieldErrors: { outputSchemaJson: message },
      };
    }

    const payload = normalizeInput(parsed.data, outputSchema);
    const now = new Date();

    if (parsed.data.id) {
      const existing = await db
        .select()
        .from(agents)
        .where(eq(agents.id, parsed.data.id))
        .limit(1)
        .then((rows) => rows[0]);

      if (!existing) {
        return { error: "Agente nao encontrado." };
      }

      await db
        .update(agents)
        .set({
          ...payload,
          updatedAt: now,
        })
        .where(eq(agents.id, parsed.data.id));

      await db.insert(agentAudit).values({
        agentId: parsed.data.id,
        changedBy: session.userId,
        diff: buildDiff(snapshotFromRow(existing), payload),
      });

      revalidatePath("/super-admin/agents");
      return { success: "Agente atualizado com sucesso." };
    }

    const [created] = await db
      .insert(agents)
      .values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: agents.id });

    if (created?.id) {
      await db.insert(agentAudit).values({
        agentId: created.id,
        changedBy: session.userId,
        diff: buildDiff(null, payload),
      });
    }

    revalidatePath("/super-admin/agents");
    return { success: "Agente criado com sucesso." };
  } catch (error) {
    console.error("upsertAgentAction error", error);
    return { error: "Nao foi possivel salvar o agente." };
  }
}

export async function deleteAgentAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const agentId = formData.get("agentId")?.toString();
  if (!agentId) {
    throw new Error("Agente invalido.");
  }

  try {
    await db.delete(agents).where(eq(agents.id, agentId));
    revalidatePath("/super-admin/agents");
  } catch (error) {
    console.error("deleteAgentAction error", error);
    throw error;
  }
}

function buildTestPrompt(systemPrompt: string, inputExample?: string) {
  let prompt = systemPrompt.trim();
  const cleanedExample = inputExample?.trim();
  if (cleanedExample) {
    prompt += `\n\n### Exemplo de entrada\n${cleanedExample}`;
  }
  prompt += "\n\nResponda apenas com um JSON valido que siga o schema fornecido.";
  return prompt;
}

function formatPreview(data: unknown) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    if (!serialized) {
      return "Dry-run concluido, mas nenhuma amostra foi retornada.";
    }
    const limit = 600;
    return serialized.length > limit ? `${serialized.slice(0, limit)}...` : serialized;
  } catch (error) {
    return "Dry-run concluido, mas a amostra nao pode ser serializada.";
  }
}

export async function testAgentSchemaAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperAdmin();

    const parsed = testSchemaForm.safeParse({
      kind: formData.get("kind")?.toString() ?? "structured",
      systemPrompt: formData.get("systemPrompt")?.toString() ?? "",
      inputExample: formData.get("inputExample")?.toString() ?? undefined,
      outputSchemaJson: formData.get("outputSchemaJson")?.toString() ?? undefined,
      defaultProvider: formData.get("defaultProvider")?.toString() ?? "",
      defaultModel: formData.get("defaultModel")?.toString() ?? "",
    });

    if (!parsed.success) {
      return {
        error: "Revise os campos antes de testar.",
        fieldErrors: collectFieldErrors(parsed.error.issues),
      };
    }

    const { kind, systemPrompt, inputExample, outputSchemaJson, defaultProvider, defaultModel } =
      parsed.data;
    const agentKind = kind as AgentKind;
    const trimmedSchema = outputSchemaJson?.trim() ?? "";

    if (!requiresSchema(agentKind) && trimmedSchema.length === 0) {
      return { success: `Schema nao obrigatorio para agentes do tipo ${kind}.` };
    }

    let schemaObject: JsonObject;
    try {
      schemaObject = parseOutputSchema(agentKind, outputSchemaJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON invalido.";
      return {
        error: message,
        fieldErrors: { outputSchemaJson: message },
      };
    }

    if (defaultProvider.toLowerCase() !== "openai") {
      return { error: "Dry-run suporta apenas o provider openai neste momento." };
    }

    if (!process.env.OPENAI_API_KEY) {
      return { error: "Configure OPENAI_API_KEY para testar o schema com generateObject." };
    }

    const modelName = process.env.OPENAI_MODEL?.trim() || defaultModel;
    const prompt = buildTestPrompt(systemPrompt, inputExample);

    const result = await generateObject({
      model: openai(modelName),
      schema: schemaObject as unknown as JsonObject,
      mode: "json",
      prompt,
    });

    const preview = formatPreview(result.object);
    return {
      success: `Schema validado com generateObject. Exemplo:
${preview}`,
    };
  } catch (error) {
    console.error("testAgentSchemaAction error", error);

    if (NoObjectGeneratedError.isInstance(error)) {
      return { error: "O modelo nao conseguiu gerar um objeto valido para o schema informado." };
    }

    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Falha ao validar schema." };
  }
}
