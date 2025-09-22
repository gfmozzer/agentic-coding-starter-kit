---
description: "Publish workflows to tenants and manage render templates."
globs:
  - src/lib/db/schema/templates.ts
  - src/lib/db/schema/workflow-publishing.ts
  - src/app/(super-admin)/templates/**
  - src/app/(super-admin)/workflows/**
alwaysApply: false
---

id: "MVP-006"
title: "Publicar workflows e templates de render"
status: "planned"
priority: "P1"
labels: ["workflow","templates","super-admin"]
dependencies: ["MVP-005"]
created: "2025-09-22"

# 1) High-Level Objective

Permitir que super-admin mantenha templates HTML e publique workflows para tenants especificos.

# 2) Background / Context (Optional but recommended)

docs/business/starter-prompt.md descreve necessidade de clonar workflows e editar HTML.

# 3) Assumptions & Constraints

- CONSTRAINT: Templates guardados em tabela dedicada com saneamento basico.
- CONSTRAINT: Publicacao deve registrar audit log.
- ASSUMPTION: Render usa placeholders Mustache ou equivalente.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/workflows/builder.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(super-admin)/workflows/**
- src/app/(super-admin)/templates/**
- src/lib/db/schema/workflows.ts
- src/components/ui/**

**End state (must exist after completion):**

- src/lib/db/schema/templates.ts
- src/lib/db/schema/workflow_publish.ts
- src/app/(super-admin)/templates/page.tsx
- src/app/(super-admin)/workflows/[workflowId]/publish/page.tsx

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `render_templates` com `id`, `name`, `html`, `description`, `created_at`, `updated_at`.
2. Ajustar `workflow_steps` tipo `render` para referenciar `render_template_id`.
3. Implementar pagina `/super-admin/templates` com editor HTML (textarea com highlight) e preview.
4. Criar pagina `/super-admin/workflows/[workflowId]/publish` listando tenants com toggle `is_published`.
5. Persistir tabela `workflow_template_tenants` com `workflow_template_id`, `tenant_id`, `is_default`.
6. Registrar eventos em `workflow_audit` quando publicar ou despublicar.
7. Atualizar serializer para incluir metadados de template (id e nome) no JSON.

# 7) Types & Interfaces (if applicable)

`src/lib/templates/types.ts`:
```ts
export interface RenderTemplate {
  id: string;
  name: string;
  html: string;
}
```

# 8) Acceptance Criteria

- Super-admin cria template de render e associa a passo `render`.
- Workflow aparece para tenants habilitados e some quando despublicado.
- Auditoria lista usuario e timestamp da publicacao.

# 9) Testing Strategy

Teste Playwright percorrendo criacao de template, publicacao e verificando estado em banco.

# 10) Notes / Links

- Considerar uso de sanitize-html antes de salvar HTML personalizado.
