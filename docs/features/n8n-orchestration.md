# Orquestração n8n para Jobs

## Visão Geral
- `src/lib/orchestration/n8n-client.ts` centraliza os disparos HTTP para a instância do n8n usando `N8N_WEBHOOK_URL`, com fallback para `N8N_WEBHOOK_START_URL`/`N8N_WEBHOOK_BASE_URL` e cabeçalho opcional `N8N_WEBHOOK_AUTH_HEADER`.
- `POST /api/operator/jobs/[jobId]/start` valida sessão do operador, garante presença de `llmTokenRefDefault`, monta o payload esperado pelo n8n e atualiza o job para `processing`, registrando o evento `job_started`.
- `POST /api/webhooks/n8n` processa callbacks do n8n (review, done, failed), aplica transições de status, sincroniza sessões de review e armazena o payload bruto em `job_events` para auditoria.

## Fluxo de Disparo
1. Operador chama `/start` para um job `queued`.
2. A rota monta `N8NStartPayload` contendo `tenant_id`, `job_id`, `workflow_id`, URL do PDF e dados de LLM (provider + token).
3. `n8n-client.triggerWorkflow` envia o POST e, em caso de sucesso, o job passa para `processing`; em falha, o erro é persistido e um evento `job_start_failed` é gravado.

## Webhooks do n8n
- **Review Gate** (`gate_id` presente):
  - Atualiza/insere sessão em `review_sessions`, define status do job como `review:<gateId>` e persiste snapshot em `jobs.result.reviewGates`.
  - Evento registrado: `review_gate_opened` (payload bruto).
- **Conclusão** (`status: "done"`):
  - Job muda para `done`, `result.finalPdfUrl` é preenchido e `job_completed` é registrado.
- **Falha** (`status: "failed"`):
  - Job passa para `failed`, `error` recebe o motivo e `job_failed` guarda o payload.
- Mismatch de `tenant_id` retorna 409 e gera `webhook_tenant_mismatch` para rastreamento.
- TODO explícito no handler reforça necessidade de validar assinatura HMAC em etapas futuras.

## Dados Persistidos
- Nova tabela dedicada `job_events` (agora em `src/lib/db/schema/job-events.ts`) registra cada interação relevante com payload completo.
- Campos JSON de `jobs.result` guardam metadados de review (`reviewGates`), PDF final e informações de erro/execução.

## Variáveis de Ambiente
- `N8N_WEBHOOK_URL` (ou `N8N_WEBHOOK_START_URL`/`N8N_WEBHOOK_BASE_URL`) — endpoint de disparo.
- `N8N_WEBHOOK_REVIEW_URL` opcional para aprovações futuras; atualmente padrão `/review`.
- `N8N_WEBHOOK_AUTH_HEADER` — valor enviado em `Authorization` para webhooks protegidos.

## Testes
- `tests/integration/n8n-webhook.test.ts` monta fixtures reais no banco, intercepta chamadas HTTP com `undici.MockAgent` e verifica:
  - Transição `queued -> processing` após disparo com registro de evento.
  - Persistência da sessão de review e mudança para `review:<gateId>`.
  - Conclusão do job com `finalPdfUrl` e evento `job_completed`.

## Decisões de Projeto
- Eventos do n8n são gravados sem sanitização para garantir rastreabilidade completa; políticas de retenção devem ser avaliadas em produção.
- Payloads de review são guardados tanto em `review_sessions` quanto no snapshot do job para facilitar telas futuras sem múltiplos joins.
- Em caso de falha no disparo, job permanece `queued`, permitindo retry manual sem recriação.
- Estrutura de cliente isolada (`n8n-client`) facilita futura troca por filas/background jobs.
