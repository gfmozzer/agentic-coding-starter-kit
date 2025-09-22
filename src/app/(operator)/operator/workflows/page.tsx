import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorWorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Workflows Disponiveis</h2>
          <p className="text-sm text-muted-foreground">
            Escolha um workflow global ou uma copia ja personalizada para o tenant.
          </p>
        </div>
        <Button size="sm">Clonar workflow</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Proxima entrega</CardTitle>
          <CardDescription>
            Listar workflows com informacoes de ultima atualizacao e quem publicou.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Mostre indicadores de token configurado e revisoes pendentes para cada workflow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}