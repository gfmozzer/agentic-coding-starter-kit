import { inArray } from "drizzle-orm";

import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workflowTemplates } from "@/lib/db/schema/workflows";
import { listTenantWorkflows } from "@/lib/workflows/tenant";
import { StartTranslationClient } from "./start-translation-client";

export default async function StartTranslationPage() {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    return null;
  }

  const tenantWorkflows = await listTenantWorkflows(session.tenantId);

  const templateIds = Array.from(new Set(tenantWorkflows.map((workflow) => workflow.templateId)));

  const templates = templateIds.length
    ? await db
        .select({
          id: workflowTemplates.id,
          name: workflowTemplates.name,
          version: workflowTemplates.version,
        })
        .from(workflowTemplates)
        .where(inArray(workflowTemplates.id, templateIds))
    : [];

  const templateMap = new Map(templates.map((template) => [template.id, template]));

  const workflows = tenantWorkflows.map((workflow) => {
    const template = templateMap.get(workflow.templateId);
    return {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      llmTokenRefDefault: workflow.llmTokenRefDefault ?? null,
      templateName: template?.name ?? "Template removido",
      templateVersion: template?.version ?? workflow.version,
      updatedAt: workflow.updatedAt,
    };
  });

  return <StartTranslationClient workflows={workflows} />;
}
