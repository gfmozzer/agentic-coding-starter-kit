# Orquestração n8n para Jobs

## Visão Geral
- `src/lib/orchestration/n8n-client.ts` centraliza os disparos HTTP para a instância do n8n usando `N8N_WEBHOOK_URL`, com fallback para `N8N_WEBHOOK_START_URL`/`N8N_WEBHOOK_BASE_URL` e cabeçalho opcional `N8N_WEBHOOK_AUTH_HEADER`.
- `POST /api/operator/jobs/[jobId]/start` valida sessão do operador, garante presença de `llmTokenRefDefault`, monta o payload esperado pelo n8n e atualiza o job para `processing`, registrando o evento `job_started`.
- `POST /api/webhooks/n8n` processa callbacks do n8n (review, done, failed), aplica transições de status, sincroniza os registros em `review_gates` e armazena o payload bruto em `job_events` para auditoria.

## Fluxo de Disparo
1. Operador chama `/start` para um job `queued`.
2. A rota monta `N8NStartPayload` contendo `tenant_id`, `job_id`, `workflow_id`, URL do PDF, dados de LLM (provider + token) **e o `workflow_definition` completo** — cada step inclui o agente associado com `webhookUrl`/`webhookAuthHeader` configurados no catálogo.
3. `n8n-client.triggerWorkflow` envia o POST e, em caso de sucesso, o job passa para `processing`; em falha, o erro é persistido e um evento `job_start_failed` é gravado.

## Webhooks do n8n
- **Review Gate** (`gate_id` presente):
  - Atualiza/insere registro em `review_gates`, define status do job como `review:<gateId>` e persiste snapshot em `jobs.result.reviewGates`.
  - Evento registrado: `review_gate_opened` (payload bruto).
- **Conclusão** (`status: "done"`):
  - Job muda para `done`, `result.finalPdfUrl` é preenchido e `job_completed` é registrado.
- **Falha** (`status: "failed"`):
  - Job passa para `failed`, `error` recebe o motivo e `job_failed` guarda o payload.
- Mismatch de `tenant_id` retorna 409 e gera `webhook_tenant_mismatch` para rastreamento.
- TODO explícito no handler reforça necessidade de validar assinatura HMAC em etapas futuras.

## Dados Persistidos
- `review_gates` persiste o último payload enviado pelo n8n (keys, sources, páginas, contexto) com RLS por tenant.
- `key_audit` guarda cada edição feita pelo operador (`old_value`, `new_value`, `source_agent_id`, `edited_by`).
- `job_events` registra cada interação relevante com payload completo.
- Campos JSON de `jobs.result` guardam metadados de review (`reviewGates`), PDF final e informações de erro/execução.

## Variáveis de Ambiente
- `N8N_WEBHOOK_URL` (ou `N8N_WEBHOOK_START_URL`/`N8N_WEBHOOK_BASE_URL`) – endpoint de disparo.
- `N8N_WEBHOOK_REVIEW_URL` opcional para aprovações futuras; atualmente padrão `/review`.
- `N8N_WEBHOOK_AUTH_HEADER` – valor enviado em `Authorization` para webhooks protegidos.

## Testes
- `tests/integration/n8n-webhook.test.ts` monta fixtures reais no banco, intercepta chamadas HTTP com `mock.method` e verifica:
  - Transição `queued -> processing` após disparo com registro de evento.
  - Persistência do registro em `review_gates` e mudança para `review:<gateId>`.
  - Conclusão do job com `finalPdfUrl` e evento `job_completed`.

## Decisões de Projeto
- Eventos do n8n são gravados sem sanitização para garantir rastreabilidade completa; políticas de retenção devem ser avaliadas em produção.
- Payloads de review são guardados tanto em `review_gates` quanto no snapshot do job para facilitar telas futuras.
- Em caso de falha no disparo, job permanece `queued`, permitindo retry manual sem recriação.
- O payload de início inclui o `workflow_definition` serializado, permitindo que o n8n resolva o webhook específico de cada agente sem buscar dados adicionais.
