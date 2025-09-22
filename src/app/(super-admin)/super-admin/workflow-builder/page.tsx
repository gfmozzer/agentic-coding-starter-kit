import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function WorkflowBuilderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Workflow Builder</h2>
        <p className="text-sm text-muted-foreground">
          Monte sequencias com agentes, grupos de extratores e review gates controlados pelo Super-Admin.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Estado alvo</CardTitle>
          <CardDescription>
            Interface visual para ordenar etapas, configurar grupos e definir revisoes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="font-medium">Requisitos</h3>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Selecao de agentes cadastrados globalmente.</li>
              <li>Configuracao de grupos sequenciais ou paralelos.</li>
              <li>Escolha do input de cada review gate (agente ou grupo).</li>
            </ul>
          </div>
          <Separator />
          <div className="space-y-2">
            <h3 className="font-medium">Proximos passos</h3>
            <p>Sincronizar estrutura com n8n e garantir compatibilidade com clonagem por tenant.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}