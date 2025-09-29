# Translator Pro � MVP

Aplica��o multi-tenant para orquestrar tradu��es de documentos com agentes autom�ticos, review humano e auditoria completa. Este reposit�rio implementa o fluxo descrito no starter-prompt: super-admin configura workflows, operadores clonam fluxos, disparam jobs, revisam gates e liberam o PDF final renderizado.

## Vis�o Geral
- **Pap�is**: super-admin (administra tenants, agentes e workflows globais) e operador (clona workflows, inicia jobs, executa reviews, acompanha m�tricas).
- **Orquestra��o**: integra��o com n8n via webhooks (`/api/webhooks/n8n` para entrada, `sendReviewApproval` para aprova��o).
- **Armazenamento**: S3/MinIO com prefixo `s3://docs/{tenant_id}/jobs/{job_id}/...`.
- **Seguran�a**: Better Auth + RLS por `tenant_id` nas tabelas principais.

## Stack
- Next.js 15 (App Router) + React 19
- TypeScript, ESLint, Tailwind, shadcn/ui
- Drizzle ORM + PostgreSQL
- Better Auth (Google OAuth)
- Vercel AI SDK (modelos via `OPENAI_MODEL`)

## Setup R�pido
```bash
pnpm install
cp .env.example .env # preencha vari�veis abaixo
pnpm db:migrate
pnpm dev
```
A aplica��o roda em `http://localhost:3000`.

### Vari�veis de Ambiente Essenciais
```
POSTGRES_URL=postgres://user:pass@host:5432/db
BETTER_AUTH_SECRET=...32 chars...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # ou equivalente
S3_BUCKET=translator-pro-docs
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000 # se usar MinIO
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
N8N_WEBHOOK_URL=https://n8n-url/webhook/translator
```
> **Dica:** em desenvolvimento voc� pode usar MinIO (docker-compose incluso) e um tunnel local para o n8n receber webhooks.

## Fluxo do MVP
1. **Super-admin** monta workflows em `/super-admin/workflows` e os disponibiliza em `/super-admin/workflow-library`.
2. **Operador** clona workflow em `/operator/workflows`, ajusta prompts/HTML e inicia job em `/operator/start-translation` (upload PDF/URL).
3. **n8n** executa agentes, envia review gates ? operador revisa em `/reviews`.
4. **Auditoria** das chaves fica em `key_audit` e � mostrada no detalhe do gate.
5. **Conclus�o**: `/jobs` e `/jobs/[jobId]` exibem m�tricas por agente (view `agent_job_metrics`) e disponibilizam PDF final.

## Documenta��o
- `docs/features/workflow-builder.md` � montagem e publica��o de workflows.
- `docs/features/review-gates.md` � ciclo do review gate + auditoria.
- `docs/features/jobs-dashboard.md` � m�tricas, download e timeline de jobs.
- `docs/runbooks/qa-mvp.md` � checklist end-to-end de QA.
- `docs/business/` � artefatos de planejamento e starter-prompt completo.

## Scripts �teis
```bash
pnpm dev              # modo desenvolvimento
pnpm lint             # ESLint
pnpm test:unit        # testes unit�rios (tsx)
pnpm db:migrate       # aplica migra��es
pnpm db:generate      # gera nova migra��o
pnpm db:studio        # abre Drizzle Studio
```

## Estrutura de Pastas (resumo)
```
src/
 +- app/
 �   +- (super-admin)/...      # console do super-admin
 �   +- (operator)/...         # navega��o do operador
 �   +- api/webhooks/n8n       # inbound webhook do n8n
 �   +- api/operator/jobs      # cria��o/feed de jobs
 +- lib/
 �   +- actions/               # server actions (review, clones, etc.)
 �   +- db/schema/             # tabelas Drizzle + views
 �   +- metrics/               # c�lculo de m�tricas por agente
 �   +- workflows/             # builder, clones e tipos
 +- components/                # UI compartilhada (sidebar, topbar, shadcn)
```

## QA e Deploy
- Execute o checklist em `docs/runbooks/qa-mvp.md` antes de cada entrega.
- Deploy sugerido em Vercel + Railway/Render (PostgreSQL) + MinIO/S3.
- Configure vari�veis nos ambientes (produ��o/staging) antes do primeiro job.

## Suporte
Encontrou um bug? Abra issue descrevendo tenant, job, payload do n8n e logs (`job_events`).

---
Feito com Next.js, Drizzle e muito cuidado para auditar cada chave traduzida.
