import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates Globais</h2>
          <p className="text-sm text-muted-foreground">
            Defina HTML base e placeholders para renderizar certificados e documentos finais.
          </p>
        </div>
        <Button size="sm">Novo template</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Checklist do MVP</CardTitle>
          <CardDescription>
            Templates clonados por tenants devem permitir edicao de HTML e cabecalho.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>Associar template aos workflows render.</li>
            <li>Validar chaves exigidas pelo layout.</li>
            <li>Persistir historico de revisoes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}