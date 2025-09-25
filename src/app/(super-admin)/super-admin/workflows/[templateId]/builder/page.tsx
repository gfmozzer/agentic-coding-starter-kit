import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";

import { BuilderClient } from "./builder-client";
import { listAgents } from "@/lib/ai/agent-registry";
import { db } from "@/lib/db";
import { renderTemplates } from "@/lib/db/schema/templates";
import { buildRuntimeWorkflow } from "@/lib/workflows/builder";

interface BuilderPageParams {
  templateId: string;
}

export default async function WorkflowBuilderPage({ params }: { params: Promise<BuilderPageParams> }) {
  const { templateId } = await params;

  const runtime = await buildRuntimeWorkflow(templateId).catch((error) => {
    console.error("Workflow builder load", error);
    return null;
  });

  if (!runtime) {
    notFound();
  }

  const [agents, renderTemplatesList] = await Promise.all([
    listAgents(),
    db
      .select({
        id: renderTemplates.id,
        name: renderTemplates.name,
        description: renderTemplates.description,
        updatedAt: renderTemplates.updatedAt,
      })
      .from(renderTemplates)
      .orderBy(asc(renderTemplates.name)),
  ]);

  const formattedTemplates = renderTemplatesList.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description ?? undefined,
    updatedAt: template.updatedAt.toISOString(),
  }));

  return (
    <BuilderClient
      template={{
        id: runtime.template.id,
        name: runtime.template.name,
        description: runtime.template.description ?? "",
        version: runtime.template.version,
      }}
      initialSteps={runtime.steps}
      agents={agents}
      renderTemplates={formattedTemplates}
    />
  );
}
