# Translator Pro – MVP

Aplicação multi-tenant para orquestrar traduções de documentos com agentes automáticos, review humano e auditoria completa. Este repositório implementa o fluxo descrito no starter-prompt: super-admin configura workflows, operadores clonam fluxos, disparam jobs, revisam gates e liberam o PDF final renderizado.

## Visão Geral
- **Papéis**: super-admin (administra tenants, agentes e workflows globais) e operador (clona workflows, inicia jobs, executa reviews, acompanha métricas).
- **Orquestração**: integração com n8n via webhooks (`/api/webhooks/n8n` para entrada, `sendReviewApproval` para aprovação).
- **Armazenamento**: S3/MinIO com prefixo `s3://docs/{tenant_id}/jobs/{job_id}/...`.
- **Segurança**: Better Auth + RLS por `tenant_id` nas tabelas principais.

## Stack
- Next.js 15 (App Router) + React 19
- TypeScript, ESLint, Tailwind, shadcn/ui
- Drizzle ORM + PostgreSQL
- Better Auth (Google OAuth)
- Vercel AI SDK (modelos via `OPENAI_MODEL`)

## Setup Rápido
```bash
pnpm install
cp .env.example .env # preencha variáveis abaixo
pnpm db:migrate
pnpm dev
```
A aplicação roda em `http://localhost:3000`.

### Variáveis de Ambiente Essenciais
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
> **Dica:** em desenvolvimento você pode usar MinIO (docker-compose incluso) e um tunnel local para o n8n receber webhooks.

## Fluxo do MVP
1. **Super-admin** monta workflows em `/super-admin/workflows` e os disponibiliza em `/super-admin/workflow-library`.
2. **Operador** clona workflow em `/operator/workflows`, ajusta prompts/HTML e inicia job em `/operator/start-translation` (upload PDF/URL).
3. **n8n** executa agentes, envia review gates ? operador revisa em `/reviews`.
4. **Auditoria** das chaves fica em `key_audit` e é mostrada no detalhe do gate.
5. **Conclusão**: `/jobs` e `/jobs/[jobId]` exibem métricas por agente (view `agent_job_metrics`) e disponibilizam PDF final.

## Documentação
- `docs/features/workflow-builder.md` – montagem e publicação de workflows.
- `docs/features/review-gates.md` – ciclo do review gate + auditoria.
- `docs/features/jobs-dashboard.md` – métricas, download e timeline de jobs.
- `docs/runbooks/qa-mvp.md` – checklist end-to-end de QA.
- `docs/business/` – artefatos de planejamento e starter-prompt completo.

## Scripts Úteis
```bash
pnpm dev              # modo desenvolvimento
pnpm lint             # ESLint
pnpm test:unit        # testes unitários (tsx)
pnpm db:migrate       # aplica migrações
pnpm db:generate      # gera nova migração
pnpm db:studio        # abre Drizzle Studio
```

## Estrutura de Pastas (resumo)
```
src/
 +- app/
 ¦   +- (super-admin)/...      # console do super-admin
 ¦   +- (operator)/...         # navegação do operador
 ¦   +- api/webhooks/n8n       # inbound webhook do n8n
 ¦   +- api/operator/jobs      # criação/feed de jobs
 +- lib/
 ¦   +- actions/               # server actions (review, clones, etc.)
 ¦   +- db/schema/             # tabelas Drizzle + views
 ¦   +- metrics/               # cálculo de métricas por agente
 ¦   +- workflows/             # builder, clones e tipos
 +- components/                # UI compartilhada (sidebar, topbar, shadcn)
```

## QA e Deploy
- Execute o checklist em `docs/runbooks/qa-mvp.md` antes de cada entrega.
- Deploy sugerido em Vercel + Railway/Render (PostgreSQL) + MinIO/S3.
- Configure variáveis nos ambientes (produção/staging) antes do primeiro job.

## Suporte
Encontrou um bug? Abra issue descrevendo tenant, job, payload do n8n e logs (`job_events`).

---
Feito com Next.js, Drizzle e muito cuidado para auditar cada chave traduzida.
