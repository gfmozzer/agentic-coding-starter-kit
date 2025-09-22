---
description: "Expose super admin console for tenant and user management."
globs:
  - src/app/(super-admin)/**
  - src/lib/actions/super-admin/**
alwaysApply: false
---

id: "MVP-003"
title: "Super-admin gerencia tenants e usuarios"
status: "planned"
priority: "P0"
labels: ["ui","admin","multitenant"]
dependencies: ["MVP-001","MVP-002"]
created: "2025-09-22"

# 1) High-Level Objective

Permitir ao super-admin criar tenants, convidar usuarios e controlar papeis.

# 2) Background / Context (Optional but recommended)

Fluxo descrito na secao 3 do starter-prompt exige esse console.

# 3) Assumptions & Constraints

- CONSTRAINT: Acoes devem ser server actions com validacao de `SessionContext.role`.
- ASSUMPTION: Convites podem ser tratados por email opcional ou ativacao manual.

# 4) Dependencies (Other Tasks or Artifacts)

- src/lib/db/schema/tenants.ts
- src/lib/db/schema/tenant-members.ts
- docs/business/starter-prompt.md

# 5) Context Plan

**Beginning (add to model context):**

- src/app/(super-admin)/page.tsx
- src/components/ui/**
- src/lib/actions/**
- docs/business/starter-prompt.md _(read-only)_

**End state (must exist after completion):**

- src/app/(super-admin)/tenants/page.tsx
- src/app/(super-admin)/tenants/[tenantId]/users/page.tsx
- src/lib/actions/super-admin/tenants.ts
- tests/e2e/super-admin-tenants.spec.ts

# 6) Low-Level Steps (Ordered, information-dense)

1. Implementar pagina `/super-admin/tenants` listando tenants com contagem de membros.
2. Adicionar modal usando `Dialog` para criar ou editar tenant via server action `upsertTenant`.
3. Criar pagina `/super-admin/tenants/[tenantId]/users` mostrando membros com papel e status.
4. Implementar acao `assignTenantRole({ tenantId, userEmail, role })` que vincula usuario existente ou cria convite.
5. Mostrar badges de status (ativo, pendente) e permitir remocao de membros nao super-admin.
6. Reutilizar formulario para promover usuario a `super-admin` global.
7. Cobrir casos de erro (usuario sem permissao, email invalido) com mensagens no UI.

# 7) Types & Interfaces (if applicable)

`src/lib/actions/super-admin/types.ts`:
```ts
export interface AssignTenantRoleInput {
  tenantId: string;
  userEmail: string;
  role: TenantRole;
}
```

# 8) Acceptance Criteria

- Super-admin consegue criar tenant, adicionar usuario e visualizar resultado imediato.
- Usuarios sem papel super-admin nao acessam rotas `/super-admin`.
- Teste Playwright valida criacao + atribuicao de usuario ficticio.

# 9) Testing Strategy

Criar teste `tests/e2e/super-admin-tenants.spec.ts` que usa login simulado para percorrer fluxo de criacao e convite.

# 10) Notes / Links

- Considerar adicionar logs em `docs/runbooks` posteriormente.
