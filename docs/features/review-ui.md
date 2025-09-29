# Interface de Revisão de Gates

## Visão Geral
- `/reviews` lista todos os jobs com status `review:<gate_id>` para o tenant atual.
- Cada item apresenta workflow, identificador do job, quantidade de chaves e miniatura da primeira página enviada pelo n8n.
- A rota `/reviews/[jobId]/[gateId]` entrega layout dividido com o documento à esquerda e formulário de chaves editáveis à direita.
- Ao aprovar, o operador envia as alterações para o n8n e o job volta ao fluxo automatizado.

## Componentes Principais
- `src/app/(operator)/reviews/page.tsx`: consulta `review_gates` + `jobs` para renderizar a lista de pendências.
- `src/app/(operator)/reviews/[jobId]/[gateId]/page.tsx`: carrega payload do gate, histórico (`key_audit`) e delega ao cliente.
- `src/app/(operator)/reviews/[jobId]/[gateId]/review-detail-client.tsx`: componente client-side que controla edição das chaves, pré-visualização das páginas e dispara o server action.
- `src/lib/actions/review/submit.ts`: server action que valida sessão do operador, registra auditoria, atualiza tabelas e chama `sendReviewApproval` para o n8n.
- `src/lib/db/schema/review-gates.ts` e `src/lib/db/schema/key-audit.ts`: novas tabelas para armazenar payload recebido e trilha de auditoria.

## Fluxo de Uso
1. n8n abre um gate de revisão via `POST /api/webhooks/n8n`; o payload populates `review_gates` e o job troca para `review:<gate_id>`.
2. Operador acessa `/reviews`, identifica o job e abre o detalhe.
3. No detalhe, cada chave mostra valor original, origem (`source_agent_id`) e destaque quando editada.
4. Ao enviar, o formulário serializa os valores (`keysReviewed`) e chama `submitReviewAction`.
5. A action grava entradas em `key_audit` para cada chave modificada, muda o gate para `approved`, atualiza o job (`status = processing`) e emite o job event `review_approved`.
6. `sendReviewApproval` notifica o n8n com payload conforme seção 10.3 do starter-prompt.

## Auditoria
- Tabela `key_audit` guarda `job_id`, `gate_id`, valores antigo/novo, usuário que editou e `source_agent_id`.
- O histórico fica disponível no painel lateral da revisão com timestamp em `pt-BR`.

## Configuração
- Necessário definir `N8N_WEBHOOK_URL` (ou variáveis específicas) para que o acionamento ao n8n complete com sucesso.
- Testes E2E (`tests/e2e/review-flow.spec.ts`) exigem `PLAYWRIGHT_STORAGE_STATE` com sessão de operador e `N8N_WEBHOOK_URL` válidos.

## Considerações
- Caso n8n esteja indisponível a action retorna erro sem persistir alterações, preservando o estado pendente.
- O layout suporta múltiplas páginas de documento; imagens são renderizadas diretamente das URLs fornecidas pelo orchestrator.

