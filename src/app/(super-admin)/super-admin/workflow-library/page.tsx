import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkflowLibraryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Disponibilizar Workflows</h2>
          <p className="text-sm text-muted-foreground">
            Publique workflows globais para tenants especificos com controle de versao.
          </p>
        </div>
        <Button size="sm">Publicar workflow</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mapa funcional</CardTitle>
          <CardDescription>
            Deveremos listar workflows, versoes e escopos de tenants associados.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Esta tela tambem iniciara o processo de clonagem para administradores de tenant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}