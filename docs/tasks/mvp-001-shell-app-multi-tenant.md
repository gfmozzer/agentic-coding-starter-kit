---
description: "Replace boilerplate shell with role based layout for translation app."
globs:
  - src/app/**
  - src/components/**
alwaysApply: false
---

id: "MVP-001"
title: "Refatorar shell da aplicacao para o dominio de traducao"
status: "planned"
priority: "P0"
labels: ["ui","layout","cleanup"]
dependencies: []
created: "2025-09-22"

# 1) High-Level Objective

Entregar uma UI base com navegacao separada por papeis (super-admin e operador) sem vestigios do boilerplate original.

# 2) Background / Context (Optional but recommended)

Limpar o template e requisito para montar as telas do MVP descritas em docs/business/starter-prompt.md.

# 3) Assumptions & Constraints

- CONSTRAINT: Reutilizar componentes shadcn/ui existentes.
- ASSUMPTION: Rotas antigas /dashboard e /chat podem ser removidas sem impacto.

# 4) Dependencies (Other Tasks or Artifacts)

- docs/business/starter-prompt.md
- src/lib/auth/session.ts

# 5) Context Plan

**Beginning (add to model context):**

- src/app/layout.tsx
- src/components/ui/**
- tailwind.config.ts _(read-only)_
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/app/(super-admin)/layout.tsx
- src/app/(operator)/layout.tsx
- src/components/app-sidebar.tsx
- src/components/app-topbar.tsx

# 6) Low-Level Steps (Ordered, information-dense)

1. Remover rotas herdadas (`src/app/(marketing)`, `/dashboard`, `/chat`) e apagar componentes nao reutilizaveis.
2. Criar layouts separados `src/app/(super-admin)/layout.tsx` e `src/app/(operator)/layout.tsx` usando sidebar/topbar comuns.
3. Implementar `src/components/app-sidebar.tsx` com navegacao baseada em `AppRole`.
4. Implementar `src/components/app-topbar.tsx` exibindo usuario atual e seletor de tenant quando houver.
5. Atualizar `src/app/layout.tsx` para resolver `SessionContext` e renderizar layout correto.
6. Ajustar `src/styles/globals.css` para remover estilos antigos e definir tokens base.

# 7) Types & Interfaces (if applicable)

Adicionar em `src/lib/auth/session.ts`:
```ts
export type AppRole = "super-admin" | "operator";
export interface SessionContext {
  userId: string;
  role: AppRole;
  tenantId?: string;
}
```

# 8) Acceptance Criteria

- Aplicacao renderiza navegacao especifica por papel com rotas placeholder `/super-admin` e `/operator`.
- Nenhum componente do boilerplate original permanece.
- `npm run lint` executa sem erros.

# 9) Testing Strategy

Executar `npm run lint` e teste de renderizacoes basicas com `npm run test -- --selectProjects=ui-smoke`.

# 10) Notes / Links

- Basear navegacao nos fluxos descritos na secao 12 do starter-prompt.
