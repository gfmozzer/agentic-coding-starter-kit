import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  test('tenant RLS requires POSTGRES_URL', { skip: true }, () => {
    // Intentionally skipped until a database connection string is provided.
  });
} else {
  const sql = postgres(databaseUrl, { max: 1 });
  const tenantsToCleanup: string[] = [];

  test('RLS enforces tenant isolation', async () => {
    const slugSeed = Date.now();
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    await sql`insert into tenants (id, name, slug) values (${tenantA}::uuid, 'Tenant A', ${`tenant-a-${slugSeed}`})`;
    await sql`insert into tenants (id, name, slug) values (${tenantB}::uuid, 'Tenant B', ${`tenant-b-${slugSeed}`})`;

    tenantsToCleanup.push(tenantA, tenantB);

    const workflowA = randomUUID();
    const workflowB = randomUUID();
    const jobA = randomUUID();
    const jobB = randomUUID();

    await sql.begin(async (tx) => {
      await tx`set local app.tenant_id = ${tenantA}::uuid`;
      await tx`insert into workflows (id, tenant_id, name, version, is_global, definition) values (${workflowA}::uuid, ${tenantA}::uuid, 'Workflow A', 'v1', false, ${tx.json({ steps: [] })})`;
      await tx`insert into jobs (id, tenant_id, workflow_id, status, source_pdf_url, result) values (${jobA}::uuid, ${tenantA}::uuid, ${workflowA}::uuid, 'queued', ${`s3://docs/${tenantA}/jobs/${jobA}/original.pdf`}, ${tx.json({})})`;
    });

    await sql.begin(async (tx) => {
      await tx`set local app.tenant_id = ${tenantB}::uuid`;
      await tx`insert into workflows (id, tenant_id, name, version, is_global, definition) values (${workflowB}::uuid, ${tenantB}::uuid, 'Workflow B', 'v1', false, ${tx.json({ steps: [] })})`;
      await tx`insert into jobs (id, tenant_id, workflow_id, status, source_pdf_url, result) values (${jobB}::uuid, ${tenantB}::uuid, ${workflowB}::uuid, 'queued', ${`s3://docs/${tenantB}/jobs/${jobB}/original.pdf`}, ${tx.json({})})`;
    });

    await assert.rejects(sql`select id from jobs`, /app\.tenant_id/i);

    const jobsForTenantA = await sql.begin(async (tx) => {
      await tx`set local app.tenant_id = ${tenantA}::uuid`;
      return tx<{ tenant_id: string }[]>`select tenant_id from jobs order by created_at`;
    });

    assert.equal(jobsForTenantA.length, 1);
    assert.equal(jobsForTenantA[0]?.tenant_id, tenantA);

    const jobsForTenantB = await sql.begin(async (tx) => {
      await tx`set local app.tenant_id = ${tenantB}::uuid`;
      return tx<{ tenant_id: string }[]>`select tenant_id from jobs order by created_at`;
    });

    assert.equal(jobsForTenantB.length, 1);
    assert.equal(jobsForTenantB[0]?.tenant_id, tenantB);
  });

  test.after(async () => {
    for (const tenantId of tenantsToCleanup) {
      await sql.begin(async (tx) => {
        await tx`set local app.tenant_id = ${tenantId}::uuid`;
        await tx`delete from job_steps where tenant_id = ${tenantId}::uuid`;
        await tx`delete from jobs where tenant_id = ${tenantId}::uuid`;
        await tx`delete from workflows where tenant_id = ${tenantId}::uuid`;
        await tx`delete from templates where tenant_id = ${tenantId}::uuid`;
        await tx`delete from tenant_agents where tenant_id = ${tenantId}::uuid`;
        await tx`delete from agents where tenant_id = ${tenantId}::uuid`;
        await tx`delete from tenant_members where tenant_id = ${tenantId}::uuid`;
      });
      await sql`delete from tenants where id = ${tenantId}::uuid`;
    }

    await sql.end({ timeout: 0 });
  });
}