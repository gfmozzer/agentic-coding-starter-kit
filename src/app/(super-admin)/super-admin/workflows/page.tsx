import { eq, sql } from "drizzle-orm";

import { WorkflowsClient } from "./workflows-client";
import { db } from "@/lib/db";
import { workflowSteps, workflowTemplates } from "@/lib/db/schema/workflows";

export default async function WorkflowsPage() {
  const templates = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      description: workflowTemplates.description,
      version: workflowTemplates.version,
      updatedAt: workflowTemplates.updatedAt,
      stepCount: sql<number>`count(${workflowSteps.id})`,
    })
    .from(workflowTemplates)
    .leftJoin(workflowSteps, eq(workflowSteps.templateId, workflowTemplates.id))
    .groupBy(
      workflowTemplates.id,
      workflowTemplates.name,
      workflowTemplates.description,
      workflowTemplates.version,
      workflowTemplates.updatedAt
    )
    .orderBy(workflowTemplates.name);

  const formatted = templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    version: template.version,
    updatedAt: template.updatedAt.toISOString(),
    stepCount: Number(template.stepCount ?? 0),
  }));

  return <WorkflowsClient templates={formatted} />;
}
