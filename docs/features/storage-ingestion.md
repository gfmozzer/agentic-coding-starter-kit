# Armazenamento de Jobs e Derivativos

## Visao Geral
- Uploads de PDF agora sao realizados via `/api/operator/jobs` com multipart/form-data e sao gravados com o prefixo `docs/{tenantId}/jobs/{jobId}`.
- `StorageClient` (`src/lib/storage/client.ts`) padroniza o acesso ao S3/MinIO utilizando valores de ambiente (`S3_BUCKET`, `S3_ENDPOINT`, etc.).
- `buildJobPaths` (`src/lib/storage/jobs-paths.ts`) encapsula a geracao dos caminhos do job (PDF original e imagens por pagina).

## Fluxo de Criacao de Job
1. A tela `src/app/(operator)/operator/start-translation/start-translation-client.tsx` monta `FormData` com `tenantWorkflowId`, `file` e notas opcionais.
2. O endpoint `src/app/api/operator/jobs/route.ts` valida a sessao, salva o PDF via `StorageClient`, registra o job (tabela `jobs`) e agenda o worker de derivativos.
3. Jobs novos permanecem com `status = "queued"` e `pageImages = []` ate que o worker conclua.

## Worker de Derivativos
- `src/workers/pdf-derivatives.ts` usa `pdf-lib` para obter a quantidade de paginas e gera um JPEG placeholder por pagina (armazenado via `StorageClient`).
- Resultado: lista de chaves retornada ao caller; API atualiza `jobs.pageImages`, insere arquivos em `job_files` e registra eventos em `job_events`.

## Persistencia
- Schema `jobs` agora inclui `page_images_json` para guardar os caminhos das imagens geradas.
- Nova tabela `job_events` (ver `drizzle/20250929_update_jobs_storage.sql`) registra `derivatives_generated` ou `derivatives_failed`.

## Variaveis de Ambiente
```
S3_BUCKET=translator-docs
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio123
S3_FORCE_PATH_STYLE=true
```

## Testes
- `tests/integration/storage-ingestion.test.ts` mocka o S3 e garante que o upload original + `p1.jpg`, `p2.jpg` sejam enviados para o prefixo esperado.
