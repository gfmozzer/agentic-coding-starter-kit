import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Painel do Super-Admin</h2>
        <p className="text-sm text-muted-foreground">
          Configure tenants, organize agentes globais e publique workflows prontos para os operadores.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workflows em Destaque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Monitore quais workflows globais estao publicados por tenant.</p>
            <p className="text-xs">
              Esta pagina servira como quadro de indicadores para acompanhar tokens, revisoes pendentes e status de publicacao.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proximos Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ol className="space-y-1 list-decimal list-inside">
              <li>Modelar tenants e usuarios.</li>
              <li>Cadastre agentes OCR, extratores e tradutores.</li>
              <li>Monte grupos e defina review gates no workflow builder.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}