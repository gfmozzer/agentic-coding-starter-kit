# Dashboard de Jobs e M�tricas

## Vis�o Geral
- `/jobs` lista os jobs do tenant com status, hora da �ltima atualiza��o, acur�cia m�dia por agentes e indica��o do PDF final.
- `/jobs/[jobId]` apresenta timeline de eventos (`job_events`), m�tricas por agente e bot�o para download do PDF final com URL assinada quando poss�vel.
- A acur�cia � calculada com a f�rmula `1 - (editadas_do_agente / total_keys_do_agente)`.

## Componentes Principais
- `src/app/(operator)/jobs/page.tsx`: consulta `jobs`, `workflows` e `agent_job_metrics` para montar cards de resumo e tabela de jobs.
- `src/app/(operator)/jobs/[jobId]/page.tsx`: carrega detalhes do job, m�tricas agregadas e timeline; aciona `StorageClient` para gerar URL assinada.
- `src/lib/metrics/agent-accuracy.ts`: exp�e `calculateAgentAccuracy` e `computeAccuracy` para normalizar m�tricas por agente.
- `src/lib/db/schema/job-metrics.ts`: view `agent_job_metrics` mapeada para uso via Drizzle.

## Fluxo de Uso
1. Ap�s revis�es, `key_audit` registra edi��es com `source_agent_id`.
2. A view `agent_job_metrics` agrega total de chaves por agente e quantidade editada por job.
3. O dashboard consome essas m�tricas para exibir acur�cia m�dia e detalhada por agente.
4. Quando o job finaliza, `jobs.result.finalPdfUrl` � usado para gerar link assinado com `StorageClient`.

## M�tricas e F�rmulas
- `accuracy = max(0, 1 - editedKeys / totalKeys)` com fallback: `accuracy = 1` quando `totalKeys = 0` e sem edi��es; `0` caso existam edi��es sem total registrado.
- A tabela lateral do detalhe apresenta `totalKeys`, `editedKeys` e `accuracy` por agente.

## Depend�ncias
- Requer execu��o da migra��o `20251001_add_agent_job_metrics_view.sql` para criar a view.
- Necessita `S3_BUCKET` configurado para gera��o de URLs assinadas; se indispon�vel, exibe o link bruto.

## Testes
- `tests/unit/metrics-accuracy.test.ts` cobre cen�rios de c�lculo de acur�cia (sem edi��es, edits > total, aus�ncia de chaves).
