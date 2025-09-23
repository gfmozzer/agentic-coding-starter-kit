import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { agents } from "@/lib/db/schema/agents";

import type { AgentDefinition, AgentKind, JsonSchema } from "./types";

type DbInstance = typeof import("@/lib/db").db;

let cachedDb: DbInstance | null = null;

async function getDb(): Promise<DbInstance> {
  if (!cachedDb) {
    const dbModule = await import("@/lib/db");
    cachedDb = dbModule.db;
  }
  return cachedDb;
}

const schemaValidator = z.record(z.string(), z.any());

type AgentRow = typeof agents.$inferSelect;

export function mapAgentRowToDefinition(row: AgentRow): AgentDefinition {
  const parsedSchema = schemaValidator.safeParse(row.outputSchemaJson);
  if (!parsedSchema.success) {
    throw new Error("Agent output schema inválido (não é um objeto JSON).");
  }

  return {
    id: row.id,
    name: row.name,
    kind: row.kind as AgentKind,
    systemPrompt: row.systemPrompt,
    inputExample: row.inputExample ?? null,
    outputSchema: parsedSchema.data as JsonSchema,
    defaultProvider: row.defaultProvider,
    defaultModel: row.defaultModel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAgents(): Promise<AgentDefinition[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.updatedAt));

  return rows.map(mapAgentRowToDefinition);
}

export async function getAgentDefinition(agentId: string): Promise<AgentDefinition | null> {
  const db = await getDb();
  const row = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)
    .then((records) => records[0]);

  if (!row) {
    return null;
  }

  return mapAgentRowToDefinition(row);
}
