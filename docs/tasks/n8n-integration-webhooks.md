---
title: "Integra��o n8n ? Aplica��o"
description: "Guia para devolver resultados de agentes e abrir revis�es humanas."
relatedTasks: ["MVP-009", "MVP-010", "MVP-011", "MVP-012"]
---

# Vis�o Geral

O n8n coordena a execu��o dos agentes (OCR, grupos de extra��o, tradutor, render). Sempre que o fluxo precisar persistir um estado no app � abrir revis�o, finalizar job ou registrar falha � ele deve chamar o endpoint HTTP exposto pela aplica��o:

```
POST /api/webhooks/n8n
Content-Type: application/json
```

O backend identifica o tipo de payload pelos campos presentes. Abaixo est�o os formatos aceitos.

## 1. Abrir gate de revis�o (`review`)

Envie quando um step humano deve revisar as chaves agregadas.

```json
{
  "tenant_id": "ten_a",
  "job_id": "job_123",
  "gate_id": "rv_ex",
  "input_kind": "group",                 // "group" ou "agent"
  "ref_id": "g_ex",
  "keys": {
    "selo_cartorio": "12345",
    "nome": "JO�O"
  },
  "key_sources": {                         // opcional
    "selo_cartorio": "grp_selos",
    "nome": "agt_texto"
  },
  "pages": [                               // URLs das p�ginas/imagens
    "https://s3/.../p1.jpg",
    "https://s3/.../p2.jpg"
  ],
  "keys_translated": {                     // opcional (ex.: sugest�es de tradu��o)
    "nome": "JOHN"
  },
  "keys_reviewed": {                       // opcional (reabrir gate j� revisado)
    "nome": "JO�O DA SILVA"
  },
  "context": {                              // opcional: dados adicionais
    "score": 0.92,
    "node_id": "grp_selos"
  }
}
```

**Efeitos no app:**
- Atualiza o job para `status = "review:<gate_id>"`.
- Persiste o payload em `review_gates` e no snapshot `jobs.result.reviewGates`.
- Introduz o item na UI (`/reviews` e `/reviews/[jobId]/[gateId]`).
- Registra o evento `review_gate_opened` em `job_events`.

> O n8n deve agregar/�flatten� os resultados dos agentes antes de postar � o app n�o mescla chaves.

## 2. Conclus�o com sucesso (`status: "done"`)

Use quando o render final estiver dispon�vel.

```json
{
  "tenant_id": "ten_a",
  "job_id": "job_123",
  "status": "done",
  "pdf_url_final": "https://s3/ten_a/jobs/job_123/final.pdf",
  "metadata": {
    "render_time_ms": 15234,
    "template_version": "v4"
  }
}
```

**Efeitos:** job marcado como `done`, campo `finalPdfUrl` salvo em `jobs.result`, evento `job_completed`, download liberado em `/jobs/[jobId]`.

## 3. Falha irrecuper�vel (`status: "failed"`)

```json
{
  "tenant_id": "ten_a",
  "job_id": "job_123",
  "status": "failed",
  "error": "OCR timeout",
  "reason": "OCR n�o retornou em 120s",
  "metadata": {
    "node_id": "ocr_1"
  }
}
```

**Efeitos:** job muda para `failed`, mensagem salva em `jobs.error`, evento `job_failed` para auditoria.

## 4. P�s-revis�o (retorno para o n8n)

Quando o operador aprova um gate, o app chama `sendReviewApproval` (server action `submitReviewAction`). Payload enviado ao n8n:

```json
{
  "tenant_id": "ten_a",
  "job_id": "job_123",
  "gate_id": "rv_ex",
  "keys_reviewed": {
    "selo_cartorio": "12345\n67890",
    "nome": "JO�O DA SILVA"
  }
}
```

O n8n deve ent�o seguir para os pr�ximos steps (tradutor, render, etc.).

## 5. Boas pr�ticas

- **URLs de arquivos**: use o prefixo `s3://docs/{tenant_id}/jobs/{job_id}/...`. O app s� exibe; upload/armazenamento � responsabilidade do n8n/StorageClient.
- **Token LLM**: recebido no payload de `triggerWorkflow` (rota `POST /api/operator/jobs/{jobId}/start`). Preserve `workflow_definition_steps` caso precise reabrir revis�es.
- **Retentativas**: se o webhook retornar 4xx/5xx, reenvie ap�s corrigir a causa. Payloads s�o idempotentes para o mesmo `gate_id`/`status`.
- **Auditoria**: cada `review` gera entradas em `key_audit` com diff das chaves. N�o grave diretamente nessas tabelas; use os webhooks.

## Refer�ncias de c�digo
- Endpoint: `src/app/api/webhooks/n8n/route.ts`
- Aprova��o: `src/lib/actions/review/submit.ts`
- Schemas: `src/lib/db/schema/review-gates.ts`, `src/lib/db/schema/key-audit.ts`, `src/lib/db/schema/jobs.ts`
- Cliente n8n: `src/lib/orchestration/n8n-client.ts`

---
Checklist r�pido para implementar no n8n:
1. Ap�s cada etapa autom�tica, decidir se abre gate ou continua.
2. Para revis�o humana ? `POST /api/webhooks/n8n` (payload `review`).
3. Receber callback de aprova��o via `sendReviewApproval` e continuar fluxo.
4. Ao terminar ? `POST /api/webhooks/n8n` com `status: "done"` (ou `failed`).
