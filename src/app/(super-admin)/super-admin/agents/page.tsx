import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Agentes Globais</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre OCR, extratores e tradutores disponiveis para clonagem pelos tenants.
          </p>
        </div>
        <Button size="sm">Novo agente</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Modelagem esperada</CardTitle>
          <CardDescription>
            Cada agente deve expor tipo, modelo base, prompts e chaves responsaveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Garanta suporte a override de provider/token no clone sem perder configuracoes globais.
          </p>
          <p>
            Inclua validacoes para IO de acordo com o tipo do agente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}