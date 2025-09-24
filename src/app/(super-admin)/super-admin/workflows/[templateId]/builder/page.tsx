import { BuilderClient } from "./builder-client";

type BuilderPageParams = {
  templateId: string;
};

export default async function WorkflowBuilderPage({
  params,
}: {
  params: BuilderPageParams;
}) {
  const templateId = params.templateId;

  // TODO: Remover mock quando as tabelas workflow estiverem criadas
  // Mock data para demonstração
  const mockTemplate = {
    id: templateId,
    name: "Workflow Template Mock",
    description: "Template para demonstração do builder",
    version: "v1.0",
  };

  const mockSteps = []; // Começar com workflow vazio

  const mockAgents = [
    {
      id: "agt_ocr_mock",
      name: "OCR Agent",
      kind: "ocr" as const,
    },
    {
      id: "agt_structured_mock",
      name: "Structured Extraction",
      kind: "structured" as const,
    },
    {
      id: "agt_translator_mock", 
      name: "Portuguese Translator",
      kind: "translator" as const,
    },
  ];

  const mockRenderTemplates = [
    {
      id: "tpl_certidao_mock",
      name: "Certidão Template",
      version: "v1.0",
      tenantId: "tenant_mock",
    },
    {
      id: "tpl_passport_mock",
      name: "Passport Template", 
      version: "v1.0",
      tenantId: "tenant_mock",
    },
  ];

  /* 
  // Código real a ser usado quando o banco estiver configurado:
  import { notFound } from "next/navigation";
  import { asc } from "drizzle-orm";
  import { listAgents } from "@/lib/ai/agent-registry";
  import { db } from "@/lib/db";
  import { templates } from "@/lib/db/schema/templates";
  import { buildRuntimeWorkflow } from "@/lib/workflows/builder";

  let runtime;
  try {
    runtime = await buildRuntimeWorkflow(templateId);
  } catch (error) {
    console.error("Workflow builder load", error);
    notFound();
  }

  const [agents, renderTemplates] = await Promise.all([
    listAgents(),
    db
      .select({
        id: templates.id,
        name: templates.name,
        version: templates.version,
        tenantId: templates.tenantId,
      })
      .from(templates)
      .orderBy(asc(templates.name)),
  ]);

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
      renderTemplates={renderTemplates}
    />
  );
  */

  return (
    <BuilderClient
      template={mockTemplate}
      initialSteps={mockSteps}
      agents={mockAgents}
      renderTemplates={mockRenderTemplates}
    />
  );
}