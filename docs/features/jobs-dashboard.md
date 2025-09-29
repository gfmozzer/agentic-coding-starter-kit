# Dashboard de Jobs e Métricas

## Visão Geral
- `/jobs` lista os jobs do tenant com status, hora da última atualização, acurácia média por agentes e indicação do PDF final.
- `/jobs/[jobId]` apresenta timeline de eventos (`job_events`), métricas por agente e botão para download do PDF final com URL assinada quando possível.
- A acurácia é calculada com a fórmula `1 - (editadas_do_agente / total_keys_do_agente)`.

## Componentes Principais
- `src/app/(operator)/jobs/page.tsx`: consulta `jobs`, `workflows` e `agent_job_metrics` para montar cards de resumo e tabela de jobs.
- `src/app/(operator)/jobs/[jobId]/page.tsx`: carrega detalhes do job, métricas agregadas e timeline; aciona `StorageClient` para gerar URL assinada.
- `src/lib/metrics/agent-accuracy.ts`: expõe `calculateAgentAccuracy` e `computeAccuracy` para normalizar métricas por agente.
- `src/lib/db/schema/job-metrics.ts`: view `agent_job_metrics` mapeada para uso via Drizzle.

## Fluxo de Uso
1. Após revisões, `key_audit` registra edições com `source_agent_id`.
2. A view `agent_job_metrics` agrega total de chaves por agente e quantidade editada por job.
3. O dashboard consome essas métricas para exibir acurácia média e detalhada por agente.
4. Quando o job finaliza, `jobs.result.finalPdfUrl` é usado para gerar link assinado com `StorageClient`.

## Métricas e Fórmulas
- `accuracy = max(0, 1 - editedKeys / totalKeys)` com fallback: `accuracy = 1` quando `totalKeys = 0` e sem edições; `0` caso existam edições sem total registrado.
- A tabela lateral do detalhe apresenta `totalKeys`, `editedKeys` e `accuracy` por agente.

## Dependências
- Requer execução da migração `20251001_add_agent_job_metrics_view.sql` para criar a view.
- Necessita `S3_BUCKET` configurado para geração de URLs assinadas; se indisponível, exibe o link bruto.

## Testes
- `tests/unit/metrics-accuracy.test.ts` cobre cenários de cálculo de acurácia (sem edições, edits > total, ausência de chaves).
