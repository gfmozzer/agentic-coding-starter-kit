---
description: "Implement global workflow builder with groups and review gates."
globs:
  - src/lib/db/schema/workflows.ts
  - src/app/(super-admin)/workflows/**
  - src/lib/workflows/**
alwaysApply: false
---

id: "MVP-005"
title: "Super-admin monta workflows com gates"
status: "planned"
priority: "P0"
labels: ["workflow","super-admin","builder"]
dependencies: ["MVP-004"]
created: "2025-09-22"

# 1) High-Level Objective

Permitir definir workflows que encadeiam agentes, grupos, review gates, translator e render conforme spec.

# 2) Background / Context (Optional but recommended)

docs/business/starter-prompt.md secoes 1, 7 e 8 detalham estrutura esperada.

# 3) Assumptions & Constraints

- CONSTRAINT: Builder deve impedir passos sem referencia valida.
- CONSTRAINT: Apenas um passo `render` por workflow.
- ASSUMPTION: UI pode ser lista sequencial com botoes add/remover.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/ai/agent-registry.ts
- docs/business/starter-prompt.md
- src/lib/db/schema/agents.ts

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(super-admin)/workflows/**
- src/components/ui/**
- src/lib/workflows/**
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/lib/db/schema/workflows.ts
- src/lib/workflows/builder.ts
- src/app/(super-admin)/workflows/[workflowId]/builder/page.tsx
- tests/unit/workflow-serialization.test.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabelas `workflow_templates`, `workflow_steps`, `workflow_step_groups`, `workflow_step_reviews`.
2. Definir enum `WorkflowStepType = 'agent' | 'group' | 'review_gate' | 'translator' | 'render'`.
3. Implementar serializer `buildRuntimeWorkflow(workflowId)` retornando JSON conforme exemplo do starter-prompt.
4. Criar pagina builder com lista ordenada mostrando tipo, referencia, agente ou grupo, e botoes de configuracao.
5. Validar que `review_gate.input.refId` referencia passo valido e tipo compatível.
6. Permitir configurar `group.members` escolhendo agentes do catalogo.
7. Adicionar painel de preview JSON em tempo real e botao salvar.
8. Registrar alteracoes em `workflow_audit` com diff do JSON.

# 7) Types & Interfaces (if applicable)

`src/lib/workflows/types.ts`:
```ts
export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}
export interface WorkflowStepBase {
  id: string;
  type: WorkflowStepType;
  order: number;
}
```

# 8) Acceptance Criteria

- Super-admin consegue criar workflow identico ao exemplo da secao 7.
- Serializer bloqueia referencias invalidas e retorna estrutura ordenada.
- Teste unitario valida integridade das referencias e tipos.

# 9) Testing Strategy

`tests/unit/workflow-serialization.test.ts` cria workflow fake e verifica JSON final + erros de validacao.

# 10) Notes / Links

- Considerar salvar `input_from` diretamente em `workflow_steps` para facilitar validacao.
