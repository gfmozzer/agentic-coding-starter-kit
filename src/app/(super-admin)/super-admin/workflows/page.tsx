import { WorkflowsClient } from "./workflows-client";

export default async function WorkflowsPage() {
  // TODO: Remover mock quando as tabelas workflow estiverem criadas
  // Dados mock para demonstração da UI
  const mockTemplates = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Workflow Certidão Padrão",
      description: "Template padrão para processamento de certidões",
      version: "v1.0",
      updatedAt: new Date().toISOString(),
      stepCount: 4,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002", 
      name: "Workflow Tradução Express",
      description: "Fluxo rápido para traduções simples",
      version: "v1.1",
      updatedAt: new Date().toISOString(),
      stepCount: 2,
    },
  ];

  // Quando as tabelas estiverem criadas, descomentar o código abaixo:
  /*
  import { eq, sql } from "drizzle-orm";
  import { db } from "@/lib/db";
  import { workflowSteps, workflowTemplates } from "@/lib/db/schema/workflows";
  
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
  */

  return <WorkflowsClient templates={mockTemplates} />;
}