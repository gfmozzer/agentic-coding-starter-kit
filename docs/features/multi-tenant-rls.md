# Multi-tenant Schema and RLS

## Overview
- Adds tenant-aware tables (tenants, tenant_members, agents, templates, workflows, jobs, job_steps, job_files, review_sessions, key_audit).
- Enforces row level security using `current_setting(''app.tenant_id'')::uuid`.
- Provides helpers (`withTenantContext`) and typed exports (`src/lib/db/types.ts`).

## Migrations
- Generated SQL: `drizzle/20250922_add_multitenant_schema.sql`.
- Run locally: `npm run db:migrate` (requires `POSTGRES_URL`).
- Optional seed: `psql "$POSTGRES_URL" -f drizzle/seeds/tenant_demo.sql`.

## Usage
- Wrap database work in `withTenantContext(tenantId, callback)` to ensure `SET LOCAL app.tenant_id` is applied.
- Import schema and types via `@/lib/db` barrel.

## Testing
- Smoke test: `node --test tests/db/tenant-rls.test.ts` (skips when `POSTGRES_URL` is absent).
- Verifies that queries without context throw and scoped queries only return tenant-matched rows.

## Follow-up
- Provision CI database and wire the RLS test into the pipeline.
- Replace seed email `operator@example.com` with an environment-specific operator before running the seed script.