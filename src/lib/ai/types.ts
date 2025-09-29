export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonSchema = Record<string, JsonValue>;

export type AgentKind = "ocr" | "structured" | "translator" | "render";

export interface AgentDefinition {
  id: string;
  name: string;
  kind: AgentKind;
  systemPrompt: string;
  inputExample?: string | null;
  outputSchema: JsonSchema;
  defaultProvider: string;
  defaultModel: string;
  webhookUrl: string | null;
  webhookAuthHeader?: string | null;
  updatedAt: Date;
  createdAt: Date;
}
