---
description: "Add tenant schema with row level security in the database."
globs:
  - src/lib/db/**
  - drizzle/**
alwaysApply: false
---

id: "MVP-002"
title: "Configurar tenants e politicas RLS"
status: "planned"
priority: "P0"
labels: ["database","security","multitenant"]
dependencies: ["MVP-001"]
created: "2025-09-22"

# 1) High-Level Objective

Garantir que todo dado de dominio respeita tenant_id com RLS ativa.

# 2) Background / Context (Optional but recommended)

Requisito direto da secao 2 do starter-prompt.

# 3) Assumptions & Constraints

- CONSTRAINT: Usar migracoes drizzle para alterar schema.
- CONSTRAINT: Politicas devem usar `current_setting('app.tenant_id')`.
- ASSUMPTION: Base postgres permite extensao uuid-ossp ou pgcrypto.

# 4) Dependencies (Other Tasks or Artifacts)

- docs/business/starter-prompt.md
- src/lib/auth/session.ts
- drizzle/config existentes

# 5) Context Plan

**Beginning (add to model context):**

- src/lib/db/schema/**
- drizzle/*.sql
- drizzle.config.ts
- src/lib/db/index.ts

**End state (must exist after completion):**

- drizzle/2025XXXX_add_tenants.sql
- src/lib/db/schema/tenants.ts
- src/lib/db/schema/tenant-members.ts
- src/lib/db/policies/tenant-rls.sql

# 6) Low-Level Steps (Ordered, information-dense)

1. Criar tabela `tenants` com colunas `id uuid pk`, `name`, `slug`, `created_at`, `updated_at`.
2. Criar tabela `tenant_members` com `tenant_id`, `user_id`, `role`, `created_at`, `updated_at`.
3. Adicionar coluna `tenant_id uuid not null` em tabelas de dominio existentes (jobs, workflows, etc).
4. Habilitar RLS com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em cada tabela com tenant.
5. Definir politica `CREATE POLICY tenant_isolation ON <table> USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
6. Implementar helper `withTenantContext(tenantId)` em `src/lib/db/tenant-context.ts` que executa `SET LOCAL app.tenant_id`.
7. Atualizar wrappers de acesso ao banco para exigir `tenantId` derivado da sessao.
8. Adicionar seed opcional para `tenant_demo` e membro operador.

# 7) Types & Interfaces (if applicable)

`src/lib/db/types.ts`:
```ts
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}
export type TenantRole = "super-admin" | "operator";
```

# 8) Acceptance Criteria

- `npm run db:migrate` aplica migracoes sem erros.
- Consultas sem `SET app.tenant_id` falham com erro de permissao durante teste automatizado.
- Consultas com tenant configurado retornam apenas registros desse tenant.

# 9) Testing Strategy

Adicionar teste `tests/db/tenant-rls.test.ts` que valida acesso negado sem contexto e sucesso com contexto correto.

# 10) Notes / Links

- Reutilizar abordagem do blog Supabase sobre RLS (documentar referencia em docs/features futuramente).
