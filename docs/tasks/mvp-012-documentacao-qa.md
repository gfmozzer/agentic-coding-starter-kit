---
description: "Document MVP features and prepare QA checklist."
globs:
  - docs/features/**
  - docs/runbooks/**
  - README.md
alwaysApply: false
---

id: "MVP-012"
title: "Documentar MVP e checklist de QA"
status: "planned"
priority: "P1"
labels: ["docs","qa"]
dependencies: ["MVP-001","MVP-011"]
created: "2025-09-22"

# 1) High-Level Objective

Consolidar documentacao das features e preparar checklist de QA para validar o MVP end-to-end.

# 2) Background / Context (Optional but recommended)

Starter-prompt exige documentacao em `/docs/features/` apos implementacao.

# 3) Assumptions & Constraints

- CONSTRAINT: Uma pagina por feature major (workflow builder, review gates, jobs dashboard).
- CONSTRAINT: Checklist QA deve cobrir criterios de aceite 1-6.
- ASSUMPTION: README pode apontar para docs detalhados.

# 4) Dependencies (Other Tasks or Artifacts)

- docs/business/starter-prompt.md
- Features implementadas nas tarefas anteriores

# 5) Context Plan

**Beginning (add to model context):**

- docs/features/**
- README.md
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- docs/features/workflow-builder.md
- docs/features/review-gates.md
- docs/features/jobs-dashboard.md
- docs/runbooks/qa-mvp.md
- README.md atualizado

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar `docs/features/workflow-builder.md` descrevendo arquitetura, tabelas e fluxo de criacao.
2. Criar `docs/features/review-gates.md` cobrindo payloads, UI de revisao e auditoria.
3. Criar `docs/features/jobs-dashboard.md` com metricas, estados e download final.
4. Criar `docs/runbooks/qa-mvp.md` com checklist detalhado (clone workflow, upload, review grupo, review traducao, render final, verificacao RLS).
5. Atualizar `README.md` substituindo referencias antigas pelo novo fluxo de setup e links para docs.
6. Garantir que cada doc inclui paths de arquivos principais e comandos de teste relevantes.

# 7) Types & Interfaces (if applicable)

N/A.

# 8) Acceptance Criteria

- Diretório `/docs/features/` contem arquivos mencionados com conteudo completo.
- README atualizado descreve aplicacao atual e passos de setup.
- Checklist QA cobre criterios de aceite do starter-prompt.

# 9) Testing Strategy

Revisao manual executando checklist e marcando status; nenhum teste automatizado necessario.

# 10) Notes / Links

- Incluir prints ou GIFs se viavel para facilitar onboarding futuro.
