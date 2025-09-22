import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StartTranslationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Iniciar traducao</h2>
        <p className="text-sm text-muted-foreground">
          Carregue PDF ou imagens, configure token do workflow e dispare o job para o n8n.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Checklist antes do upload</CardTitle>
          <CardDescription>
            Validar se o workflow possui token configurado e destino definido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>Selecionar workflow.</li>
            <li>Definir token LLM se ainda nao estiver presente.</li>
            <li>Enviar arquivo ou URL para traducao.</li>
          </ul>
          <Button size="sm">Novo upload</Button>
        </CardContent>
      </Card>
    </div>
  );
}