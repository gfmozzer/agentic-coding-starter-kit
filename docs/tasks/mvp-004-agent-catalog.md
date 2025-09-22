---
description: "Build global agent catalog with prompts and schemas."
globs:
  - src/lib/db/schema/agents.ts
  - src/app/(super-admin)/agents/**
  - src/lib/ai/**
alwaysApply: false
---

id: "MVP-004"
title: "Super-admin cataloga agentes globais"
status: "planned"
priority: "P0"
labels: ["ai","catalog","super-admin"]
dependencies: ["MVP-002","MVP-003"]
created: "2025-09-22"

# 1) High-Level Objective

Permitir cadastro de agentes (ocr, structured, translator, render) com prompts e schemas reutilizaveis.

# 2) Background / Context (Optional but recommended)

docs/business/starter-prompt.md secoes 3 e 7 e docs/technical/ai/structure-data.md.

# 3) Assumptions & Constraints

- CONSTRAINT: Persistir schema JSON validado com zod.
- CONSTRAINT: Somente super-admin pode criar ou editar agentes.
- ASSUMPTION: Providers suportados inicial `openai`, mas campo e livre.

# 4) Dependencies (Other Tasks or Artifacts)

- docs/technical/ai/structure-data.md
- docs/technical/ai/text-data.md
- src/lib/db/schema/tenants.ts

# 5) Context Plan

**Beginning (add to model context):**

- src/lib/ai/**
- src/app/(super-admin)/agents/**
- docs/technical/ai/structure-data.md _(read-only)_
- docs/technical/ai/text-data.md _(read-only)_

**End state (must exist after completion):**

- src/lib/db/schema/agents.ts
- src/lib/ai/agent-registry.ts
- src/app/(super-admin)/agents/page.tsx
- tests/unit/agent-registry.test.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `agents` com campos `id`, `name`, `kind`, `system_prompt`, `input_example`, `output_schema_json`, `default_provider`, `default_model`, `created_at`, `updated_at`.
2. Implementar `agent-registry.ts` com funcoes `listAgents` e `getAgentDefinition` retornando schema parseado.
3. Criar pagina `/super-admin/agents` listando agentes por `kind` com filtros e botoes de acao.
4. Implementar formulario (modal) para criar/editar agente com editor JSON validando schema via zod.
5. Adicionar botao "Testar schema" que chama `generateObject` em modo dry-run usando `OPENAI_MODEL`.
6. Garantir que agentes sao globais (sem tenant_id) e protecao por role super-admin.
7. Registrar alteracoes em tabela `agent_audit` com diff de prompt e schema.

# 7) Types & Interfaces (if applicable)

`src/lib/ai/types.ts`:
```ts
export type AgentKind = "ocr" | "structured" | "translator" | "render";
export interface AgentDefinition {
  id: string;
  kind: AgentKind;
  systemPrompt: string;
  outputSchema: JsonSchema;
  defaultProvider: string;
  defaultModel: string;
}
```

# 8) Acceptance Criteria

- Super-admin cria agente structured com schema valido e ve erro quando JSON invalido.
- `getAgentDefinition` retorna objeto pronto para `generateObject`.
- Teste unitario cobre serializacao/deserializacao do schema.

# 9) Testing Strategy

Adicionar `tests/unit/agent-registry.test.ts` com mocks de zod garantindo tratamento de schema invalido.

# 10) Notes / Links

- Avaliar uso de editor leve (ex: `@uiw/react-textarea-code-editor`).
