---
description: "Allow operator to clone workflows, edit prompts and configure tokens."
globs:
  - src/app/(operator)/workflows/**
  - src/lib/actions/operator/**
alwaysApply: false
---

id: "MVP-007"
title: "Operador clona workflows e configura LLM"
status: "planned"
priority: "P0"
labels: ["operator","workflow","tokens"]
dependencies: ["MVP-006"]
created: "2025-09-22"

# 1) High-Level Objective

Dar ao operador meios para clonar workflows publicados, ajustar prompts/HTML e registrar tokens obrigatorios.

# 2) Background / Context (Optional but recommended)

Secoes 8 e 9A do starter-prompt definem responsabilidades do operador.

# 3) Assumptions & Constraints

- CONSTRAINT: Ordem dos passos do workflow permanece imutavel.
- CONSTRAINT: Token default e obrigatorio antes de iniciar job.
- ASSUMPTION: Overrides de prompt sao salvos em tabela separada por passo.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/workflows/builder.ts
- src/lib/db/schema/workflow_publish.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(operator)/layout.tsx
- src/lib/workflows/**
- src/lib/db/schema/**
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/app/(operator)/workflows/page.tsx
- src/app/(operator)/workflows/[workflowId]/settings/page.tsx
- src/lib/actions/operator/workflows.ts
- tests/e2e/operator-clone.spec.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Listar workflows publicados para o tenant com origem em `workflow_template_tenants`.
2. Implementar acao `cloneWorkflowForTenant` que cria registros em `tenant_workflows` e `tenant_workflow_steps`.
3. Criar pagina `/operator/workflows` com botoes `Clonar` e `Abrir configuracoes`.
4. Implementar tela `/operator/workflows/[id]/settings` com abas `Prompts`, `Render HTML`, `Tokens`.
5. Permitir override de `system_prompt` e `provider/token` por passo, persistindo em `tenant_workflow_steps`.
6. Exibir diff entre template original e overrides (ex: highlight de texto).
7. Configurar formulario para `llm_token_ref_default` e bloqueio de status `ready` sem token.
8. Validar no backend que atualizar overrides nao modifica ordem ou estrutura do workflow.

# 7) Types & Interfaces (if applicable)

`src/lib/workflows/tenant-types.ts`:
```ts
export interface TenantWorkflow {
  id: string;
  templateId: string;
  tenantId: string;
  overrides: TenantWorkflowOverride[];
}
```

# 8) Acceptance Criteria

- Operador clona workflow com sucesso e ve overrides salvos.
- Tentativa de iniciar job sem token gera erro 422 com mensagem clara.
- Teste E2E cobre clone, edicao de prompt e salvamento do token.

# 9) Testing Strategy

Playwright `operator-clone.spec.ts` simula clone e confirmacao de dados via API fake.

# 10) Notes / Links

- Considerar modal para exibir instrucoes de tokens por provedor.
