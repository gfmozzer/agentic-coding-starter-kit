# Operator Workflow Cloning

## Overview

Implements the operator-side experience for cloning workflows made available by the super-admin, adjusting prompts and render HTML, and configuring mandatory LLM tokens per tenant.

## Key Capabilities

- Lists published workflow templates and tenant clones with status, token indicators, and quick access to settings (`/operator/workflows`).
- Server actions enforce tenant scoping, clone workflows into `tenant_workflows` / `tenant_workflow_steps`, and validate overrides before persisting.
- Settings UI exposes tabs for **Prompts**, **Render HTML**, and **Tokens**, with diff highlights and preview, plus safeguards that block “ready” status without a default token (`/operator/workflows/[id]/settings`).
- Overrides cover per-step system prompt, provider, token, and render HTML, while respecting template order and structure.
- Playwright spec (`tests/e2e/operator-clone.spec.ts`) validates cloning and override flows with authenticated operator sessions.

## Core Files

- `src/lib/db/schema/workflows.ts` – tenant workflow tables and types.
- `src/lib/actions/operator/workflows.ts` – clone and settings server actions.
- `src/lib/workflows/tenant.ts` – data loaders for operator views.
- `src/app/(operator)/operator/workflows/*` – list and settings pages with client components.
- `tests/e2e/operator-clone.spec.ts` – Playwright regression coverage for cloning.

## Configuration & Notes

- Requires at least one published workflow template via the super-admin console before operators can clone.
- Playwright tests expect `PLAYWRIGHT_STORAGE_STATE` referencing an authenticated operator session.
- Default token (`llm_token_ref_default`) must be configured before setting workflows to `ready` to satisfy backend validation.
