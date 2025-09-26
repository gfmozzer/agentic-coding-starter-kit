import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, mock } from "node:test";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobs, reviewSessions } from "@/lib/db/schema/jobs";
import { jobEvents } from "@/lib/db/schema/job-events";
import { tenants } from "@/lib/db/schema/tenants";
import { workflowTemplates, tenantWorkflows, workflows } from "@/lib/db/schema/workflows";

const originalWebhookUrl = process.env.N8N_WEBHOOK_URL;

function buildJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

test("integra n8n dispara job e processa webhooks", async (t) => {
  const tenantId = randomUUID();
  const workflowTemplateId = randomUUID();
  const tenantWorkflowId = randomUUID();
  const workflowId = randomUUID();
  const jobId = randomUUID();
  const now = new Date();
  let blockedTenantWorkflowId: string | null = null;
  let blockedWorkflowId: string | null = null;
  let blockedJobId: string | null = null;

  const fetchMock = mock.method(globalThis, "fetch", async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    assert.equal(url, "http://n8n.test/start");
    assert(init?.method === "POST");
    const bodyText = typeof init?.body === "string" ? init.body : undefined;
    assert(bodyText, "payload deveria ser enviado como JSON string");
    const payload = JSON.parse(bodyText!);
    assert.equal(payload.job_id, jobId);
    assert.equal(payload.tenant_id, tenantId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  process.env.N8N_WEBHOOK_URL = "http://n8n.test/start";

  const definition = {
    tenantWorkflowId,
    defaultToken: "vault://token/default",
    steps: [
      {
        id: "agent_1",
        type: "agent",
        llm: {
          provider: "openai",
          tokenRef: "vault://token/default",
        },
      },
    ],
  } as Record<string, unknown>;

  await db.insert(tenants).values({
    id: tenantId,
    name: "Tenant Test",
    slug: `tenant-${tenantId.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    settings: {},
  });

  await db.insert(workflowTemplates).values({
    id: workflowTemplateId,
    name: "Template Test",
    version: "v1",
  });

  await db.insert(tenantWorkflows).values({
    id: tenantWorkflowId,
    tenantId,
    workflowTemplateId,
    name: "Workflow Test",
    description: null,
    version: "v1",
    status: "ready",
    llmTokenRefDefault: "vault://token/default",
  });

  await db.insert(workflows).values({
    id: workflowId,
    tenantId,
    templateId: workflowTemplateId,
    name: "Compiled Workflow",
    description: null,
    version: "v1",
    isGlobal: false,
    definition,
  });

  await db.insert(jobs).values({
    id: jobId,
    tenantId,
    workflowId,
    status: "queued",
    sourcePdfUrl: "https://example.com/input.pdf",
    pageImages: [],
    result: { metadata: { source: "test" } },
    createdAt: now,
    updatedAt: now,
  });

  try {
    const { POST: startJob } = await mock.importModule(
      "@/app/api/operator/jobs/[jobId]/start/route",
      {
        "@/lib/auth/session": {
          getSessionContext: async () => ({
            userId: "user-operator",
            role: "operator",
            tenantId,
            user: {
              name: "Operator",
              email: "operator@example.com",
            },
          }),
        },
      }
    );

    await t.test("disparo seta startedAt mesmo com status processing", async () => {

      const request = new NextRequest(`http://localhost/api/operator/jobs/${jobId}/start`, {
        method: "POST",
      });

      await db
        .update(jobs)
        .set({ status: "processing" })
        .where(eq(jobs.id, jobId));

      const response = await startJob(request, { params: { jobId } });
      assert.equal(response.status, 202);

      const jobRow = await db
        .select({
          status: jobs.status,
          currentGateId: jobs.currentGateId,
          startedAt: jobs.startedAt,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .then((rows) => rows[0]);

      assert(jobRow);
      assert.equal(jobRow.status, "processing");
      assert.equal(jobRow.currentGateId, null);
      assert(jobRow.startedAt instanceof Date);

      const events = await db
        .select({ eventType: jobEvents.eventType })
        .from(jobEvents)
        .where(eq(jobEvents.jobId, jobId));
      assert(events.some((event) => event.eventType === "job_started"));
    });

    await t.test("retorna 422 quando workflow nao tem token", async () => {
      blockedTenantWorkflowId = randomUUID();
      blockedWorkflowId = randomUUID();
      blockedJobId = randomUUID();

      await db.insert(tenantWorkflows).values({
        id: blockedTenantWorkflowId,
        tenantId,
        workflowTemplateId,
        name: "Workflow Sem Token",
        description: null,
        version: "v1",
        status: "ready",
        llmTokenRefDefault: null,
        clonedAt: now,
        updatedAt: now,
      });

      await db.insert(workflows).values({
        id: blockedWorkflowId,
        tenantId,
        templateId: workflowTemplateId,
        name: "Workflow Sem Token",
        description: null,
        version: "v1",
        isGlobal: false,
        definition: {
          tenantWorkflowId: blockedTenantWorkflowId,
          steps: [],
        },
      });

      await db.insert(jobs).values({
        id: blockedJobId,
        tenantId,
        workflowId: blockedWorkflowId,
        status: "queued",
        sourcePdfUrl: "https://example.com/input.pdf",
        pageImages: [],
        result: {},
        createdAt: now,
        updatedAt: now,
      });

      const request = new NextRequest(
        `http://localhost/api/operator/jobs/${blockedJobId}/start`,
        {
          method: "POST",
        }
      );

      const response = await startJob(request, { params: { jobId: blockedJobId } });
      assert.equal(response.status, 422);

      const events = await db
        .select({ eventType: jobEvents.eventType })
        .from(jobEvents)
        .where(eq(jobEvents.jobId, blockedJobId));
      assert(events.some((event) => event.eventType === "job_start_blocked"));
    });

    await t.test("webhook review atualiza estado", async () => {
      const { POST: webhook } = await import("@/app/api/webhooks/n8n/route");
      const reviewPayload = {
        tenant_id: tenantId,
        job_id: jobId,
        gate_id: "rv_test",
        input_kind: "group" as const,
        ref_id: "group_1",
        keys: { name: "JOAO" },
        pages: ["https://example.com/page1.jpg"],
        key_sources: { name: "agent_1" },
      };

      const reviewResponse = await webhook(
        buildJsonRequest("http://localhost/api/webhooks/n8n", reviewPayload)
      );
      assert.equal(reviewResponse.status, 200);

      const jobRow = await db
        .select({ status: jobs.status, currentGateId: jobs.currentGateId })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .then((rows) => rows[0]);

      assert(jobRow);
      assert.equal(jobRow.status, "review:rv_test");
      assert.equal(jobRow.currentGateId, "rv_test");

      const sessionRow = await db
        .select({ gateId: reviewSessions.gateId, status: reviewSessions.status })
        .from(reviewSessions)
        .where(and(eq(reviewSessions.jobId, jobId), eq(reviewSessions.gateId, "rv_test")))
        .then((rows) => rows[0]);

      assert(sessionRow);
      assert.equal(sessionRow.status, "pending");
    });

    await t.test("webhook done finaliza job", async () => {
      const { POST: webhook } = await import("@/app/api/webhooks/n8n/route");
      const donePayload = {
        tenant_id: tenantId,
        job_id: jobId,
        status: "done" as const,
        pdf_url_final: "https://example.com/final.pdf",
      };
      const doneResponse = await webhook(
        buildJsonRequest("http://localhost/api/webhooks/n8n", donePayload)
      );
      assert.equal(doneResponse.status, 200);

      const jobRow = await db
        .select({ status: jobs.status, result: jobs.result })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .then((rows) => rows[0]);

      assert(jobRow);
      assert.equal(jobRow.status, "done");
      const result = (jobRow.result ?? {}) as Record<string, unknown>;
      assert.equal(result.finalPdfUrl, "https://example.com/final.pdf");

      const events = await db
        .select({ eventType: jobEvents.eventType })
        .from(jobEvents)
        .where(eq(jobEvents.jobId, jobId));

      assert(events.some((event) => event.eventType === "job_completed"));
    });
  } finally {
    fetchMock.mock.restore();
    mock.restoreAll();

    if (originalWebhookUrl === undefined) {
      delete process.env.N8N_WEBHOOK_URL;
    } else {
      process.env.N8N_WEBHOOK_URL = originalWebhookUrl;
    }

    await db.delete(jobEvents).where(eq(jobEvents.jobId, jobId));
    await db.delete(reviewSessions).where(eq(reviewSessions.jobId, jobId));
    await db.delete(jobs).where(eq(jobs.id, jobId));

    if (blockedJobId) {
      await db.delete(jobEvents).where(eq(jobEvents.jobId, blockedJobId));
      await db.delete(reviewSessions).where(eq(reviewSessions.jobId, blockedJobId));
      await db.delete(jobs).where(eq(jobs.id, blockedJobId));
    }

    await db.delete(workflows).where(eq(workflows.id, workflowId));
    if (blockedWorkflowId) {
      await db.delete(workflows).where(eq(workflows.id, blockedWorkflowId));
    }

    await db
      .delete(tenantWorkflows)
      .where(eq(tenantWorkflows.id, tenantWorkflowId));
    if (blockedTenantWorkflowId) {
      await db
        .delete(tenantWorkflows)
        .where(eq(tenantWorkflows.id, blockedTenantWorkflowId));
    }
    await db.delete(workflowTemplates).where(eq(workflowTemplates.id, workflowTemplateId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
});
