# Operator Job Creation Flow

## Overview
- Operators configure workflow overrides through `src/app/(operator)/operator/workflows/[workflowId]/settings/settings-client.tsx`.
- New start-translation flow in `src/app/(operator)/operator/start-translation` allows creating jobs once workflows are ready.
- API endpoint `POST /api/operator/jobs` validates requests, compiles the workflow, and persists jobs.

## UI Flow
- Settings screen now exposes tabs for prompts, render HTML, and tokens with inline diff visualisation between template and override so operators can review changes before saving.
- Start translation page lists all tenant workflows, highlighting readiness and token status; only ready workflows appear in the submission dropdown.
- Submission form requires an HTTP/S or `s3://` document reference and optional notes; successful submission surfaces payload preview for audit purposes.

## Backend Logic
- `src/app/api/operator/jobs/route.ts` enforces:
  - operator authentication and tenant ownership;
  - workflow status `ready` and non-empty `llmTokenRefDefault` (422 otherwise);
  - runtime compilation combining template steps with tenant overrides to persist in `workflows` table;
  - job record creation in `jobs` table with metadata snapshot.
- Workflow definition stored with `defaultToken`, resolved prompts, providers, and token refs per step for downstream orchestration.

## Error Handling
- Creating a job without configuring the default token yields HTTP 422 (`Configure o token padrao...`).
- UI surfaces backend errors above the form and keeps user input for correction.
- API responds with 404 for workflows outside the tenant scope and 401 for missing operator session.

## Testing
- Playwright scenario `tests/e2e/operator-clone.spec.ts` now verifies:
  1. 422 response when attempting job creation without tokens;
  2. Successful workflow configuration and job creation via start translation page;
  3. Presence of token and source URL in the returned payload preview.

## Usage Notes
- Jobs reuse or upsert a compiled workflow snapshot per tenant (`workflows` upsert on `(tenantId, name, version)`).
- Override diff highlights rely on lightweight LCS implementation inside the settings client; blank overrides inherit template values automatically.
- API accepts optional `metadata` object, currently populated with free-form notes from the start translation form.
