---
description: "Integrate with n8n to orchestrate jobs and manage status transitions."
globs:
  - src/lib/orchestration/**
  - src/app/api/webhooks/n8n/**
  - src/lib/db/schema/job-events.ts
alwaysApply: false
---

id: "MVP-009"
title: "Orquestrar pipeline com n8n"
status: "done"
priority: "P0"
labels: ["workflow","integration","api"]
dependencies: ["MVP-008"]
created: "2025-09-22"
completed: "2025-09-26"

# 1) High-Level Objective

Disparar n8n com payload inicial e processar webhooks para atualizar estados do job.

# 2) Background / Context (Optional but recommended)

Secoes 9, 9A e 10 do starter-prompt definem contratos.

# 3) Assumptions & Constraints

- CONSTRAINT: Responder 422 se workflow nao tiver `llm_token_ref_default`.
- CONSTRAINT: Validar `tenant_id` recebido nos webhooks; mismatch => 409.
- ASSUMPTION: Endpoint n8n configurado via `N8N_WEBHOOK_URL`.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/jobs/types.ts
- src/lib/workflows/tenant-types.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/lib/jobs/**
- src/lib/workflows/**
- docs/business/starter-prompt.md _(read-only)_
- src/lib/storage/jobs-paths.ts

**End state (must exist after completion):**

- src/lib/orchestration/n8n-client.ts
- src/app/api/operator/jobs/[jobId]/start/route.ts
- src/app/api/webhooks/n8n/route.ts
- src/lib/db/schema/job-events.ts
- tests/integration/n8n-webhook.test.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `job_events` registrando `job_id`, `event_type`, `payload`, `created_at`.
2. Implementar `n8n-client.ts` com funcoes `triggerWorkflow(startPayload)` e `sendReviewApproval`.
3. Criar endpoint POST `/api/operator/jobs/{jobId}/start` que verifica token, monta payload e chama `triggerWorkflow`.
4. Atualizar status do job para `processing` logo apos disparo, registrando evento `job_started`.
5. Implementar webhook `/api/webhooks/n8n` tratando:
   - `review` => salvar payload em `review_gates`, atualizar status `review:<gateId>`.
   - `done` => atualizar `final_pdf_url`, status `done`.
   - `failed` => registrar erro e status `failed`.
6. Validar `tenant_id` do payload comparando com job; mismatch => 409 e log.
7. Registrar cada chamada em `job_events` com payload bruto para audit.

# 7) Types & Interfaces (if applicable)

`src/lib/orchestration/types.ts`:
```ts
export interface N8NStartPayload {
  tenant_id: string;
  job_id: string;
  workflow_id: string;
  pdf_url: string;
  llm: { provider: string; token_ref: string; };
}
export interface N8NReviewPayload {
  tenant_id: string;
  job_id: string;
  gate_id: string;
  input_kind: "agent" | "group";
  ref_id: string;
  keys: Record<string, string>;
  pages: string[];
  key_sources?: Record<string, string>;
}
```

# 8) Acceptance Criteria

- Chamada `/api/operator/jobs/{jobId}/start` retorna 202 ou 422 conforme token configurado.
- Webhooks atualizam status e geram registros em `job_events`.
- Teste de integracao simula webhook de review e finalizacao validando transicoes.

# 9) Testing Strategy

`tests/integration/n8n-webhook.test.ts` usando `nock` para mockar n8n; enviar payloads conforme secao 10 e verificar DB.

# 10) Notes / Links

- Considerar assinatura HMAC como tarefa futura; deixar TODO documentado.
