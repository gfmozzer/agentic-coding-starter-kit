import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Painel do Operador</h2>
        <p className="text-sm text-muted-foreground">
          Selecione workflows publicados, acompanhe revisoes pendentes e finalize entregas.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workflow ativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Esta visao mostrara o progresso dos jobs atuais por gate de revisao.</p>
            <p className="text-xs">Inclua status como queued, processing, review:gate e translating.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alertas de revisao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Liste jobs aguardando acao humana com acesso rapido ao gate correspondente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}