---
description: "Build review UI for gates with audit trail."
globs:
  - src/app/(operator)/reviews/**
  - src/lib/actions/review/**
  - src/lib/db/schema/review-gates.ts
  - src/lib/db/schema/key-audit.ts
alwaysApply: false
---

id: "MVP-010"
title: "Operador revisa gates com auditoria"
status: "done"
priority: "P0"
labels: ["ui","review","audit"]
dependencies: ["MVP-009"]
created: "2025-09-22"
completed: "2025-09-26"

# 1) High-Level Objective

Permitir que operadores revisem chaves retornadas pelos agentes, editem valores e enviem aprovacao ao n8n com auditoria completa.

# 2) Background / Context (Optional but recommended)

Secoes 8, 10 e 11 do starter-prompt descrevem esse fluxo.

# 3) Assumptions & Constraints

- CONSTRAINT: UI deve exibir preview do documento (imagens) ao lado das chaves.
- CONSTRAINT: Cada edicao gera registro em `key_audit`.
- ASSUMPTION: Review gates ficam travados ate aprovacao manual.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/orchestration/n8n-client.ts
- src/lib/db/schema/jobs.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(operator)/layout.tsx
- src/lib/db/schema/jobs.ts
- src/lib/db/schema/job-events.ts
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/app/(operator)/reviews/page.tsx
- src/app/(operator)/reviews/[jobId]/[gateId]/page.tsx
- src/lib/db/schema/review-gates.ts
- src/lib/db/schema/key-audit.ts
- src/lib/actions/review/submit.ts
- tests/e2e/review-flow.spec.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `review_gates` armazenando ultimo payload de gate (`keys`, `key_sources`, `pages`).
2. Criar tabela `key_audit` com `job_id`, `gate_id`, `key`, `old_value`, `new_value`, `edited_by`, `source_agent_id`, `edited_at`.
3. Construir pagina `/operator/reviews` listando jobs com status `review:<gateId>`.
4. Implementar pagina detalhada com layout split (imagem/pdf a esquerda, form dinamico a direita).
5. Mostrar highlight para chaves editadas e informar `source_agent_id` original.
6. Implementar acao `submitReview({ jobId, gateId, keysReviewed })` que salva auditoria e chama `n8nClient.sendReviewApproval`.
7. Atualizar status do job de acordo com proximo passo (ex: `translating` ou proximo gate).
8. Registrar evento `review_approved` em `job_events`.

# 7) Types & Interfaces (if applicable)

`src/lib/reviews/types.ts`:
```ts
export interface ReviewFieldState {
  key: string;
  originalValue: string;
  value: string;
  sourceAgentId?: string;
  edited: boolean;
}
```

# 8) Acceptance Criteria

- Lista de revisoes mostra jobs pendentes com gate id.
- Ao salvar alteracoes, auditoria registra cada chave com valores antigo/novo.
- Chamada a n8n e enviada com payload conforme secoes 10.3 e 10.5.

# 9) Testing Strategy

Playwright `review-flow.spec.ts` simula webhook, edicao de valor e submissao, validando atualizacao do status.

# 10) Notes / Links

- Considerar componente `ResizablePanel` para ajustar tamanho da visualizacao do documento.
