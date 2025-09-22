---
description: "Implement document upload, S3 storage and page image generation."
globs:
  - src/app/api/operator/jobs/**
  - src/lib/storage/**
  - src/workers/**
alwaysApply: false
---

id: "MVP-008"
title: "Pipeline de ingestao e derivativos de PDF"
status: "planned"
priority: "P0"
labels: ["storage","jobs","ingestion"]
dependencies: ["MVP-007"]
created: "2025-09-22"

# 1) High-Level Objective

Permitir upload de documentos, armazenamento em S3/MinIO e geracao de imagens por pagina seguindo prefixo exigido.

# 2) Background / Context (Optional but recommended)

Secoes 1, 9 e 10.2 do starter-prompt detalham requisitos do pipeline.

# 3) Assumptions & Constraints

- CONSTRAINT: Usar SDK S3 (`@aws-sdk/client-s3`) com credenciais via `.env`.
- CONSTRAINT: Gerar imagens JPEG por pagina (`p1.jpg`, `p2.jpg`).
- ASSUMPTION: Worker Node pode usar `pdf-lib` + `sharp` ou similar.

# 4) Dependencies (Other Tasks or Artifacts)

- docs/business/starter-prompt.md
- src/lib/db/schema/tenants.ts

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(operator)/jobs/**
- src/lib/storage/**
- src/lib/db/schema/**
- .env.example _(read-only)_

**End state (must exist after completion):**

- src/lib/storage/client.ts
- src/lib/storage/jobs-paths.ts
- src/lib/db/schema/jobs.ts
- src/app/api/operator/jobs/route.ts
- src/workers/pdf-derivatives.ts
- tests/integration/storage-ingestion.test.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `jobs` com colunas `id`, `tenant_id`, `workflow_id`, `status`, `source_pdf_url`, `page_images_json`, `created_at`.
2. Implementar `StorageClient` com funcoes `putObject`, `getSignedUrl`, `listObjects` aplicando prefixo `docs/{tenantId}/jobs/{jobId}/`.
3. Criar helper `buildJobPaths(tenantId, jobId)` em `jobs-paths.ts` definindo `originalPdfKey` e `pageImageKey`.
4. Implementar API POST `/api/operator/jobs` recebendo arquivo multipart, gerando `jobId`, enviando PDF ao storage e registrando job `queued`.
5. Criar worker `pdf-derivatives.ts` que renderiza paginas para JPEG e salva no storage retornando URLs.
6. Atualizar job com `page_images_json` e `status = processing` quando derivativos concluidos.
7. Propagar erros com `status = failed` e logar detalhe em `job_events`.

# 7) Types & Interfaces (if applicable)

`src/lib/jobs/types.ts`:
```ts
export type JobStatus = "queued" | "processing" | "review:gate" | "translating" | "done" | "failed";
export interface JobRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  status: JobStatus;
  sourcePdfUrl: string;
  pageImages: string[];
}
```

# 8) Acceptance Criteria

- Upload retorna 201 com `job_id`, `source_pdf_url` e `page_images` vazias ate worker finalizar.
- Arquivos gerados aparecem em S3 sob `docs/{tenant_id}/jobs/{job_id}/`.
- Teste de integracao verifica upload de PDF fixture e existencia das imagens p1.jpg.

# 9) Testing Strategy

Adicionar `tests/integration/storage-ingestion.test.ts` mockando S3 e garantindo que arquivos sao enviados.

# 10) Notes / Links

- Considerar fila (BullMQ) futura; por enquanto worker pode ser chamado sincrono apos upload.
