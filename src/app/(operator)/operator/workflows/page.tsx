import { inArray } from "drizzle-orm";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workflowTemplates } from "@/lib/db/schema/workflows";
import {
  listPublishedWorkflowTemplatesForTenant,
  listTenantWorkflows,
} from "@/lib/workflows/tenant";
import { OperatorWorkflowsClient } from "./workflows-client";

export default async function OperatorWorkflowsPage() {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    return null;
  }

  const tenantId = session.tenantId;

  const [workflows, publishedTemplates] = await Promise.all([
    listTenantWorkflows(tenantId),
    listPublishedWorkflowTemplatesForTenant(tenantId),
  ]);

  const templateIds = Array.from(new Set(workflows.map((workflow) => workflow.templateId)));

  const templateRows = templateIds.length
    ? await db
        .select({
          id: workflowTemplates.id,
          name: workflowTemplates.name,
          version: workflowTemplates.version,
        })
        .from(workflowTemplates)
        .where(inArray(workflowTemplates.id, templateIds))
    : [];

  const templateMap = new Map(templateRows.map((row) => [row.id, row]));

  const workflowItems = workflows.map((workflow) => {
    const template = templateMap.get(workflow.templateId);
    return {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      templateId: workflow.templateId,
      templateName: template?.name ?? "Template removido",
      templateVersion: template?.version ?? workflow.version,
      updatedAt: workflow.updatedAt,
      llmTokenRefDefault: workflow.llmTokenRefDefault ?? null,
    };
  });

  const templateItems = publishedTemplates.map((template) => ({
    templateId: template.templateId,
    name: template.name,
    description: template.description ?? null,
    version: template.version,
    isDefault: template.isDefault,
    publishedAt: template.publishedAt.toISOString(),
  }));

  return (
    <OperatorWorkflowsClient workflows={workflowItems} templates={templateItems} />
  );
}

