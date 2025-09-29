# Review Gates e Auditoria

## Vis�o Geral
- Review gates s�o criados pelo workflow builder e abertos via webhook do n8n (`POST /api/webhooks/n8n`).
- Cada gate captura `keys`, `key_sources`, p�ginas do documento e contexto adicional.
- Operadores acessam `/reviews` e `/reviews/[jobId]/[gateId]` para revisar as chaves, registrar auditoria e liberar o fluxo.

## Fluxo de Dados
1. **Entrada do n8n** (`src/app/api/webhooks/n8n/route.ts`):
   - Valida `tenant_id` e status do job.
   - Persiste payload em `review_gates` e atualiza `jobs.status` para `review:<gateId>`.
   - Armazena snapshot em `jobs.result.reviewGates` e gera evento `review_gate_opened` em `job_events`.
2. **UI do Operador**:
   - Lista pend�ncias em `src/app/(operator)/reviews/page.tsx` (badge por gate, preview de p�ginas).
   - Detalhe controlado por `review-detail-client.tsx` com layout split (documento x chaves).
3. **Auditoria**:
   - Submiss�o via `src/lib/actions/review/submit.ts`.
   - Calcula diff das chaves e insere em `key_audit` (campos `old_value`, `new_value`, `source_agent_id`).
   - Atualiza `review_gates.status` para `approved`, limpa `jobs.currentGateId`, registra `review_approved` em `job_events` e notifica `sendReviewApproval` (n8n).

## Tabelas e Schemas
- `review_gates` (`src/lib/db/schema/review-gates.ts`): snapshot do gate, `input_kind`, `ref_id`, imagens, `keys`, `keys_translated`, `keys_reviewed`.
- `key_audit` (`src/lib/db/schema/key-audit.ts`): auditoria por chave editada, com `tenant_id`, `review_gate_id`, `job_id`, `gate_id`, `source_agent_id`, `edited_by`.
- `jobs` (`src/lib/db/schema/jobs.ts`): controla `status`, `currentGateId`, `result.reviewGates`.

## Integra��es
- `src/lib/orchestration/n8n-client.ts` fornece `sendReviewApproval`, usando `N8N_WEBHOOK_URL`/`N8N_WEBHOOK_REVIEW_URL`.
- `StorageClient` preserva links de p�ginas renderizadas (imagens) para preview.
- M�tricas de acur�cia utilizam `key_audit` + view `agent_job_metrics` (`docs/features/jobs-dashboard.md`).

## Testes
- E2E: `tests/e2e/review-flow.spec.ts` cobre abertura de gate, edi��o de chave e submiss�o.
- Unit�rios/lint: `pnpm lint`, `pnpm test:unit`.
- Checklist QA: verificar itens 3-5 em `docs/runbooks/qa-mvp.md` (edi��o, aprova��o, avan�o do job).

