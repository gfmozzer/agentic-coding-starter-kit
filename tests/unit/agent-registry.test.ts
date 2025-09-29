import assert from "node:assert/strict";
import { test } from "node:test";

process.env.POSTGRES_URL ??= "postgres://user:pass@localhost:5432/test";

const agentModulePromise = import("../../src/lib/ai/agent-registry");
const schemaModulePromise = import("../../src/lib/db/schema/agents");

async function createBaseRow() {
  const { agents } = await schemaModulePromise;
  const baseRow: typeof agents.$inferSelect = {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Extrator Structured",
    kind: "structured",
    systemPrompt: "Extraia chaves estruturadas",
    inputExample: "{\"documentUrl\":\"https://example.com\"}",
    outputSchemaJson: { type: "object", properties: { name: { type: "string" } } },
    defaultProvider: "openai",
    defaultModel: "gpt-4.1-mini",
    webhookUrl: "https://example.com/agents/structured",
    webhookAuthHeader: "Bearer token-123",
    createdAt: new Date("2025-09-23T10:00:00.000Z"),
    updatedAt: new Date("2025-09-24T10:00:00.000Z"),
  };
  return baseRow;
}

test("mapAgentRowToDefinition retorna agente normalizado", async () => {
  const baseRow = await createBaseRow();
  const { mapAgentRowToDefinition } = await agentModulePromise;
  const definition = mapAgentRowToDefinition(baseRow);
  assert.equal(definition.id, baseRow.id);
  assert.equal(definition.name, baseRow.name);
  assert.equal(definition.kind, baseRow.kind);
  assert.equal(definition.systemPrompt, baseRow.systemPrompt);
  assert.equal(definition.defaultProvider, baseRow.defaultProvider);
  assert.equal(definition.defaultModel, baseRow.defaultModel);
  assert.equal(definition.webhookUrl, baseRow.webhookUrl);
  assert.equal(definition.webhookAuthHeader, baseRow.webhookAuthHeader);
  assert.deepEqual(definition.outputSchema, baseRow.outputSchemaJson);
});

test("mapAgentRowToDefinition lança erro quando schema não é objeto", async () => {
  const baseRow = await createBaseRow();
  const { mapAgentRowToDefinition } = await agentModulePromise;
  const invalidRow = { ...baseRow, outputSchemaJson: "invalid" as unknown as Record<string, unknown> };
  assert.throws(() => mapAgentRowToDefinition(invalidRow), /schema inválido/i);
});
