import { listAgents } from "@/lib/ai/agent-registry";

import { AgentsClient } from "./agents-client";

export default async function AgentsPage() {
  const agents = await listAgents();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Agentes globais</h1>
        <p className="text-sm text-muted-foreground">
          Catalogue agentes OCR, extratores estruturados, tradutores e renderizadores disponíveis para clonagem pelos tenants.
        </p>
      </header>
      <AgentsClient agents={agents} />
    </div>
  );
}
