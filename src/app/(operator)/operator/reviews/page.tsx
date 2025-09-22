import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Revisoes Pendentes</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe jobs travados em review gates e abra a interface de revisao dedicada.
          </p>
        </div>
        <Button size="sm" variant="outline">
          Ver todas as revisoes
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fluxo previsto</CardTitle>
          <CardDescription>
            Tela exibira PDF a esquerda e chaves estruturadas a direita para edicao rapida.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Integrar com payload do n8n contendo keys, key_sources e paginas para auxiliar o operador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}