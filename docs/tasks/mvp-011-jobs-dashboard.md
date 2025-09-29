---
description: "Provide jobs dashboard with metrics and final download."
globs:
  - src/app/(operator)/jobs/**
  - src/lib/metrics/**
  - src/lib/db/schema/job-metrics.ts
alwaysApply: false
---

id: "MVP-011"
title: "Dashboard de jobs e metricas por agente"
status: "done"
priority: "P1"
labels: ["metrics","jobs","ui"]
dependencies: ["MVP-010"]
created: "2025-09-22"
completed: "2025-09-30"

# 1) High-Level Objective

Exibir historico de jobs, metricas de acuracia por agente e permitir download do PDF final.

# 2) Background / Context (Optional but recommended)

Secoes 11, 12 e criterios de aceite do starter-prompt.

# 3) Assumptions & Constraints

- CONSTRAINT: Calculo de acuracia segue formula `1 - (editadas_do_agente / total_keys_do_agente)`.
- CONSTRAINT: Downloads usam `StorageClient` com URLs assinadas.
- ASSUMPTION: Metricas podem usar view materializada ou consulta agregada.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/db/schema/key-audit.ts
- src/lib/orchestration/n8n-client.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(operator)/jobs/**
- src/lib/db/schema/jobs.ts
- src/lib/db/schema/key-audit.ts
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/lib/metrics/agent-accuracy.ts
- src/lib/db/schema/job-metrics.ts
- src/app/(operator)/jobs/page.tsx
- src/app/(operator)/jobs/[jobId]/page.tsx
- tests/unit/metrics-accuracy.test.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar view `agent_job_metrics` agregando `key_audit` por `job_id` e `source_agent_id`.
2. Implementar `calculateAgentAccuracy(jobId)` retornando lista `AgentJobMetric`.
3. Construir pagina `/operator/jobs` listando jobs com status, workflow, data e botoes de acao.
4. Criar pagina detalhada `/operator/jobs/[jobId]` mostrando timeline (eventos) e tabela de metricas por agente.
5. Incluir botao `Baixar PDF final` usando URL assinada de `final_pdf_url`.
6. Destacar status com badges (`queued`, `processing`, `review:<gate>`, `done`, `failed`).
7. Exibir aviso caso job falhe com link para logs (`job_events`).

# 7) Types & Interfaces (if applicable)

`src/lib/metrics/types.ts`:
```ts
export interface AgentJobMetric {
  agentId: string;
  totalKeys: number;
  editedKeys: number;
  accuracy: number;
}
```

# 8) Acceptance Criteria

- Dashboard lista jobs com metricas atualizadas apos auditorias.
- Download do PDF final funciona (mock ou storage real).
- Teste unitario verifica calculo de acuracia com casos basicos.

# 9) Testing Strategy

`tests/unit/metrics-accuracy.test.ts` cobre calculo; teste Playwright valida exibicao das metricas e download.

# 10) Notes / Links

- Avaliar grafico simples usando `@tanstack/react-charts` para representar metricas.

