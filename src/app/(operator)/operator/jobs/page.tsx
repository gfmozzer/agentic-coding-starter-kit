import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Historico de Jobs</h2>
        <p className="text-sm text-muted-foreground">
          Consulte traducoes finalizadas, status e links para download do PDF final.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Metas de implementacao</CardTitle>
          <CardDescription>
            Relatorio deve trazer filtros por estado, workflow e periodo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Registrar metrics por agente com base nas chaves editadas nos review gates para calcular acuracia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}